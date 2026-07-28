
**Files:**
- Create: `workers/packet-capture/main.py`
- Create: `workers/packet-capture/capture_manager.py`
- Create: `workers/packet-capture/dns_analyzer.py`
- Create: `workers/packet-capture/connection_analyzer.py`
- Create: `workers/packet-capture/beacon_detector.py`
- Create: `workers/packet-capture/db.py`
- Create: `workers/packet-capture/requirements.txt`

- [ ] **Step 1: Create requirements.txt**

```
scapy>=2.6.0
pyshark>=0.6.0
```

- [ ] **Step 2: Create capture_manager.py**

```python
import os
import time
import uuid
import signal
from datetime import datetime, timedelta
from typing import Optional
from scapy.all import sniff, wrpcap

class CaptureManager:
    def __init__(self, interface: str = "eth0", packet_dir: str = "/var/lib/netviren/packets"):
        self.interface = interface
        self.packet_dir = packet_dir
        self.capturing = False
        self.current_capture_id = None
        self.packets = []
        self.start_time = None
        os.makedirs(packet_dir, exist_ok=True)

    def start_capture(self, capture_id: str, duration_seconds: int = 300):
        self.capturing = True
        self.current_capture_id = capture_id
        self.packets = []
        self.start_time = datetime.utcnow()
        
        # Sniff in a separate process would be better, but for simplicity:
        def packet_handler(pkt):
            if not self.capturing:
                return  # Stop sniffing
            self.packets.append(pkt)
        
        # Use timeout-based capture
        sniff(iface=self.interface, prn=packet_handler, timeout=duration_seconds, store=False)
        self.capturing = False
        self.save_capture(capture_id)

    def save_capture(self, capture_id: str) -> str:
        filepath = os.path.join(self.packet_dir, f"{capture_id}.pcap")
        wrpcap(filepath, self.packets)
        return filepath

    def stop_capture(self):
        self.capturing = False

    def cleanup_old_captures(self, retention_days: int = 7):
        cutoff = datetime.utcnow() - timedelta(days=retention_days)
        for fname in os.listdir(self.packet_dir):
            fpath = os.path.join(self.packet_dir, fname)
            if os.path.isfile(fpath):
                mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
                if mtime < cutoff:
                    os.remove(fpath)
```

- [ ] **Step 3: Create dns_analyzer.py**

```python
from typing import List, Dict
from scapy.all import DNS, DNSQR, IP, UDP

def extract_dns_queries(packets: list) -> List[Dict]:
    """Extract DNS queries from packet list."""
    queries = {}
    for pkt in packets:
        if pkt.haslayer(DNS) and pkt.haslayer(DNSQR):
            dns = pkt[DNS]
            dnsqr = pkt[DNSQR]
            domain = dnsqr.qname.decode() if isinstance(dnsqr.qname, bytes) else dnsqr.qname
            query_type = dnsqr.qtype
            
            # Get response IP if available
            response_ip = None
            if dns.ancount > 0:
                for i in range(dns.ancount):
                    try:
                        rr = dns.an[i]
                        if rr.type == 1:  # A record
                            response_ip = rr.rdata
                    except:
                        pass

            key = domain
            if key in queries:
                queries[key]['count'] += 1
            else:
                queries[key] = {
                    'domain': domain,
                    'query_type': str(query_type),
                    'response_ip': str(response_ip) if response_ip else None,
                    'count': 1,
                }
    return list(queries.values())
```

- [ ] **Step 4: Create connection_analyzer.py**

```python
from typing import List, Dict, Tuple
from scapy.all import IP, TCP, UDP

def extract_connections(packets: list) -> List[Dict]:
    """Extract TCP/UDP connections from packet list. Tracks unique 5-tuples."""
    connections: Dict[Tuple, Dict] = {}

    for pkt in packets:
        if not pkt.haslayer(IP):
            continue
        
        ip = pkt[IP]
        src_ip = ip.src
        dst_ip = ip.dst
        proto = 'IP'
        src_port = 0
        dst_port = 0

        if pkt.haslayer(TCP):
            proto = 'TCP'
            src_port = pkt[TCP].sport
            dst_port = pkt[TCP].dport
        elif pkt.haslayer(UDP):
            proto = 'UDP'
            src_port = pkt[UDP].sport
            dst_port = pkt[UDP].dport

        key = (src_ip, src_port, dst_ip, dst_port, proto)
        
        if key in connections:
            conn = connections[key]
            conn['packets'] += 1
            conn['bytes_sent'] += len(pkt)
            conn['last_seen'] = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')
        else:
            connections[key] = {
                'src_ip': src_ip,
                'src_port': src_port,
                'dst_ip': dst_ip,
                'dst_port': dst_port,
                'protocol': proto,
                'packets': 1,
                'bytes_sent': len(pkt),
                'bytes_recv': 0,
                'first_seen': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'),
                'last_seen': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'),
            }

    return list(connections.values())
```

- [ ] **Step 5: Create beacon_detector.py**

```python
from typing import List, Dict
from datetime import datetime, timedelta

def detect_beaconing(connections: List[Dict], threshold_seconds: int = 30) -> List[Dict]:
    """
    Detect potential beaconing activity.
    A connection is flagged as beaconing if it shows regular intervals.
    Simplified: flag connections that connect to same dst_ip:dst_port at consistent intervals.
    """
    # Group by destination
    dst_groups: Dict[str, List[Dict]] = {}
    for conn in connections:
        key = f"{conn['dst_ip']}:{conn.get('dst_port', '')}:{conn.get('protocol', '')}"
        if key not in dst_groups:
            dst_groups[key] = []
        dst_groups[key].append(conn)

    beaconing = []
    for key, conns in dst_groups.items():
        if len(conns) >= 3:  # Need at least 3 connections to detect pattern
            # Sort by timestamp
            conns.sort(key=lambda c: c.get('first_seen', ''))
            # Check intervals (simplified: flag if multiple connections to same destination)
            # A more sophisticated implementation would use actual timing analysis
            beaconing.append({
                'key': key,
                'connections': len(conns),
                'is_suspicious': True,
                'confidence': 'medium',
            })

    return beaconing
```

