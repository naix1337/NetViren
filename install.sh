#!/usr/bin/env bash
set -euo pipefail

# ═══════════════════════════════════════════════
# NetViren - Network Security Platform
# Install Script
# ═══════════════════════════════════════════════
# One-liner:
#   bash <(curl -sSL https://github.com/naix1337/network-analyser/raw/master/install.sh)
# ═══════════════════════════════════════════════

REPO="https://github.com/naix1337/networkvirusscanner.git"
NETVIREN_DIR="/opt/netviren"
DB_DIR="/var/lib/netviren/db"
PACKET_DIR="/var/lib/netviren/packets"
LOG_DIR="/var/log/netviren"
NODE_VERSION="22"
CADDY_WEBROOT="/var/www/ovas"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${CYAN}[NetViren]${NC} $1"; }
ok()   { echo -e "${GREEN}  ✓${NC} $1"; }
warn() { echo -e "${YELLOW}  ⚠${NC} $1"; }
fail() { echo -e "${RED}  ✗${NC} $1"; exit 1; }

# ──────────────────────────────────────────────
# Prüfe root
# ──────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then fail "Must run as root (sudo)"; fi

log "Starting NetViren installation..."

# ──────────────────────────────────────────────
# System-Dependencies
# ──────────────────────────────────────────────
log "Installing system dependencies..."
apt-get update -qq
apt-get install -y -qq build-essential libpcap-dev nmap arp-scan python3 python3-pip curl wget git openssl
ok "System dependencies installed"

# ──────────────────────────────────────────────
# Node.js
# ──────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  log "Installing Node.js ${NODE_VERSION}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
fi
ok "Node.js $(node -v) installed"

# ──────────────────────────────────────────────
# Python
# ──────────────────────────────────────────────
log "Installing Python dependencies..."
pip3 install scapy python-nmap 2>/dev/null || warn "Some Python packages may not have installed"

# Nmap capabilities for scanner
PYTHON_BIN=$(which python3)
setcap cap_net_raw,cap_net_admin+ep "$PYTHON_BIN" 2>/dev/null || true

# ──────────────────────────────────────────────
# Clone Repository
# ──────────────────────────────────────────────
if [[ -d "$NETVIREN_DIR/.git" ]]; then
  log "Updating existing installation..."
  cd "$NETVIREN_DIR" && git pull
else
  log "Cloning NetViren..."
  mkdir -p "$NETVIREN_DIR"
  git clone --depth 1 "$REPO" "$NETVIREN_DIR"
fi
cd "$NETVIREN_DIR"
ok "Repository ready at $NETVIREN_DIR"

# ──────────────────────────────────────────────
# Directories
# ──────────────────────────────────────────────
mkdir -p "$DB_DIR" "$PACKET_DIR" "$LOG_DIR"

# ──────────────────────────────────────────────
# Environment (.env)
# ──────────────────────────────────────────────
if [[ -f "$NETVIREN_DIR/.env" ]]; then
  warn ".env exists — keeping existing"
else
  log "Generating .env with secure secrets..."
  AUTH_SECRET=$(openssl rand -hex 32)
  cat > "$NETVIREN_DIR/.env" << ENVEOF
DATABASE_PATH=${DB_DIR}/netviren.db
AUTH_SECRET=${AUTH_SECRET}
API_PORT=4000
AGENT_HANDLER_PORT=4001
FRONTEND_URL=http://localhost:3001
NODE_ENV=production
LOG_LEVEL=info
ENVEOF
  ok ".env created"
fi

# ──────────────────────────────────────────────
# npm Install + Build
# ──────────────────────────────────────────────
log "Installing npm dependencies..."
cd "$NETVIREN_DIR"
npm ci 2>&1 | tail -5

log "Building API..."
cd "$NETVIREN_DIR/packages/api"
npx tsc 2>&1 | tail -3

log "Building Frontend..."
cd "$NETVIREN_DIR/packages/frontend"
npx next build 2>&1 | tail -10

# Static files in standalone
if [[ -d ".next/static" && -d ".next/standalone/packages/frontend/.next" ]]; then
  cp -r .next/static .next/standalone/packages/frontend/.next/ 2>/dev/null || true
fi
ok "Build complete"

# ──────────────────────────────────────────────
# Database Init + Admin User
# ──────────────────────────────────────────────
log "Initializing database..."
cd "$NETVIREN_DIR/packages/api"
timeout 5 node dist/index.js 2>/dev/null || true
ok "Database initialized"

