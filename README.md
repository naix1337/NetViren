# 🛡️ NetViren — Network Security Platform

![Node](https://img.shields.io/badge/Node.js-22-339933?logo=node.js)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Python](https://img.shields.io/badge/Python-3-3776AB?logo=python)
![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)
![License: MIT](https://img.shields.io/badge/License-MIT-blue)
[![wakatime](https://wakatime.com/badge/github/naix1337/NetViren.svg)](https://wakatime.com/badge/github/naix1337/NetViren)

> **Eine professionelle, selbstgehostete Network Security Platform für Netzwerküberwachung, Bedrohungserkennung, Paketanalyse und Sicherheits-Monitoring.**  
> Entwickelt für den Betrieb auf Debian/Ubuntu Servern — nativ, ohne Docker.

---

## 🚀 Quick Start

### Auf einem Server (Debian/Ubuntu)
```bash
bash <(curl -sSL https://github.com/naix1337/NetViren/raw/master/install.sh)

bash <(curl -sSL https://github.com/naix1337/NetViren/raw/master/update.sh)
```

### Auf Proxmox VE (LXC Container)
```bash
bash <(curl -sSL https://github.com/naix1337/NetViren/raw/master/proxmox-install.sh)
```
Dann im Menü: Einstellungen anpassen → `I` drücken → fertig.

```
┌──────────────────────────────────────────────────────────┐
│                   Proxmox LXC Container                   │
│                                                          │
│  ┌──────────┐    ┌────────────────┐    ┌──────────────┐  │
│  │ Next.js  │    │  Fastify API   │    │   Python     │  │
│  │ Frontend │◄──►│  (REST + WS)   │◄──►│   Scanner    │  │
│  │  :3001   │    │    :4000       │    │   Worker     │  │
│  └──────────┘    └───────┬────────┘    └──────┬───────┘  │
│                          │                    │          │
│                   ┌──────▼────────────────────▼──┐       │
│                   │         SQLite Database       │       │
│                   │   /var/lib/netviren/db/      │       │
│                   └──────────────────────────────┘       │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │ Packet-Cap   │  │ Agent-Handler│  │   Discord      │  │
│  │ (Python)     │  │ (Fastify)    │  │   Webhook      │  │
│  └──────────────┘  └──────┬───────┘  └────────────────┘  │
│                           │                              │
│                   ┌───────┴───────┐                      │
│                   │ Linux/Windows │                      │
│                   │ Agents        │                      │
│                   └───────────────┘                      │
└──────────────────────────────────────────────────────────┘
```

**5 systemd-Services:**
| Service | Technologie | Beschreibung |
|---------|-------------|-------------|
| `netviren-api` | Node.js (Fastify) | REST API + WebSocket |
| `netviren-frontend` | Next.js 15 | SSR Frontend |
| `netviren-scanner` | Python | ARP/Nmap Scans |
| `netviren-packet-capture` | Python | Packet Capture |
| `netviren-agent-handler` | Node.js | Agent Communication |

---

## 🚀 Quick Start

### Voraussetzungen
- **Server:** Debian 12 oder Ubuntu 24.04+
- **Rechte:** `root`-Zugriff (via sudo)
- **Netzwerk:** Zugriff auf das zu überwachende lokale Netzwerk

---

## 📖 Dokumentation

| Dokument | Beschreibung |
|----------|-------------|
| [Benutzerhandbuch](docs/user-guide.md) | Vollständige Anleitung mit allen Features |
| [Installation](docs/installation.md) | Detaillierte Installationsanleitung |
| [API-Referenz](docs/api.md) | Vollständige REST API Dokumentation |
| [Agent-Deployment](docs/agent-deployment.md) | Agents auf Windows/Linux installieren |

---

## 🖥️ Screenshots

> Screenshots folgen in Kürze.

| Login | Dashboard | Geräte |
|-------|-----------|--------|
| Dark Cyber Design mit Neon-Akzenten | Threat Score + Live Activity | Device List + Port Scanner |

---

## 🛠️ Tech Stack

**Frontend:**
- [Next.js 15](https://nextjs.org/) (App Router) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) + Radix UI
- [Framer Motion](https://www.framer.com/motion/) — Micro-Interactions
- [Recharts](https://recharts.org/) — Dashboard-Charts
- [next-intl](https://next-intl-docs.vercel.app/) — i18n (DE/EN)
- Dark Mode only mit Cyber-Design

**Backend:**
- [Fastify](https://fastify.dev/) v5 + TypeScript (REST API)
- [Auth.js](https://authjs.dev/) v5 (NextAuth) — Credentials + Google + GitHub
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — SQLite
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) — JWT
- [Puppeteer](https://pptr.dev/) — PDF-Reports

**Workers:**
- [scapy](https://scapy.net/) — ARP-Scans, Packet Capture
- [python-nmap](https://pypi.org/project/python-nmap/) — Port-Scans, OS Detection
- [psutil](https://psutil.readthedocs.io/) — Agent-Prozess-Monitoring

---

## 🛠️ Entwicklung

```bash
# Repository klonen
git clone https://github.com/naix1337/NetViren.git
cd netviren

# Dependencies installieren
npm install

# Entwicklungsserver starten
npm run dev:api        # API :4000
npm run dev:frontend   # Frontend :3000

# Bauen
npm run build

# Tests
npm test
```

### Projektstruktur

```
netviren/
├── packages/
│   ├── api/              # Fastify API Server
│   │   └── src/
│   │       ├── modules/  # 10 Feature-Module
│   │       ├── db/       # SQLite + Migrationen
│   │       └── middleware/# Auth, Logging
│   └── frontend/         # Next.js 15 App
│       └── src/
│           ├── app/      # 11 Seiten (App Router)
│           ├── components/# UI + Layout + Shared
│           └── i18n/     # Deutsch/Englisch
├── workers/
│   ├── scanner/          # Python Scanner
│   └── packet-capture/   # Packet Capture
├── agents/
│   ├── linux/            # Linux Native Agent
│   └── windows/          # Windows Agent + NSIS
├── deploy/
│   ├── systemd/          # 5 Service-Dateien
│   └── nginx/            # Reverse Proxy Config
└── docs/                 # Dokumentation
```

---

## 🔒 Sicherheit

- **Passwort-Hashing:** bcrypt (12 Runden)
- **JWT:** 256-Bit Secrets, 7-Tage-Expiry
- **API-Rate-Limiting:** 100 req/min pro IP
- **RBAC:** Admin / Analyst / Viewer mit Middleware-Guards
- **System-Capabilities:** CAP_NET_RAW + CAP_NET_ADMIN (nur für Scanner)
- **Packet-Speicher:** 7-Tage-Retention mit automatischer Bereinigung
- **Agent-Auth:** JWT + optionaler Public-Key-Challenge
- **Path-Traversal-Schutz:** realpathSync-Validierung aller Dateipfade
- **Dependencies:** Regelmäßige Security-Audits via `npm audit`

---

## 📄 Lizenz

MIT License — siehe [LICENSE](LICENSE) für Details.

---

## 🙏 Danksagung

- [shadcn/ui](https://ui.shadcn.com/) für die UI-Komponenten-Basis
- [21st.dev](https://21st.dev/) für Design-Inspiration
- [Linear.app](https://linear.app/) für das Design-Vorbild
- [Vercel Dashboard](https://vercel.com/dashboard) für UX-Referenz
