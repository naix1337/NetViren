#!/bin/bash
# Creates /etc/netviren/login.txt in a Proxmox container
CT_ID="${1:-100}"
IP=$(pct exec "$CT_ID" -- hostname -I 2>/dev/null | awk '{print $1}')
pct exec "$CT_ID" -- bash -c "mkdir -p /etc/netviren && cat > /etc/netviren/login.txt << 'EOF'
═══════════════════════════════════════════
  NetViren - Login Credentials
═══════════════════════════════════════════

  Dashboard:   http://${IP}:3001
  Benutzer:    admin
  Passwort:    Specht2025!

  Services:
    netviren-api            Port 4000
    netviren-frontend       Port 3001
    netviren-scanner        (Python Worker)

  Logs:
    journalctl -u netviren-api -f
    journalctl -u netviren-frontend -f

  Zugriff:
    pct enter ${CT_ID}

═══════════════════════════════════════════
EOF
chmod 600 /etc/netviren/login.txt"
echo "✓ /etc/netviren/login.txt created"
cat /etc/netviren/login.txt
