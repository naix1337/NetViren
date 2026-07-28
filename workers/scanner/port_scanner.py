import nmap
from typing import List, Dict


def scan_ports_tcp(target: str, port_range: str = "1-1000") -> List[Dict]:
    """Perform TCP port scan using python-nmap."""
    nm = nmap.PortScanner()
    nm.scan(target, port_range, arguments='-sT -T4')

    ports = []
    if target in nm.all_hosts():
        for proto in nm[target].all_protocols():
            port_data = nm[target][proto]
            for port, data in port_data.items():
                ports.append({
                    'port': port,
                    'protocol': proto,
                    'state': data.get('state', 'unknown'),
                    'service': data.get('name', ''),
                    'service_version': data.get('version', ''),
                })
    return ports


def scan_ports_udp(target: str, port_range: str = "1-500") -> List[Dict]:
    """Perform UDP port scan."""
    nm = nmap.PortScanner()
    nm.scan(target, port_range, arguments='-sU -T4')

    ports = []
    if target in nm.all_hosts():
        for proto in nm[target].all_protocols():
            port_data = nm[target][proto]
            for port, data in port_data.items():
                ports.append({
                    'port': port,
                    'protocol': proto,
                    'state': data.get('state', 'unknown'),
                    'service': data.get('name', ''),
                    'service_version': data.get('version', ''),
                })
    return ports