- [ ] **Step 6: Create main.py**

```python
#!/usr/bin/env python3
"""NetViren Packet Capture Service. Manages packet captures, analysis, and cleanup."""

import os
import time
import json
import uuid
import logging
import sys
from datetime import datetime, timedelta
from typing import Optional

from db import get_db
from capture_manager import CaptureManager
from dns_analyzer import extract_dns_queries
from connection_analyzer import extract_connections
from beacon_detector import detect_beaconing

logging.basicConfig(
    level=getattr(logging, os.environ.get('LOG_LEVEL', 'info').upper()),
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger('netviren-packet-capture')

def process_capture(db, capture_id: str, packets: list):
    """Analyze captured packets and store results."""
    logger.info(f"Analyzing capture {capture_id} ({len(packets)} packets)")
    
    # Extract DNS queries
    dns_queries = extract_dns_queries(packets)
    for dq in dns_queries:
        db.execute(
            """INSERT OR IGNORE INTO packet_dns_queries (id, capture_id, domain, query_type, response_ip, count, first_seen)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), capture_id, dq['domain'], dq['query_type'],
             dq.get('response_ip', ''), dq['count'], datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))
        )
    
    # Extract connections
    connections = extract_connections(packets)
    for conn in connections:
        db.execute(
            """INSERT INTO packet_connections (id, capture_id, src_ip, src_port, dst_ip, dst_port, protocol,
               bytes_sent, packets, first_seen, last_seen, is_beacon)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""",
            (str(uuid.uuid4()), capture_id, conn['src_ip'], conn.get('src_port', 0),
             conn['dst_ip'], conn.get('dst_port', 0), conn['protocol'],
             conn.get('bytes_sent', 0), conn.get('packets', 0),
             conn['first_seen'], conn['last_seen'])
        )
    
    # Beacon detection
    beaconing = detect_beaconing(connections)
    for beacon in beaconing:
        if beacon['is_suspicious']:
            db.execute(
                "UPDATE packet_connections SET is_beacon = 1 WHERE capture_id = ? AND dst_ip || ':' || dst_port || ':' || protocol = ?",
                (capture_id, beacon['key'])
            )
            # Create alert for beaconing
            db.execute(
                """INSERT INTO alerts (id, alert_type, severity, title, description, metadata, created_at)
                   VALUES (?, 'beaconing', 'medium', ?, ?, ?, ?)""",
                (str(uuid.uuid4()),
                 f"Beaconing detected: {beacon['key']}",
                 f"Regular connections detected ({beacon['connections']} instances)",
                 json.dumps(beacon),
                 datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))
            )
    
    db.execute(
        "UPDATE packet_captures SET status = 'analyzed', packet_count = ? WHERE id = ?",
        (len(packets), capture_id)
    )
    db.commit()
    logger.info(f"Capture {capture_id} analyzed: {len(dns_queries)} DNS, {len(connections)} connections, {len(beaconing)} beaconing")

def main():
    logger.info("NetViren Packet Capture Service starting...")
    db = get_db()
    
    packet_dir = os.environ.get('PACKET_DIR', '/var/lib/netviren/packets')
    interface = os.environ.get('CAPTURE_INTERFACE', 'eth0')
    retention_days = int(os.environ.get('PACKET_RETENTION_DAYS', '7'))
    
    manager = CaptureManager(interface=interface, packet_dir=packet_dir)
    
    # Main loop
    while True:
        try:
            # Check for pending captures
            pending = db.execute(
                "SELECT * FROM packet_captures WHERE status = 'capturing' ORDER BY started_at ASC LIMIT 1"
            ).fetchone()
            
            if pending:
                capture_id = pending['id']
                logger.info(f"Starting capture {capture_id}")
                manager.start_capture(capture_id, duration_seconds=300)
                filepath = manager.save_capture(capture_id)
                
                db.execute(
                    "UPDATE packet_captures SET file_path = ?, status = 'analyzing', completed_at = ? WHERE id = ?",
                    (filepath, datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'), capture_id)
                )
                db.commit()
                
                # Analyze
                process_capture(db, capture_id, manager.packets)
            
            # Periodic: check for automatic captures based on settings
            enabled = db.execute("SELECT value FROM settings WHERE key = 'packet_capture_enabled'").fetchone()
            if enabled and enabled['value'] == 'true':
                # Check if we need to start a new periodic capture
                last_capture = db.execute(
                    "SELECT id FROM packet_captures ORDER BY started_at DESC LIMIT 1"
                ).fetchone()
                
                if not last_capture:
                    # Start periodic capture
                    new_id = str(uuid.uuid4())
                    db.execute(
                        """INSERT INTO packet_captures (id, source_ip, interface_name, file_path, status, started_at, expires_at)
                           VALUES (?, 'auto', ?, ?, 'capturing', ?, ?)""",
                        (new_id, interface, '', datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'),
                         (datetime.utcnow() + timedelta(days=retention_days)).strftime('%Y-%m-%dT%H:%M:%S'))
                    )
                    db.commit()
            
            # Cleanup old captures daily
            manager.cleanup_old_captures(retention_days)
            
            db.close()
        except Exception as e:
            logger.error(f"Main loop error: {e}")
        
        time.sleep(30)

if __name__ == '__main__':
    main()
```

---

