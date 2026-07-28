import ipaddress
from typing import List, Dict
from scapy.all import ARP, Ether, srp


def scan_arp(network: str = "192.168.1.0/24", timeout: int = 3) -> List[Dict]:
    """Perform ARP scan on local network. Returns list of discovered devices."""
    arp = ARP(pdst=network)
    ether = Ether(dst="ff:ff:ff:ff:ff:ff")
    packet = ether / arp
    result = srp(packet, timeout=timeout, verbose=0)[0]

    devices = []
    for sent, received in result:
        devices.append({
            'ip_address': received.psrc,
            'mac_address': received.hwsrc,
            'vendor': '',  # Could be enriched via MAC OUI lookup
            'first_seen': '',  # Set by caller
            'last_seen': '',
            'is_online': True,
        })
    return devices
