#!/usr/bin/env python3
"""NetViren Windows Agent -- lightweight security monitoring agent for Windows."""

import os
import sys
import json
import time
import uuid
import hashlib
import platform
import socket
import logging
import subprocess

import requests
import psutil

# Optional WMI import for Machine ID and process enumeration fallback
try:
    import wmi
except ImportError:
    wmi = None

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger('netviren-agent')

# Windows config path under %APPDATA%
CONFIG_PATH = os.path.join(os.environ.get('APPDATA', 'C:\\Windows\\System32\\config\\systemprofile\\AppData\\Roaming'),
                           'NetViren', 'agent.json')
API_URL = os.environ.get('NETVIREN_API_URL', 'http://10.0.0.1:4001')


class NetVirenAgent:
    def __init__(self):
        self.config = self.load_config()
        self.agent_id = self.config.get('agent_id')
        self.token = self.config.get('token')
        self.machine_id = self.get_machine_id()

    def load_config(self):
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH) as f:
                return json.load(f)
        return {}

    def save_config(self):
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        with open(CONFIG_PATH, 'w') as f:
            json.dump(self.config, f, indent=2)

    def get_machine_id(self):
        """Retrieve machine UUID via WMI (Win32_ComputerSystemProduct)."""
        if wmi is not None:
            try:
                c = wmi.WMI()
                for cs_product in c.Win32_ComputerSystemProduct():
                    if cs_product.UUID:
                        return cs_product.UUID.strip()
            except Exception as e:
                logger.warning(f"WMI machine ID failed: {e}")
        # Fallback: try PowerShell command
        try:
            result = subprocess.run(
                ['powershell', '-Command',
                 '(Get-WmiObject Win32_ComputerSystemProduct).UUID'],
                capture_output=True, text=True, timeout=10
            )
            uuid_str = result.stdout.strip()
            if uuid_str:
                return uuid_str
        except Exception as e:
            logger.warning(f"PowerShell machine ID fallback failed: {e}")
        # Last resort: generate a persistent UUID based on system info
        try:
            return str(uuid.uuid5(uuid.NAMESPACE_DNS, platform.node() + platform.machine()))
        except Exception:
            return str(uuid.uuid4())

    def register(self):
        logger.info("Registering agent...")
        resp = requests.post(f"{API_URL}/api/agents/register", json={
            'name': socket.gethostname(),
            'machineId': self.machine_id,
            'agentType': 'windows',
            'version': '1.0.0',
        })
        data = resp.json()
        self.config['agent_id'] = data['agent']['id']
        self.config['token'] = data['agent']['auth_token']
        self.agent_id = data['agent']['id']
        self.token = data['agent']['auth_token']
        self.save_config()
        logger.info(f"Registered as agent {self.agent_id}")

    def heartbeat(self):
        try:
            resp = requests.post(
                f"{API_URL}/api/agents/{self.agent_id}/heartbeat",
                json={
                    'status': 'online',
                    'ipAddress': self.get_ip(),
                    'osVersion': platform.platform(),
                },
                headers={'Authorization': f'Bearer {self.token}'},
                timeout=10
            )
            return resp.ok
        except Exception as e:
            logger.error(f"Heartbeat failed: {e}")
            return False

    def get_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return '0.0.0.0'

    def scan_file(self, filepath: str) -> dict:
        """Compute SHA256 hash of a file."""
        sha256 = hashlib.sha256()
        try:
            with open(filepath, 'rb') as f:
                for chunk in iter(lambda: f.read(65536), b''):
                    sha256.update(chunk)
            return {
                'filePath': filepath,
                'fileName': os.path.basename(filepath),
                'fileSize': os.path.getsize(filepath),
                'sha256Hash': sha256.hexdigest(),
            }
        except Exception as e:
            logger.error(f"File scan error {filepath}: {e}")
            return None

    def scan_directory(self, directory: str):
        """Recursively scan a directory for PE/exe/dll files."""
        results = []
        for root, dirs, files in os.walk(directory):
            for fname in files:
                fpath = os.path.join(root, fname)
                if os.path.isfile(fpath) and os.access(fpath, os.R_OK):
                    result = self.scan_file(fpath)
                    if result:
                        results.append(result)
                        # Upload to server
                        try:
                            requests.post(
                                f"{API_URL}/api/agents/{self.agent_id}/files",
                                json=result,
                                headers={'Authorization': f'Bearer {self.token}'},
                                timeout=30
                            )
                        except Exception as e:
                            logger.error(f"Upload failed for {fpath}: {e}")
        return results

    def get_processes(self) -> list:
        """Get list of running processes with WMI fallback."""
        procs = []
        # Primary method: psutil
        for proc in psutil.process_iter(['pid', 'name', 'exe', 'cmdline']):
            try:
                info = proc.info
                procs.append({
                    'pid': info['pid'],
                    'name': info['name'],
                    'path': info['exe'] or '',
                    'cmdline': ' '.join(info['cmdline']) if info['cmdline'] else '',
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass

        # Fallback: WMI if psutil returned nothing (e.g., restricted environment)
        if not procs and wmi is not None:
            try:
                c = wmi.WMI()
                for proc in c.Win32_Process():
                    procs.append({
                        'pid': proc.ProcessId,
                        'name': proc.Name,
                        'path': proc.ExecutablePath or '',
                        'cmdline': proc.CommandLine or '',
                    })
            except Exception as e:
                logger.warning(f"WMI process enumeration failed: {e}")

        return procs

    def get_connections(self) -> list:
        """Get network connections."""
        conns = []
        for conn in psutil.net_connections(kind='inet'):
            try:
                if conn.status == 'ESTABLISHED' and conn.raddr:
                    conns.append({
                        'localPort': conn.laddr.port,
                        'remoteIp': conn.raddr.ip,
                        'remotePort': conn.raddr.port,
                        'protocol': 'tcp',
                        'processName': '',
                    })
            except Exception:
                pass
        return conns

    def start_packet_capture(self, interface: str = None, duration_seconds: int = 300):
        """
        Start Npcap-based packet capture.
        Npcap must be installed separately (see installer.nsi).
        This is a stub -- integration with Npcap's npcap SDK or a Python wrapper
        (e.g., scapy with Npcap backend, pyshark with Npcap, or directly via
        npcap-helper) would be placed here.
        """
        logger.info(f"Packet capture requested on interface={interface}, duration={duration_seconds}s")
        # Placeholder for Npcap integration:
        #   - Use scapy with Npcap (WinPcap/Npcap) as the packet capture driver
        #   - Or invoke npcap-helper / tshark via subprocess
        #   - Or use pyshark with Npcap as the capture backend
        logger.warning("Npcap packet capture not yet implemented -- install Npcap and use scapy/pyshark")

    def run(self):
        """Main agent loop."""
        # Register if not registered
        if not self.agent_id:
            self.register()

        logger.info("Agent running...")
        while True:
            try:
                # Heartbeat
                self.heartbeat()

                # Check for commands
                try:
                    resp = requests.get(
                        f"{API_URL}/api/agents/{self.agent_id}/commands",
                        headers={'Authorization': f'Bearer {self.token}'},
                        timeout=10
                    )
                    if resp.ok:
                        commands = resp.json().get('commands', [])
                        for cmd in commands:
                            logger.info(f"Received command: {cmd}")
                            # Handle commands (scan, capture, etc.)
                except Exception:
                    pass

                time.sleep(30)
            except Exception as e:
                logger.error(f"Agent loop error: {e}")
                time.sleep(60)


if __name__ == '__main__':
    agent = NetVirenAgent()
    agent.run()
