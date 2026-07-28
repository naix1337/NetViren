import nmap
import ipaddress
from typing import Optional, Dict


def _validate_target(target: str) -> None:
    """Validate that target is a valid IP or CIDR, not an nmap flag."""
    if target.startswith('-'):
        raise ValueError(f"Invalid scan target (looks like a flag): {target}")
    try:
        ipaddress.ip_network(target, strict=False)
    except ValueError:
        raise ValueError(f"Invalid scan target: {target}")


def detect_os(target: str) -> Optional[Dict]:
    """Perform OS detection using Nmap OS fingerprinting."""
    _validate_target(target)
    nm = nmap.PortScanner()
    try:
        nm.scan(target, arguments='-O -T4')
        if target in nm.all_hosts() and 'osmatch' in nm[target]:
            matches = nm[target]['osmatch']
            if matches:
                best = matches[0]
                return {
                    'os_detected': best.get('name', ''),
                    'os_version': best.get('osclass', [{}])[0].get('osgen', '') if best.get('osclass') else '',
                    'accuracy': best.get('accuracy', '0'),
                }
    except Exception:
        pass
    return None
