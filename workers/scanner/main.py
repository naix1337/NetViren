#!/usr/bin/env python3
"""NetViren Scanner Worker. Polls DB for pending scan jobs and executes them."""

import time
import logging
import os
import sys
import threading
from datetime import datetime
from typing import List, Dict

from db import get_db
from arp_scanner import scan_arp
from port_scanner import scan_ports_tcp, scan_ports_udp
from os_detection import detect_os

logging.basicConfig(
    level=getattr(logging, os.environ.get('LOG_LEVEL', 'info').upper()),
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger('netviren-scanner')


def get_pending_scans(db) -> List[Dict]:
    cur = db.execute("SELECT * FROM scans WHERE status = 'pending' ORDER BY started_at ASC LIMIT 1")
    return [dict(row) for row in cur.fetchall()]


def execute_scan(db, scan: Dict):
    scan_id = scan['id']
    scan_type = scan['scan_type']
    target = scan.get('target') or ''
    # Auto-detect local network if target is empty or "AUTO"
    if not target or target == 'AUTO':
        import subprocess
        try:
            result = subprocess.run(['ip', '-4', 'route', 'show', 'default'], capture_output=True, text=True, timeout=5)
            parts = result.stdout.strip().split()
            if len(parts) >= 3:
                via_idx = parts.index('via')
                if via_idx + 3 < len(parts):
                    dev = parts[via_idx + 3]
                    dev_result = subprocess.run(['ip', '-4', 'route', 'show', 'dev', dev], capture_output=True, text=True, timeout=5)
                    for line in dev_result.stdout.strip().split('\n'):
                        if '/' in line:
                            target = line.split()[0]
                            break
        except Exception:
            pass
        if not target or target == 'AUTO':
            target = '192.168.1.0/24'
    logger.info(f"Starting scan {scan_id}: type={scan_type}, target={target}")

    db.execute("UPDATE scans SET status = 'running' WHERE id = ?", (scan_id,))
    db.commit()

    try:
        if scan_type in ('arp', 'full'):
            # ARP scan
            devices = scan_arp(network=target)
            for dev in devices:
                existing = db.execute(
                    "SELECT id FROM devices WHERE ip_address = ?", (dev['ip_address'],)
                ).fetchone()
                now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')
                if existing:
                    db.execute(
                        "UPDATE devices SET last_seen = ?, is_online = 1, updated_at = ? WHERE id = ?",
                        (now, now, existing['id'])
                    )
                else:
                    import uuid
                    dev_id = str(uuid.uuid4())
                    db.execute(
                        """INSERT INTO devices (id, ip_address, mac_address, vendor, first_seen, last_seen, is_online)
                           VALUES (?, ?, ?, ?, ?, ?, 1)""",
                        (dev_id, dev['ip_address'], dev['mac_address'], dev.get('vendor', ''), now, now)
                    )
            logger.info(f"ARP scan found {len(devices)} devices")

        if scan_type in ('port_tcp', 'full'):
            # TCP port scan on all discovered devices
            hosts = db.execute("SELECT ip_address FROM devices WHERE is_online = 1").fetchall()
            port_range = os.environ.get('PORT_RANGES', '20-25,53,80,110,143,443,445,993,995,1433,1521,2049,3306,3389,5432,5900,6379,8080,8443,27017')
            for host in hosts:
                ports = scan_ports_tcp(host['ip_address'], port_range)
                for p in ports:
                    device = db.execute("SELECT id FROM devices WHERE ip_address = ?", (host['ip_address'],)).fetchone()
                    if device:
                        existing_port = db.execute(
                            "SELECT id FROM device_ports WHERE device_id = ? AND port = ? AND protocol = ?",
                            (device['id'], p['port'], p['protocol'])
                        ).fetchone()
                        now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')
                        if existing_port:
                            db.execute(
                                "UPDATE device_ports SET state = ?, service = ?, service_version = ?, last_seen = ? WHERE id = ?",
                                (p['state'], p['service'], p.get('service_version', ''), now, existing_port['id'])
                            )
                        else:
                            import uuid
                            db.execute(
                                """INSERT INTO device_ports (id, device_id, port, protocol, state, service, service_version, first_seen, last_seen)
                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                                (str(uuid.uuid4()), device['id'], p['port'], p['protocol'],
                                 p['state'], p['service'], p.get('service_version', ''), now, now)
                            )
                db.commit()

        if scan_type in ('os', 'full'):
            hosts = db.execute("SELECT ip_address, id FROM devices WHERE is_online = 1").fetchall()
            for host in hosts:
                os_info = detect_os(host['ip_address'])
                if os_info:
                    db.execute(
                        "UPDATE devices SET os_detected = ?, os_version = ? WHERE id = ?",
                        (os_info['os_detected'], os_info.get('os_version', ''), host['id'])
                    )
                db.commit()

        now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')
        device_count = db.execute("SELECT COUNT(*) as c FROM devices").fetchone()['c']
        port_count = db.execute("SELECT COUNT(*) as c FROM device_ports").fetchone()['c']
        db.execute(
            "UPDATE scans SET status = 'completed', completed_at = ?, devices_found = ?, ports_found = ? WHERE id = ?",
            (now, device_count, port_count, scan_id)
        )
        db.commit()
        logger.info(f"Scan {scan_id} completed")

    except Exception as e:
        logger.error(f"Scan {scan_id} failed: {e}")
        db.execute(
            "UPDATE scans SET status = 'failed', error = ?, completed_at = ? WHERE id = ?",
            (str(e), datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'), scan_id)
        )
        db.commit()


def run_continuous():
    """Continuous ARP monitoring for new/lost devices."""
    known_ips = set()

    while True:
        try:
            db = get_db()
            active_ips = {d['ip_address'] for d in scan_arp(timeout=2)}
            now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')

            for ip in active_ips:
                dev = db.execute("SELECT id FROM devices WHERE ip_address = ?", (ip,)).fetchone()
                if dev:
                    db.execute("UPDATE devices SET last_seen = ?, is_online = 1 WHERE id = ?", (now, dev['id']))
                # New devices are discovered via ARP scan, not continuous monitoring

            # Check for devices that disappeared
            db_devices = db.execute("SELECT id, ip_address FROM devices WHERE is_online = 1").fetchall()
            for dev in db_devices:
                if dev['ip_address'] not in active_ips:
                    logger.info(f"Device {dev['ip_address']} went offline")
                    db.execute("UPDATE devices SET is_online = 0, updated_at = ? WHERE id = ?", (now, dev['id']))

            db.commit()
        except Exception as e:
            logger.error(f"Continuous monitoring error: {e}")

        time.sleep(60)  # Check every 60 seconds


def main():
    logger.info("NetViren Scanner Worker starting...")

    # Start continuous ARP monitoring in background thread
    monitor = threading.Thread(target=run_continuous, daemon=True)
    monitor.start()
    logger.info("Continuous ARP monitoring started")

    # Main scan job loop
    while True:
        db = get_db()
        try:
            scans = get_pending_scans(db)
            for scan in scans:
                execute_scan(db, scan)
        except Exception as e:
            logger.error(f"Main loop error: {e}")
        finally:
            db.close()

        time.sleep(10)  # Poll every 10 seconds


if __name__ == '__main__':
    main()
