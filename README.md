# NetViren

A comprehensive Network Security Platform for network discovery, threat detection, packet analysis, and security monitoring.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js)
![Python](https://img.shields.io/badge/Python-3.11+-3776AB?logo=python)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=next.js)
![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify)
![SQLite](https://img.shields.io/badge/SQLite-003B57?logo=sqlite)

---

## Architecture Overview

```
                          NetViren System Architecture

                    ┌─────────────────────────────────────────────┐
                    │              Proxmox LXC / VM               │
                    │         (Debian 12 / Ubuntu 24.04)          │
                    │                                             │
                    │  ┌──────────┐     ┌──────────────────────┐ │
                    │  │  Nginx   │     │    systemd Services   │ │
                    │  │  (Proxy) │     │  ┌─────────────────┐ │ │
                    │  └────┬─────┘     │  │ netviren-*.service│ │ │
                    │       │           │  │ (5 services)     │ │ │
                    │       │           │  └─────────────────┘ │ │
                    │       ▼           └──────────────────────┘ │
                    │  ┌──────────────────────────────────┐      │
                    │  │       Fastify API (:4000)         │      │
                    │  │  REST + WebSocket + JWT Auth      │      │
                    │  └──────┬──────────┬─────────────────┘      │
                    │         │          │                        │
                    │  ┌──────▼──┐  ┌────▼─────────────┐         │
                    │  │ Next.js  │  │ Python Scanner   │         │
                    │  │ (:3000)  │  │ Worker (polls DB)│         │
                    │  │ Auth.js  │  └──────────────────┘         │
                    │  └──────────┘                               │
                    │         │          ┌──────────────────┐     │
                    │         └──────────┤    SQLite DB      │     │
                    │                    │  (shared WAL)     │     │
                    │                    └────────┬─────────┘     │
                    │                             │               │
                    │  ┌─────────────────┐  ┌─────▼──────────┐   │
                    │  │ Agent Handler   │  │ Packet Capture  │   │
                    │  │ Fastify (:4001) │  │ Python (scapy)  │   │
                    │  └──────┬──────────┘  └────────────────┘   │
                    │         │                                   │
                    │  ┌──────▼───────┐  ┌──────────────────┐    │
                    │  │ Linux Agent  │  │ Windows Agent    │    │
                    │  │ (Python)     │  │ (Python + Npcap) │    │
                    │  └──────────────┘  └──────────────────┘    │
                    └─────────────────────────────────────────────┘
```

## Key Features

- **Network Discovery** — ARP scanning, TCP/UDP port scanning, OS fingerprinting, and service detection via Nmap
- **Agent System** — Lightweight Python agents for Windows and Linux that monitor files, processes, and network connections
- **Packet Analysis** — PCAP capture, DNS query extraction, connection tracking, and beaconing detection
- **VirusTotal Integration** — Hash, URL, domain, and IP lookups with intelligent caching and rate limiting
- **Reporting** — Automated daily PDF reports and on-demand manual reports via Puppeteer
- **Alerting** — Severity-based alerts with Discord webhook integration
- **Real-time Dashboard** — Live activity feed via WebSocket with live threat monitoring
- **Role-Based Access** — Admin, Analyst, and Viewer roles with fine-grained permission control
- **Multi-Provider Auth** — Local credentials, Google OAuth, and GitHub OAuth

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15 (App Router), TypeScript |
| **UI** | Tailwind CSS, shadcn/ui, Radix UI, Framer Motion |
| **Charts** | Recharts |
| **API** | Fastify 5, TypeScript |
| **Auth** | Auth.js (NextAuth v5) — Credentials, Google, GitHub |
| **Database** | SQLite via better-sqlite3 (Node) + sqlite3 (Python) |
| **Scanner** | Python 3, scapy, python-nmap |
| **Packet Capture** | Python, scapy, pyshark |
| **PDF Generation** | Puppeteer |
| **Scheduling** | systemd timers + node-cron |
| **i18n** | next-intl (English + German) |
| **Container** | Proxmox LXC (Debian 12 / Ubuntu 24.04) |

## Quick Start

### Prerequisites

- Node.js 22.x+
- Python 3.11+
- Nmap (`apt install nmap`)
- libpcap-dev (`apt install libpcap-dev`)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/netviren.git
cd netviren

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r workers/scanner/requirements.txt
pip install -r workers/packet-capture/requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings (database path, auth secret, API keys, etc.)

# Build the project
npm run build

# Run database migrations (automatic on first API start)

# Start development servers
npm run dev:api       # Fastify API on :4000
npm run dev:frontend  # Next.js frontend on :3000
```

### Production Deployment

```bash
# Build everything
npm run build

# Start services
npm run start:api
npm run start:frontend

# Or use systemd services (see deploy/systemd/)
sudo cp deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now netviren-api netviren-frontend
```

## Directory Structure

```
netviren/
├── package.json                 # Root workspace config (npm workspaces)
├── .env.example                 # Environment variable template
├── README.md
│
├── packages/
│   ├── api/                     # Fastify API server
│   │   └── src/
│   │       ├── app.ts           # App bootstrap (plugins, routes, WS)
│   │       ├── index.ts         # Entry point
│   │       ├── config/          # Environment validation (Zod)
│   │       ├── db/              # SQLite connection + migrations
│   │       ├── modules/         # Route modules by feature
│   │       │   ├── auth/        # Login, profile, session
│   │       │   ├── devices/     # Network devices & ports
│   │       │   ├── scans/       # Scan job management
│   │       │   ├── agents/      # Agent registration & data
│   │       │   ├── packets/     # Packet captures & analysis
│   │       │   ├── vt/          # VirusTotal lookups
│   │       │   ├── alerts/      # Alert management
│   │       │   ├── reports/     # Report generation
│   │       │   ├── settings/    # System settings
│   │       │   └── users/       # User management
│   │       ├── middleware/      # Auth middleware, RBAC
│   │       ├── lib/            # JWT signing, utilities
│   │       └── websocket/      # WebSocket event broadcasting
│   │
│   └── frontend/               # Next.js 15 application
│       └── src/
│           ├── app/            # App Router pages
│           │   ├── (auth)/     # Login page
│           │   └── (dashboard)/# Dashboard, devices, agents, etc.
│           ├── components/     # shadcn/ui + custom components
│           ├── lib/            # API client, hooks, utilities
│           ├── types/          # TypeScript type definitions
│           └── styles/         # Global CSS, Tailwind
│
├── workers/
│   ├── scanner/                # Python scanner worker
│   │   ├── main.py             # Job loop, scan orchestration
│   │   ├── arp_scanner.py      # ARP network discovery (scapy)
│   │   ├── port_scanner.py     # TCP/UDP port scanning (nmap)
│   │   ├── os_detection.py     # OS fingerprinting (nmap)
│   │   └── db.py               # SQLite connection
│   │
│   └── packet-capture/         # Python packet capture worker
│       ├── db.py               # SQLite connection
│       └── requirements.txt
│
├── agents/
│   ├── linux/                  # Linux agent (Python + systemd)
│   │   ├── agent.py            # Agent core (file scan, processes, heartbeat)
│   │   ├── install.sh          # One-line installer
│   │   └── requirements.txt
│   │
│   └── windows/                # Windows agent (Python + Npcap)
│       ├── agent.py            # Agent core (WMI, processes, connections)
│       ├── agent_service.py    # Windows Service wrapper
│       ├── installer.nsi       # NSIS installer script
│       └── requirements.txt
│
├── deploy/
│   ├── systemd/                # systemd service definitions
│   │   ├── netviren-api.service
│   │   ├── netviren-frontend.service
│   │   ├── netviren-scanner.service
│   │   ├── netviren-packet-capture.service
│   │   └── netviren-agent-handler.service
│   └── nginx/                  # Nginx reverse proxy config
│
└── docs/
    ├── architecture.md         # Extended architecture documentation
    └── api.md                  # Full API reference
```

## Screenshots

*(Screenshots to be added)*

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