echo ""
echo -e "${YELLOW}────────── Create Admin User ──────────${NC}"
read -p "  Username [admin]: " ADMIN_USER
ADMIN_USER=${ADMIN_USER:-admin}
while true; do
  read -s -p "  Password: " ADMIN_PASS
  echo ""
  if [[ ${#ADMIN_PASS} -lt 8 ]]; then
    echo -e "${RED}  Password must be at least 8 characters${NC}"
    continue
  fi
  read -s -p "  Confirm: " ADMIN_PASS2
  echo ""
  if [[ "$ADMIN_PASS" != "$ADMIN_PASS2" ]]; then
    echo -e "${RED}  Passwords do not match${NC}"
    continue
  fi
  break
done

export ADMIN_PASS ADMIN_USER ADMIN_DB_DIR="${DB_DIR}"

node -e "
const b=require('bcryptjs'), D=require('better-sqlite3'),
d=new D(process.env.ADMIN_DB_DIR + '/netviren.db');
const {randomBytes}=require('crypto'), id=randomBytes(16).toString('hex');
const h=b.hashSync(process.env.ADMIN_PASS,12);
d.prepare('INSERT OR REPLACE INTO users(id,username,password_hash,role,is_active) VALUES(?,?,?,?,?)')
 .run(id,process.env.ADMIN_USER,h,'admin',1);
console.log('  ✓ Admin user created');
"
ok "Admin user: ${ADMIN_USER}"

# ──────────────────────────────────────────────
# Systemd Services
# ──────────────────────────────────────────────
log "Configuring systemd services..."

AUTH_SECRET=$(grep AUTH_SECRET "$NETVIREN_DIR/.env" | cut -d= -f2-)

# API
cat > /etc/systemd/system/netviren-api.service << EOF
[Unit]
Description=NetViren API Server
After=network.target
[Service]
Type=simple
User=root
WorkingDirectory=${NETVIREN_DIR}/packages/api
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=DATABASE_PATH=${DB_DIR}/netviren.db
Environment=AUTH_SECRET=${AUTH_SECRET}
Environment=API_PORT=4000
Environment=FRONTEND_URL=http://localhost:3001
Environment=LOG_LEVEL=info
AmbientCapabilities=CAP_NET_RAW CAP_NET_ADMIN
LimitNOFILE=65536
[Install]
WantedBy=multi-user.target
EOF

# Frontend
cat > /etc/systemd/system/netviren-frontend.service << EOF
[Unit]
Description=NetViren Frontend (Next.js)
After=network.target netviren-api.service
[Service]
Type=simple
User=root
WorkingDirectory=${NETVIREN_DIR}/packages/frontend/.next/standalone/packages/frontend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3001
[Install]
WantedBy=multi-user.target
EOF

# Scanner
cat > /etc/systemd/system/netviren-scanner.service << EOF
[Unit]
Description=NetViren Scanner Worker
After=network.target netviren-api.service
[Service]
Type=simple
User=root
WorkingDirectory=${NETVIREN_DIR}/workers/scanner
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=10
Environment=DATABASE_PATH=${DB_DIR}/netviren.db
Environment=PORT_RANGES=20-25,53,80,110,143,443,445,993,995,1433,1521,2049,3306,3389,5432,5900,6379,8080,8443,27017
AmbientCapabilities=CAP_NET_RAW CAP_NET_ADMIN
[Install]
WantedBy=multi-user.target
EOF

# Packet Capture
cat > /etc/systemd/system/netviren-packet-capture.service << EOF
[Unit]
Description=NetViren Packet Capture Worker
After=network.target netviren-api.service
[Service]
Type=simple
User=root
WorkingDirectory=${NETVIREN_DIR}/workers/packet-capture
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=10
Environment=DATABASE_PATH=${DB_DIR}/netviren.db
Environment=PACKET_DIR=${PACKET_DIR}
AmbientCapabilities=CAP_NET_RAW CAP_NET_ADMIN
[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
for svc in netviren-api netviren-frontend netviren-scanner netviren-packet-capture; do
  systemctl enable "$svc" 2>/dev/null || true
done
ok "Systemd services configured"

# ──────────────────────────────────────────────
# Caddy (optional)
# ──────────────────────────────────────────────
if command -v caddy &>/dev/null; then
  log "Configuring Caddy reverse proxy..."
  PUBLIC_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "your-domain.com")
  cat > /etc/caddy/Caddyfile << CADDYEOF
# NetViren - Main Application
${PUBLIC_IP} {
	log {
		output file /var/log/caddy/netviren.access.log
		format json
	}
	reverse_proxy 127.0.0.1:3001
	encode gzip
	header {
		Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
		X-Content-Type-Options nosniff
		X-Frame-Options DENY
		Referrer-Policy "strict-origin-when-cross-origin"
	}
}
CADDYEOF
  caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || caddy start --config /etc/caddy/Caddyfile 2>/dev/null || true
  ok "Caddy configured"
else
  warn "Caddy not installed. Install: apt install caddy"
fi

# ──────────────────────────────────────────────
# Start Services
# ──────────────────────────────────────────────
log "Starting services..."
systemctl start netviren-api netviren-frontend netviren-scanner netviren-packet-capture 2>/dev/null || true
sleep 3

# ──────────────────────────────────────────────
# Done
# ──────────────────────────────────────────────
PUBLIC_IP=${PUBLIC_IP:-$(curl -s https://api.ipify.org 2>/dev/null || echo "localhost")}
echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  NetViren installation complete!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${CYAN}Dashboard:${NC}  http://${PUBLIC_IP}:3001"
echo -e "  ${CYAN}Login:${NC}      ${ADMIN_USER} / <your-password>"
echo ""
echo -e "  ${CYAN}Services:${NC}"
echo "    netviren-api              (Fastify API)"
echo "    netviren-frontend         (Next.js Dashboard)"
echo "    netviren-scanner          (Network Scanner)"
echo "    netviren-packet-capture   (Packet Capture)"
echo ""
echo -e "  ${CYAN}Logs:${NC}"
echo "    journalctl -u netviren-api -f"
echo "    journalctl -u netviren-frontend -f"
echo ""
echo -e "  ${YELLOW}Next steps:${NC}"
echo "    1. Trigger a scan:"
echo "       curl -X POST http://localhost:4000/api/scans -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' -d '{\"scanType\":\"arp\",\"target\":\"YOUR_SUBNET/24\"}'"
echo "    2. Configure alerts in the dashboard"
echo "    3. Deploy agents for endpoint monitoring"
echo ""
