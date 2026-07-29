# NetViren — Installationsanleitung

> **Detaillierte Anleitung zur Installation und Konfiguration der NetViren Network Security Platform**
> Gültig für Version 1.0.0

---

## Systemvoraussetzungen

### Minimale Anforderungen
| Komponente | Anforderung |
|------------|-------------|
| CPU | 2 Kerne (x86_64) |
| RAM | 2 GB |
| Speicher | 10 GB SSD |
| OS | Debian 12 / Ubuntu 24.04+ |
| Netzwerk | Zugriff auf das zu überwachende LAN |

### Empfohlen
| Komponente | Anforderung |
|------------|-------------|
| CPU | 4 Kerne |
| RAM | 4 GB |
| Speicher | 20 GB SSD |
| OS | Ubuntu 26.04 LTS |

### Berechtigungen
- `root`-Zugriff oder `sudo`-Rechte
- Container-Rechte: `CAP_NET_RAW`, `CAP_NET_ADMIN`

---

## Installationsvarianten

### Variante 1: Automatische Installation (empfohlen)

```bash
# 1. Projekt auf den Server kopieren
scp -r netzwerk-viren-scanner root@dein-server:/opt/netviren

# 2. Per SSH einloggen
ssh root@dein-server

# 3. Installationsskript ausführen
cd /opt/netviren
chmod +x install.sh
./install.sh
```

Das Skript führt folgende Schritte aus:
1. System-Dependencies installieren (libpcap, nmap, arp-scan, python3, nodejs)
2. Node.js 22 über NodeSource installieren
3. Benutzer `netviren` anlegen
4. Verzeichnisstruktur erstellen (`/opt/netviren`, `/var/lib/netviren/`, `/var/log/netviren/`)
5. npm-Abhängigkeiten installieren und Projekt bauen
6. Python-Abhängigkeiten installieren (scapy, python-nmap)
7. CAP_NET_RAW + CAP_NET_ADMIN auf Python-Binary setzen
8. systemd-Services installieren und aktivieren
9. `.env`-Konfiguration erstellen (mit zufälligem AUTH_SECRET)
10. Admin-Benutzer anlegen
11. Alle Services starten

### Variante 2: Manuelle Installation

```bash
# System-Dependencies
apt-get update
apt-get install -y build-essential libpcap-dev nmap arp-scan python3 python3-pip nginx curl wget

# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Benutzer anlegen
useradd -r -s /usr/sbin/nologin -m -d /opt/netviren netviren

# Verzeichnisse
mkdir -p /var/lib/netviren/db /var/lib/netviren/packets /var/log/netviren
chown -R netviren:netviren /var/lib/netviren /var/log/netviren

# Projekt kopieren
# (von deinem Entwicklungsrechner)
scp -r netzwerk-viren-scanner root@server:/opt/netviren

# Dependencies installieren
cd /opt/netviren
npm ci
npm run build

# Python-Dependencies
pip3 install scapy python-nmap

# Capabilities setzen
setcap cap_net_raw,cap_net_admin+ep $(which python3)

# Konfiguration
cat > /opt/netviren/.env << 'EOF'
DATABASE_PATH=/var/lib/netviren/db/netviren.db
AUTH_SECRET=$(openssl rand -hex 32)
API_PORT=4000
AGENT_HANDLER_PORT=4001
FRONTEND_URL=http://localhost:3000
NODE_ENV=production
EOF
```

---

## systemd-Services

### Services aktivieren

```bash
# Service-Dateien kopieren
cp /opt/netviren/deploy/systemd/*.service /etc/systemd/system/

# Services aktivieren
systemctl enable netviren-api
systemctl enable netviren-frontend
systemctl enable netviren-scanner
systemctl enable netviren-packet-capture
systemctl enable netviren-agent-handler

# Services starten
systemctl start netviren-api
systemctl start netviren-frontend
systemctl start netviren-scanner
systemctl start netviren-packet-capture
systemctl start netviren-agent-handler
```

### Service-Status prüfen

```bash
systemctl status netviren-api
systemctl status netviren-frontend
systemctl status netviren-scanner
```

### Logs anzeigen

```bash
journalctl -u netviren-api -n 50 -f
journalctl -u netviren-scanner -n 50 -f
```

---

## Firewall-Konfiguration

### ufw (empfohlen)

```bash
# API (für Agent-Kommunikation)
ufw allow 4000/tcp

# Frontend
ufw allow 3001/tcp

# Agent-Handler (für Agent-WebSockets)
ufw allow 4001/tcp
```

### iptables

```bash
iptables -A INPUT -p tcp --dport 4000 -j ACCEPT
iptables -A INPUT -p tcp --dport 3001 -j ACCEPT
iptables -A INPUT -p tcp --dport 4001 -j ACCEPT
```

---

## Nginx Reverse Proxy (optional)

```nginx
# /etc/nginx/sites-available/netviren
server {
    listen 80;
    server_name netviren.example.com;

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
    }
}
```

---

## Docker-Alternative (nicht empfohlen)

NetViren ist für nativen Betrieb optimiert und nutzt Docker nicht. Falls du dennoch containerisieren möchtest:

```dockerfile
# Dockerfile (experimentell)
FROM ubuntu:24.04
RUN apt-get update && apt-get install -y libpcap-dev nmap arp-scan python3-pip curl
# ... siehe install.sh für vollständige Schritte
```

---

## Erste Schritte nach der Installation

1. **Frontend aufrufen:** `http://dein-server:3001`
2. **Mit Admin-Zugangsdaten anmelden**
3. **Dashboard erkunden** — Threat Score, Gerätestatus, Live-Aktivität
4. **Scan auslösen** — Gehe zu Geräte → Scan starten
5. **Einstellungen konfigurieren** — Discord, VirusTotal, Scan-Intervalle

---

## Troubleshooting

### API startet nicht
```bash
# Prüfen, ob Port frei ist
ss -tlnp | grep 4000

# Prüfen, ob .env existiert
cat /opt/netviren/.env

# Logs anzeigen
journalctl -u netviren-api -n 50
```

### Scanner findet keine Geräte
```bash
# Prüfen, ob CAP_NET_RAW gesetzt ist
getcap $(which python3)

# Prüfen, ob nmap installiert ist
nmap --version

# Manuellen ARP-Scan testen
arp-scan --localnet
```

### Frontend ohne CSS
```bash
# Prüfen, ob statische Assets vorhanden sind
ls /opt/netviren/packages/frontend/.next/static/css/

# Server neu starten
systemctl restart netviren-frontend
```

---

## Update

```bash
cd /opt/netviren
git pull
rm -rf node_modules
npm ci
npm run build
systemctl restart netviren-api
systemctl restart netviren-frontend
```
