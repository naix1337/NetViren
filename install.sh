#!/bin/bash
set -e

NETVIREN_USER="netviren"
NETVIREN_DIR="/opt/netviren"
DB_DIR="/var/lib/netviren/db"
PACKET_DIR="/var/lib/netviren/packets"
LOG_DIR="/var/log/netviren"
NODE_VERSION="22"

echo "============================================"
echo "  NetViren Network Security Platform"
echo "  Installation Script"
echo "============================================"

if [ "$EUID" -ne 0 ]; then echo "Please run as root"; exit 1; fi

echo "[1/8] Installing system dependencies..."
apt-get update
apt-get install -y build-essential libpcap-dev nmap arp-scan python3 python3-pip nginx curl wget

echo "[2/8] Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

echo "[3/8] Creating system user and directories..."
id -u ${NETVIREN_USER} &>/dev/null || useradd -r -s /usr/sbin/nologin -m -d ${NETVIREN_DIR} ${NETVIREN_USER}
mkdir -p ${DB_DIR} ${PACKET_DIR} ${LOG_DIR}
chown -R ${NETVIREN_USER}:${NETVIREN_USER} /var/lib/netviren ${LOG_DIR}

echo "[4/8] Installing Node.js dependencies..."
cd /opt/netviren && npm ci && npm run build

echo "[5/8] Installing Python dependencies..."
pip3 install -r /opt/netviren/workers/scanner/requirements.txt
pip3 install -r /opt/netviren/workers/packet-capture/requirements.txt

echo "[6/8] Setting capabilities..."
PYTHON_BIN=$(which python3)
setcap cap_net_raw,cap_net_admin+ep ${PYTHON_BIN}

echo "[7/8] Configuring systemd services..."
for service in netviren-api netviren-frontend netviren-scanner netviren-packet-capture netviren-agent-handler; do
  cp /opt/netviren/deploy/systemd/${service}.service /etc/systemd/system/
  systemctl enable ${service}
done

cat > /opt/netviren/.env << EOF
DATABASE_PATH=${DB_DIR}/netviren.db
AUTH_SECRET=$(openssl rand -hex 32)
API_PORT=4000
AGENT_HANDLER_PORT=4001
FRONTEND_URL=http://localhost:3000
NODE_ENV=production
EOF

echo "[8/8] Creating initial admin user..."
cd /opt/netviren/packages/api
read -p "Enter admin username: " ADMIN_USER
read -s -p "Enter admin password: " ADMIN_PASS
echo ""
npm run seed -- --username "${ADMIN_USER}" --password "${ADMIN_PASS}"

systemctl start netviren-api netviren-frontend netviren-scanner netviren-packet-capture netviren-agent-handler

echo "============================================"
echo "  NetViren Platform installed successfully!"
echo "  API: http://localhost:4000"
echo "  Frontend: http://localhost:3000"
echo "============================================"
