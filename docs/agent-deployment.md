# NetViren — Agent-Deployment

> **Installation und Konfiguration der NetViren Agents auf Linux- und Windows-Systemen**

---

## Übersicht

NetViren Agents sind leichte native Programme, die auf Endsystemen installiert werden und folgende Aufgaben übernehmen:
- **Dateiscanning** — SHA256-Hashes berechnen und an Server senden
- **Packet Capture** — Netzwerkpakete aufzeichnen (Npcap/libpcap)
- **Prozess-Monitoring** — Laufende Prozesse und Verbindungen melden
- **Heartbeat** — Regelmäßiger Status-Bericht (alle 30s)

---

## Linux Agent

### Installation

```bash
# Auf dem Zielsystem ausführen:
curl -sSL http://netviren-server:4001/agent/install.sh | bash
```

Oder manuell:

```bash
# Python-Dependencies installieren
pip3 install requests psutil

# Agent-Verzeichnis erstellen
mkdir -p /opt/netviren-agent

# Agent-Dateien kopieren
cp agents/linux/agent.py /opt/netviren-agent/
cp agents/linux/requirements.txt /opt/netviren-agent/

# Agent starten
python3 /opt/netviren-agent/agent.py
```

### systemd-Service (optional)

```ini
# /etc/systemd/system/netviren-agent.service
[Unit]
Description=NetViren Security Agent
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /opt/netviren-agent/agent.py
Restart=always
RestartSec=10
Environment=NETVIREN_API_URL=http://netviren-server:4001

[Install]
WantedBy=multi-user.target
```

```bash
systemctl enable netviren-agent
systemctl start netviren-agent
```

### Konfiguration

Die Agent-Konfiguration liegt unter `/etc/netviren-agent.json`:
```json
{
  "agent_id": "uuid-des-agents",
  "token": "auth-token-vom-server"
}
```

---

## Windows Agent

### Voraussetzungen
- Windows 10/11 oder Windows Server 2019+
- Npcap (für Packet Capture) — wird bei Bedarf installiert
- Python 3.11+ (embedded) — wird bei Bedarf installiert

### Installation mit NSIS-Installer

1. **Installer herunterladen:** `NetViren-Agent-Setup.exe`
2. **Assistent folgen** — Installationspfad wählen
3. **Automatische Konfiguration** — Agent registriert sich am Server
4. **Service-Start** — Agent läuft als Windows-Dienst

### Manuelle Installation

```powershell
# Python-Dependencies installieren
pip install requests psutil pywin32 wmi

# Agent-Dateien kopieren
copy agents/windows/*.py C:\Program Files\NetViren\Agent\

# Dienst installieren
python C:\Program Files\NetViren\Agent\agent_service.py install

# Dienst starten
net start NetVirenAgent
```

### Konfiguration

Windows: `%APPDATA%\NetViren\agent.json`
```json
{
  "agent_id": "uuid-des-agents",
  "token": "auth-token-vom-server"
}
```

---

## Agent-Protokoll

### Registration
```http
POST /api/agents/register
Content-Type: application/json

{
  "name": "hostname-des-systems",
  "machineId": "eindeutige-hardware-id",
  "agentType": "linux|windows",
  "version": "1.0.0"
}

→ 201 Created
{
  "agent": {
    "id": "...",
    "name": "...",
    "auth_token": "..."
  }
}
```

### Heartbeat
```http
POST /api/agents/:id/heartbeat
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "online",
  "ipAddress": "192.168.1.50",
  "osVersion": "Linux 6.8-x86_64"
}

→ 200 OK
{ "status": "ok" }
```

### File Scan Upload
```http
POST /api/agents/:id/files
Authorization: Bearer <token>
Content-Type: application/json

{
  "filePath": "/etc/passwd",
  "fileName": "passwd",
  "fileSize": 2048,
  "sha256Hash": "e3b0c44298fc1c149afbf4c8996fb924..."
}

→ 200 OK
{ "fileScanId": "uuid" }
```

---

## Fehlerbehebung

### Agent verbindet sich nicht
```bash
# Prüfen, ob der Agent-Handler läuft
curl -s http://netviren-server:4001/api/agents

# Prüfen, ob die Firewall den Port erlaubt
ufw status | grep 4001

# Agent-Logs prüfen
journalctl -u netviren-agent -n 50
```

### Agent-Status im Dashboard
Der Agent erscheint im Dashboard unter **Agenten**:
- 🟢 **Online** — Letzter Heartbeat < 60s
- 🔴 **Offline** — Heartbeat > 120s
- ⚠️ **Error** — Fehlerhaft
