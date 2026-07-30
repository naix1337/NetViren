#!/usr/bin/env python3
"""NetViren Packet Capture Worker. Polls DB for pending packet capture jobs and executes them."""

import os
import sys
import time
import logging
from datetime import datetime
from typing import List, Dict, Tuple

from db import get_db

logging.basicConfig(
    level=getattr(logging, os.environ.get('LOG_LEVEL', 'info').upper()),
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger('netviren-packet-capture')

PCAP_DIR = os.environ.get('PCAP_DIR', '/var/lib/netviren/captures')


def get_pending_captures(db) -> List[Dict]:
    """Fetch packet captures with status 'capturing'."""
    cur = db.execute(
        "SELECT * FROM packet_captures WHERE status = 'capturing' ORDER BY started_at ASC LIMIT 5"
    )
    return [dict(row) for row in cur.fetchall()]


def start_capture(capture: Dict) -> Tuple:
    """Start a packet capture using scapy and save to a PCAP file.

    Returns the path to the saved PCAP file, or None on failure.
    """
    capture_id = capture['id']
    interface = capture.get('interface_name') or 'eth0'
    duration = capture.get('duration_seconds') or 300
    source_ip = capture.get('source_ip', '0.0.0.0')

    # Build a display filter for source IP if specified
    filter_expr = f"host {source_ip}" if source_ip and source_ip != '0.0.0.0' else None

    # Ensure capture directory exists
    os.makedirs(PCAP_DIR, exist_ok=True)

    pcap_path = os.path.join(PCAP_DIR, f"capture_{capture_id}.pcap")

    logger.info(f"Starting capture {capture_id} on interface {interface} for {duration}s, saving to {pcap_path}")

    try:
        from scapy.all import conf, sniff, wrpcap

        # Use scapy sniff with timeout
        packets = sniff(
            iface=interface,
            filter=filter_expr,
            timeout=int(duration),
            store=True,
        )
        wrpcap(pcap_path, packets)
        packet_count = len(packets)
        file_size = os.path.getsize(pcap_path) if os.path.exists(pcap_path) else 0
        logger.info(f"Capture {capture_id} complete: {packet_count} packets, {file_size} bytes")
        return pcap_path, packet_count, file_size
    except ImportError:
        logger.warning("scapy not available, falling back to pyshark/tshark")
        return _capture_with_pyshark(capture_id, interface, duration, filter_expr, pcap_path)
    except Exception as e:
        logger.error(f"Capture {capture_id} failed with scapy: {e}")
        return None, 0, 0


def _capture_with_pyshark(capture_id: str, interface: str, duration: int,
                          filter_expr: str, pcap_path: str):
    """Fallback capture using pyshark (tshark backend)."""
    try:
        import pyshark

        # Use pyshark's LiveCapture with output_file to write PCAP directly
        bpf_filter = filter_expr
        capture = pyshark.LiveCapture(
            interface=interface,
            bpf_filter=bpf_filter,
            output_file=pcap_path,
        )
        capture.sniff(timeout=duration)
        capture.close()

        if os.path.exists(pcap_path):
            packet_count = _count_packets_pyshark(pcap_path)
            file_size = os.path.getsize(pcap_path)
        else:
            packet_count = 0
            file_size = 0
        logger.info(f"Capture {capture_id} complete (pyshark): {packet_count} packets, {file_size} bytes")
        return pcap_path, packet_count, file_size
    except ImportError:
        logger.error("Neither scapy nor pyshark are available. Install one of: scapy>=2.6.0, pyshark>=0.6.0")
        return None, 0, 0
    except Exception as e:
        logger.error(f"Capture {capture_id} failed with pyshark: {e}")
        return None, 0, 0


def _count_packets_pyshark(pcap_path: str) -> int:
    """Count packets in a PCAP file using pyshark."""
    try:
        import pyshark
        cap = pyshark.FileCapture(pcap_path, only_summaries=True)
        count = sum(1 for _ in cap)
        cap.close()
        return count
    except Exception:
        return 0


def update_capture_status(db, capture_id: str, status: str,
                          pcap_path: str = None, packet_count: int = 0,
                          file_size: int = 0, error: str = None):
    """Update the status and metadata of a packet capture record."""
    now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')
    if status in ('completed', 'error'):
        if error:
            db.execute(
                """UPDATE packet_captures
                   SET status = ?, completed_at = ?, file_path = ?, file_size = ?,
                       packet_count = ?, notes = ?
                   WHERE id = ?""",
                (status, now, pcap_path or '', file_size, packet_count, error, capture_id)
            )
        else:
            db.execute(
                """UPDATE packet_captures
                   SET status = ?, completed_at = ?, file_path = ?, file_size = ?,
                       packet_count = ?
                   WHERE id = ?""",
                (status, now, pcap_path or '', file_size, packet_count, capture_id)
            )
    else:
        db.execute(
            "UPDATE packet_captures SET status = ? WHERE id = ?",
            (status, capture_id)
        )
    db.commit()


def process_capture(db, capture: Dict):
    """Process a single packet capture job."""
    capture_id = capture['id']
    logger.info(f"Processing capture {capture_id}")

    try:
        result = start_capture(capture)

        if result[0] is None:
            # Capture failed
            update_capture_status(
                db, capture_id, 'error',
                error=f"Capture failed: no packets captured or backend unavailable"
            )
            return

        pcap_path, packet_count, file_size = result
        update_capture_status(
            db, capture_id, 'completed',
            pcap_path=pcap_path,
            packet_count=packet_count,
            file_size=file_size,
        )
        logger.info(f"Capture {capture_id} processed successfully")

    except Exception as e:
        logger.error(f"Capture {capture_id} failed: {e}")
        try:
            update_capture_status(
                db, capture_id, 'error',
                error=str(e)
            )
        except Exception as db_err:
            logger.error(f"Failed to update capture status for {capture_id}: {db_err}")


def main():
    logger.info("NetViren Packet Capture Worker starting...")

    # Ensure PCAP directory exists
    os.makedirs(PCAP_DIR, exist_ok=True)

    # Main capture job loop
    while True:
        try:
            db = get_db()
            captures = get_pending_captures(db)
            for capture in captures:
                process_capture(db, capture)
        except Exception as e:
            logger.error(f"Main loop error: {e}")
        finally:
            try:
                db.close()
            except Exception:
                pass

        time.sleep(15)  # Poll every 15 seconds


if __name__ == '__main__':
    main()
