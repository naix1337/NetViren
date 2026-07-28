#!/usr/bin/env bash
set -euo pipefail

# NetViren Linux Agent Installer

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_PATH="/etc/netviren-agent.json"
SERVICE_PATH="/etc/systemd/system/netviren-agent.service"

echo "=== NetViren Linux Agent Installer ==="

# Step 1: Create default config if not present
if [ ! -f "$CONFIG_PATH" ]; then
    echo "Creating default config at $CONFIG_PATH..."
    cat > "$CONFIG_PATH" <<'EOF'
{
  "agent_id": null,
  "token": null
}
EOF
    chmod 600 "$CONFIG_PATH"
else
    echo "Config already exists at $CONFIG_PATH — skipping."
fi

# Step 2: Install Python dependencies
echo "Installing Python dependencies..."
pip3 install --upgrade pip --quiet
pip3 install -r "$SCRIPT_DIR/requirements.txt" --quiet

# Step 3: Create systemd service
echo "Creating systemd service at $SERVICE_PATH..."
cat > "$SERVICE_PATH" <<EOF
[Unit]
Description=NetViren Linux Security Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 $SCRIPT_DIR/agent.py
Restart=always
RestartSec=10
User=nobody
Group=nogroup
Environment=NETVIREN_API_URL=http://10.0.0.1:4001

[Install]
WantedBy=multi-user.target
EOF

# Step 4: Enable and start service
echo "Enabling and starting service..."
systemctl daemon-reload
systemctl enable netviren-agent.service
systemctl start netviren-agent.service

echo "=== Installation complete ==="
echo "Check status with: systemctl status netviren-agent"
