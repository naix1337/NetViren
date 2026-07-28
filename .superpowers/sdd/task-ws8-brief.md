## Workstream 8: Deployment

**Files:**
- Create: `deploy/systemd/netviren-api.service`
- Create: `deploy/systemd/netviren-frontend.service`
- Create: `deploy/systemd/netviren-scanner.service`
- Create: `deploy/systemd/netviren-packet-capture.service`
- Create: `deploy/systemd/netviren-agent-handler.service`
- Create: `deploy/nginx/netviren.conf`
- Create: `install.sh`

- [ ] **Step 1: Create systemd service files**

```
# deploy/systemd/netviren-api.service
[Unit]
Description=NetViren API Server
After=network.target

[Service]
Type=simple
User=netviren
WorkingDirectory=/opt/netviren/packages/api
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=DATABASE_PATH=/var/lib/netviren/db/netviren.db
Environment=AUTH_SECRET=<set-by-install-script>
Environment=API_PORT=4000
Environment=FRONTEND_URL=http://localhost:3000
AmbientCapabilities=CAP_NET_RAW CAP_NET_ADMIN
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

```
# deploy/systemd/netviren-frontend.service
[Unit]
Description=NetViren Frontend (Next.js)
After=network.target netviren-api.service

[Service]
Type=simple
User=netviren
WorkingDirectory=/opt/netviren/packages/frontend
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=NEXT_PUBLIC_API_URL=http://localhost:4000

[Install]
WantedBy=multi-user.target
```

```
# deploy/systemd/netviren-scanner.service
[Unit]
Description=NetViren Scanner Worker
After=network.target netviren-api.service

[Service]
Type=simple
User=netviren
WorkingDirectory=/opt/netviren/workers/scanner
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=10
Environment=DATABASE_PATH=/var/lib/netviren/db/netviren.db
Environment=PORT_RANGES=20-25,53,80,110,143,443,445,993,995,1433,1521,2049,3306,3389,5432,5900,6379,8080,8443,27017
AmbientCapabilities=CAP_NET_RAW CAP_NET_ADMIN

[Install]
WantedBy=multi-user.target
```

```
# deploy/systemd/netviren-packet-capture.service
[Unit]
Description=NetViren Packet Capture Service
After=network-online.target

[Service]
Type=simple
User=netviren
WorkingDirectory=/opt/netviren/workers/packet-capture
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=10
Environment=DATABASE_PATH=/var/lib/netviren/db/netviren.db
Environment=PACKET_DIR=/var/lib/netviren/packets
Environment=CAPTURE_INTERFACE=eth0
AmbientCapabilities=CAP_NET_RAW CAP_NET_ADMIN

[Install]
WantedBy=multi-user.target
```

```
# deploy/systemd/netviren-agent-handler.service
[Unit]
Description=NetViren Agent Handler
After=network.target netviren-api.service

[Service]
Type=simple
User=netviren
WorkingDirectory=/opt/netviren/packages/api
ExecStart=/usr/bin/node dist/agent-handler.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=DATABASE_PATH=/var/lib/netviren/db/netviren.db
Environment=AGENT_HANDLER_PORT=4001

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Create install.sh**

```bash
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

# Check root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root"
  exit 1
fi

echo "[1/8] Installing system dependencies..."
apt-get update
apt-get install -y \
  build-essential \
  libpcap-dev \
  nmap \
  arp-scan \
  python3 \
  python3-pip \
  python3-venv \
  nginx \
  curl \
  git \
  wget

# Install Node.js
echo "[2/8] Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y nodejs

echo "[3/8] Creating system user and directories..."
id -u ${NETVIREN_USER} &>/dev/null || useradd -r -s /usr/sbin/nologin -m -d ${NETVIREN_DIR} ${NETVIREN_USER}
mkdir -p ${DB_DIR} ${PACKET_DIR} ${LOG_DIR}
chown -R ${NETVIREN_USER}:${NETVIREN_USER} /var/lib/netviren ${LOG_DIR}

echo "[4/8] Installing Node.js dependencies..."
cd /opt/netviren
npm ci
npm run build

echo "[5/8] Installing Python dependencies..."
pip3 install -r /opt/netviren/workers/scanner/requirements.txt
pip3 install -r /opt/netviren/workers/packet-capture/requirements.txt

echo "[6/8] Setting capabilities for Python binaries..."
PYTHON_BIN=$(which python3)
setcap cap_net_raw,cap_net_admin+ep ${PYTHON_BIN}

echo "[7/8] Configuring systemd services..."
for service in netviren-api netviren-frontend netviren-scanner netviren-packet-capture netviren-agent-handler; do
  cp /opt/netviren/deploy/systemd/${service}.service /etc/systemd/system/
  systemctl enable ${service}
done

# Create .env file
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
node -e "
const { getDb } = require('./dist/db/connection.js');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db = getDb();
const hash = bcrypt.hashSync('${ADMIN_PASS}', 12);
db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)').run(uuid(), '${ADMIN_USER}', hash, 'admin');
console.log('Admin user created');
"

# Start services
systemctl start netviren-api
systemctl start netviren-frontend
systemctl start netviren-scanner
systemctl start netviren-packet-capture
systemctl start netviren-agent-handler

echo "============================================"
echo "  NetViren Platform installed successfully!"
echo "  API: http://localhost:4000"
echo "  Frontend: http://localhost:3000"
echo "============================================"
```

---

