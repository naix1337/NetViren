# NetViren — Network Security Platform Design Document

**Datum:** 2026-07-28
**Status:** Approved Design
**Autor:** Brainstorming Process

---

## 1. Architecture Overview

### 1.1 System Architecture

```
                         ┌────────────────────────────────────────────────────┐
                         │                   Proxmox LXC                      │
                         │              (Debian 12 / Ubuntu 24.04)            │
                         │                                                    │
                         │  ┌──────────┐       ┌──────────────────────────┐  │
                         │  │  Nginx    │       │      systemd              │  │
                         │  │  (Proxy)  │       │  ┌─────────────────────┐ │  │
                         │  └────┬─────┘       │  │ netviren-{service}  │ │  │
                         │       │             │  │ *.service (5 Stk.)  │ │  │
                         │       │             │  └─────────────────────┘ │  │
                         │       ▼             └──────────────────────────┘  │
                         │  ┌──────────────────────────────────────────┐     │
                         │  │            Fastify API (:4000)            │     │
                         │  │  WebSocket │ REST API │ JWT Validation  │     │
                         │  └──────┬──────┬────────────────────────────┘     │
                         │         │      │                                  │
                         │  ┌──────▼──┐ ┌─▼──────────────────┐  ┌──────────┐│
                         │  │ Next.js │ │ Python Scanner     │  │ Packet-  ││
                         │  │(:3000)  │ │ Worker (Pure Py)   │  │ Capture  ││
                         │  │Auth.js  │ │ polls DB for jobs  │  │ (Python) ││
                         │  └─────────┘ └────────────────────┘  └────┬─────┘│
                         │         │                                  │     │
                         │         └──────┐                    ┌──────┘     │
                         │              ┌─▼────────────────────▼──┐        │
                         │              │       SQLite (shared)    │        │
                         │              │  /var/lib/netviren/db/   │        │
                         │              └──────────────────────────┘        │
                         │                                                    │
                         │  ┌─────────────────┐  ┌──────────────┐            │
                         │  │ Agent Handler    │  │  Discord     │            │
                         │  │ Fastify(:4001)   │  │  Webhook     │            │
                         │  │ WebSocket + REST │  │  (from API)  │            │
                         │  └──────┬──────────┘  └──────────────┘            │
                         │         │                                          │
                         │  ┌──────▼───────┐  ┌──────────────────────┐       │
                         │  │ Linux Agent  │  │ Windows Agent         │       │
                         │  │ (Python)     │  │ (Python+Npcap)        │       │
                         │  └──────────────┘  └──────────────────────┘       │
                         └────────────────────────────────────────────────────┘
```

### 1.2 Process Model

| Service | Technologie | Port | Beschreibung |
|---------|-------------|------|-------------|
| `netviren-frontend` | Next.js 15 (standalone) | 3000 | SSR-Frontend + Auth.js (Login/OAuth-Callbacks, JWT-Ausstellung) |
| `netviren-api` | Node.js (Fastify) | 4000 | REST API, WebSocket (Dashboard-Live), Orchestrierung, JWT-Validation |
| `netviren-scanner` | Python (Pure Script) | — | Netzwerk-Scans (ARP, Nmap, Ports, OS), pollt DB, schreibt Ergebnisse |
| `netviren-packet-capture` | Python (scapy) | — | Packet Capture, Analyse, Cleanup (7d-Retention) |
| `netviren-agent-handler` | Node.js (Fastify) | 4001 | Separater Fastify-Server für Agent-WebSockets + REST |

### 1.3 Tech Stack Decision (Approved: Approach 1)

| Layer | Technologie | Begründung |
|-------|-------------|-----------|
| **Frontend** | Next.js 15 (App Router) + TypeScript | SSR, App Router, Auth.js-Integration |
| **UI** | Tailwind CSS + shadcn/ui + Radix UI | Bewährtes Design-System, Dark Mode First |
| **Animation** | Framer Motion | Micro-Interactions, Layout-Animationen |
| **Charts** | Recharts | React-native Chart-Bibliothek, gut mit Tailwind |
| **i18n** | next-intl | Beste Lösung für Next.js App Router |
| **API** | Fastify + TypeScript | Schneller als NestJS, geringerer Boilerplate |
| **Auth** | Auth.js (NextAuth v5) | Multi-Provider (Credentials, Google, GitHub) |
| **DB** | SQLite via better-sqlite3 (Node) + sqlite3 (Python) | Kein separater DB-Server nötig, shared File |
| **Scanner** | Python (FastAPI) | scapy, nmap, python-nmap, pyshark Ökosystem |
| **Packet Capture** | Python (scapy + pyshark) | libpcap-Bindung, Deep Packet Inspection |
| **PDF** | Puppeteer (Node) | HTML→PDF mit vollem CSS-Support |
| **Scheduling** | systemd-Timer + node-cron | Hybrid: System-Timer für Scans, node-cron für Reports |
| **Container** | Proxmox LXC (Debian 12) | Native Performance, CAP_NET_RAW/CAP_NET_ADMIN |

---

## 2. Database Schema (SQLite)

### 2.1 Core Tables

```sql
-- Users & Authentication
CREATE TABLE users (
    id            TEXT PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE,
    password_hash TEXT,
    role          TEXT NOT NULL DEFAULT 'viewer'
                  CHECK(role IN ('admin','analyst','viewer')),
    avatar_url    TEXT,
    is_active     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE accounts (
    id                  TEXT PRIMARY KEY,
    user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider            TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token       TEXT,
    access_token        TEXT,
    expires_at          INTEGER,
    token_type          TEXT,
    scope               TEXT,
    id_token            TEXT,
    session_state       TEXT,
    UNIQUE(provider, provider_account_id)
);

CREATE TABLE sessions (
    id            TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires       TEXT NOT NULL,
    session_token TEXT UNIQUE NOT NULL
);

CREATE TABLE verification_tokens (
    identifier TEXT NOT NULL,
    token      TEXT NOT NULL UNIQUE,
    expires    TEXT NOT NULL,
    PRIMARY KEY (identifier, token)
);
```

### 2.2 Network Devices

```sql
CREATE TABLE devices (
    id            TEXT PRIMARY KEY,
    ip_address    TEXT NOT NULL,
    mac_address   TEXT,
    hostname      TEXT,
    os_detected   TEXT,
    os_version    TEXT,
    vendor        TEXT,
    first_seen    TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen     TEXT NOT NULL DEFAULT (datetime('now')),
    is_online     INTEGER NOT NULL DEFAULT 0,
    threat_score  REAL NOT NULL DEFAULT 0.0,
    tags          TEXT,
    notes         TEXT,
    whitelisted   INTEGER NOT NULL DEFAULT 0,
    blacklisted   INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE device_ports (
    id              TEXT PRIMARY KEY,
    device_id       TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    port            INTEGER NOT NULL,
    protocol        TEXT NOT NULL CHECK(protocol IN ('tcp','udp')),
    state           TEXT NOT NULL DEFAULT 'open',
    service         TEXT,
    service_version TEXT,
    first_seen      TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(device_id, port, protocol)
);

CREATE TABLE scans (
    id            TEXT PRIMARY KEY,
    scan_type     TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'running'
                  CHECK(status IN ('pending','running','completed','failed')),
    target        TEXT,
    devices_found INTEGER DEFAULT 0,
    ports_found   INTEGER DEFAULT 0,
    started_at    TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at  TEXT,
    error         TEXT,
    triggered_by  TEXT REFERENCES users(id)
);
```

### 2.3 Agents

```sql
CREATE TABLE agents (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    machine_id      TEXT UNIQUE,
    agent_type      TEXT NOT NULL CHECK(agent_type IN ('windows','linux')),
    version         TEXT,
    ip_address      TEXT,
    os_version      TEXT,
    status          TEXT NOT NULL DEFAULT 'offline'
                    CHECK(status IN ('online','offline','error')),
    last_heartbeat  TEXT,
    registered_at   TEXT NOT NULL DEFAULT (datetime('now')),
    auth_token      TEXT NOT NULL,
    public_key      TEXT,
    capabilities    TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE agent_file_scans (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    file_path   TEXT NOT NULL,
    file_name   TEXT NOT NULL,
    file_size   INTEGER,
    sha256_hash TEXT NOT NULL,
    vt_status   TEXT DEFAULT 'pending',
    vt_data     TEXT,
    vt_checked_at TEXT,
    first_seen  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(sha256_hash)
);

CREATE TABLE agent_processes (
    id            TEXT PRIMARY KEY,
    agent_id      TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    pid           INTEGER,
    name          TEXT NOT NULL,
    path          TEXT,
    cmdline       TEXT,
    sha256_hash   TEXT,
    is_suspicious INTEGER DEFAULT 0,
    first_seen    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE agent_connections (
    id             TEXT PRIMARY KEY,
    agent_id       TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    local_port     INTEGER,
    remote_ip      TEXT,
    remote_port    INTEGER,
    protocol       TEXT,
    process_name   TEXT,
    is_suspicious  INTEGER DEFAULT 0,
    first_seen     TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.4 Packet Capture

```sql
CREATE TABLE packet_captures (
    id               TEXT PRIMARY KEY,
    agent_id         TEXT REFERENCES agents(id) ON DELETE SET NULL,
    source_ip        TEXT NOT NULL,
    interface_name   TEXT,
    file_path        TEXT NOT NULL,
    file_size        INTEGER DEFAULT 0,
    packet_count     INTEGER DEFAULT 0,
    duration_seconds INTEGER,
    status           TEXT NOT NULL DEFAULT 'capturing'
                     CHECK(status IN ('capturing','completed','analyzing','analyzed','error')),
    started_at       TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at     TEXT,
    expires_at       TEXT NOT NULL,
    notes            TEXT
);

CREATE TABLE packet_dns_queries (
    id          TEXT PRIMARY KEY,
    capture_id  TEXT NOT NULL REFERENCES packet_captures(id) ON DELETE CASCADE,
    domain      TEXT NOT NULL,
    query_type  TEXT,
    response_ip TEXT,
    first_seen  TEXT NOT NULL DEFAULT (datetime('now')),
    count       INTEGER DEFAULT 1
);

CREATE TABLE packet_connections (
    id          TEXT PRIMARY KEY,
    capture_id  TEXT NOT NULL REFERENCES packet_captures(id) ON DELETE CASCADE,
    src_ip      TEXT NOT NULL,
    src_port    INTEGER,
    dst_ip      TEXT NOT NULL,
    dst_port    INTEGER,
    protocol    TEXT,
    bytes_sent  INTEGER DEFAULT 0,
    bytes_recv  INTEGER DEFAULT 0,
    packets     INTEGER DEFAULT 0,
    first_seen  TEXT NOT NULL DEFAULT (datetime('now')),
    last_seen   TEXT NOT NULL DEFAULT (datetime('now')),
    is_beacon   INTEGER DEFAULT 0
);
```

### 2.5 VirusTotal Cache

```sql
CREATE TABLE vt_cache (
    id                TEXT PRIMARY KEY,
    lookup_type       TEXT NOT NULL CHECK(lookup_type IN ('hash','url','domain','ip')),
    lookup_value      TEXT NOT NULL,
    response_data     TEXT NOT NULL,
    malicious_count   INTEGER DEFAULT 0,
    suspicious_count  INTEGER DEFAULT 0,
    harmless_count    INTEGER DEFAULT 0,
    undetected_count  INTEGER DEFAULT 0,
    total_vendors     INTEGER DEFAULT 0,
    community_score   INTEGER,
    first_seen        TEXT,
    last_seen         TEXT,
    cached_at         TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at        TEXT NOT NULL,
    UNIQUE(lookup_type, lookup_value)
);
```

### 2.6 Alerts & Reports

```sql
CREATE TABLE alerts (
    id           TEXT PRIMARY KEY,
    alert_type   TEXT NOT NULL,
    severity     TEXT NOT NULL CHECK(severity IN ('info','low','medium','high','critical')),
    title        TEXT NOT NULL,
    description  TEXT,
    device_id    TEXT REFERENCES devices(id) ON DELETE SET NULL,
    agent_id     TEXT REFERENCES agents(id) ON DELETE SET NULL,
    metadata     TEXT,
    is_read      INTEGER NOT NULL DEFAULT 0,
    discord_sent INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE reports (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    report_type   TEXT NOT NULL CHECK(report_type IN ('daily','manual')),
    period_start  TEXT NOT NULL,
    period_end    TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'generating'
                  CHECK(status IN ('generating','completed','failed')),
    file_path     TEXT,
    file_size     INTEGER,
    summary_json  TEXT,
    created_by    TEXT REFERENCES users(id),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 2.7 Settings

```sql
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Default Settings
INSERT OR IGNORE INTO settings (key, value) VALUES
    ('scan_interval_minutes', '60'),
    ('port_scan_enabled', 'true'),
    ('port_ranges', '20-25,53,80,110,143,443,445,993,995,1433,1521,2049,3306,3389,5432,5900,6379,8080,8443,27017'),
    ('udp_scan_enabled', 'false'),
    ('packet_capture_enabled', 'true'),
    ('packet_retention_days', '7'),
    ('discord_webhook_url', ''),
    ('discord_alerts_enabled', 'false'),
    ('vt_api_key', ''),
    ('vt_enabled', 'false'),
    ('auto_vt_check', 'true'),
    ('daily_report_time', '06:00'),
    ('threat_score_threshold', '5.0'),
    ('beaconing_detect_enabled', 'true');
```

---

## 3. Project Structure

```
netzwerk-viren-scanner/
├── install.sh
├── package.json
├── .env.example
├── README.md
│
├── packages/
│   ├── frontend/                     # Next.js 15 App Router
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   ├── tailwind.config.ts
│   │   ├── messages/
│   │   │   ├── de.json
│   │   │   └── en.json
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (auth)/
│   │       │   │   ├── login/page.tsx
│   │       │   │   └── layout.tsx
│   │       │   ├── (dashboard)/
│   │       │   │   ├── layout.tsx         # Sidebar + Shell
│   │       │   │   ├── page.tsx           # Overview Dashboard
│   │       │   │   ├── devices/
│   │       │   │   ├── agents/
│   │       │   │   ├── files/
│   │       │   │   ├── packets/
│   │       │   │   ├── timeline/
│   │       │   │   ├── alerts/
│   │       │   │   ├── reports/
│   │       │   │   └── settings/
│   │       │   ├── layout.tsx
│   │       │   └── providers.tsx
│   │       ├── components/
│   │       │   ├── ui/                   # shadcn/ui
│   │       │   ├── layout/
│   │       │   ├── dashboard/
│   │       │   ├── devices/
│   │       │   ├── agents/
│   │       │   ├── packets/
│   │       │   └── shared/
│   │       ├── lib/
│   │       │   ├── api-client.ts
│   │       │   ├── utils.ts
│   │       │   └── hooks/
│   │       ├── styles/
│   │       │   └── globals.css
│   │       └── types/
│   │
│   └── api/                             # Fastify API Server
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts
│           ├── app.ts
│           ├── config/
│           │   └── env.ts
│           ├── db/
│           │   ├── connection.ts
│           │   ├── migrations/
│           │   └── seed.ts
│           ├── modules/
│           │   ├── auth/
│           │   ├── devices/
│           │   ├── scans/
│           │   ├── agents/
│           │   ├── packets/
│           │   ├── vt/
│           │   ├── alerts/
│           │   ├── reports/
│           │   └── settings/
│           ├── websocket/
│           │   └── handler.ts
│           ├── middleware/
│           │   ├── auth.ts
│           │   └── logger.ts
│           └── lib/
│
├── workers/
│   ├── scanner/                         # Python Scanner Worker
│   │   ├── requirements.txt
│   │   ├── main.py
│   │   ├── arp_scanner.py
│   │   ├── port_scanner.py
│   │   ├── os_detection.py
│   │   └── db.py
│   │
│   └── packet-capture/                  # Python Packet Capture Service
│       ├── requirements.txt
│       ├── main.py
│       ├── capture_manager.py
│       ├── dns_analyzer.py
│       ├── connection_analyzer.py
│       └── beacon_detector.py
│
├── agents/
│   ├── linux/
│   │   ├── agent.py
│   │   ├── requirements.txt
│   │   └── install.sh
│   └── windows/
│       ├── agent.py
│       ├── requirements.txt
│       ├── installer.nsi
│       └── agent_service.py
│
├── deploy/
│   ├── systemd/
│   │   ├── netviren-api.service
│   │   ├── netviren-frontend.service
│   │   ├── netviren-scanner.service
│   │   ├── netviren-packet-capture.service
│   │   └── netviren-agent-handler.service
│   └── nginx/
│       └── netviren.conf
│
└── docs/
    ├── architecture.md
    └── api.md
```

---

## 4. Auth System & Role Management

### 4.1 Authentication Architecture

**Auth.js läuft in Next.js, nicht in Fastify.** Dies ist der kritische Architektur-Entscheid:

```
Browser ───► Next.js (:3000) ───► Auth.js (OAuth/Credentials)
                │                       │
                │              ┌────────┘
                │              ▼
                │         JWT Token issued
                │              │
                ▼              ▼
         Frontend nutzt   Fastify API (:4000)
         JWT für API-Calls validiert JWT via
         (Authorization:  jsonwebtoken + shared
          Bearer <token>)  AUTH_SECRET
```

**Warum?** Auth.js (NextAuth) ist ein First-Class-Next.js-Framework. Es als Standalone in Fastify zu betreiben, würde gegen den Library-Design gehen und unnötige Komplexität erzeugen. Next.js übernimmt die Auth-Logik (Login-Seite, OAuth-Callbacks, Session-Management), und die Fastify-API validiert die ausgestellten JWTs mit demselben Secret.

### 4.2 Authentication Flow

| Provider | Implementierung |
|----------|----------------|
| **Credentials** | Auth.js Credentials Provider → bcrypt password check → JWT |
| **Google OAuth** | Auth.js Google Provider → OAuth 2.0 → auto-create user |
| **GitHub OAuth** | Auth.js GitHub Provider → OAuth 2.0 → auto-create user |

### 4.3 Session Strategy

- **JWT Sessions** (statt Database Sessions) — Cookie-basiert
- Cookie: `__Secure-authjs.session-token` (httpOnly, secure, sameSite=lax)
- API-Auth via `Authorization: Bearer <jwt>` Header
- JWT enthält: userId, role, username
- Fastify-API decodiert/validiert JWT mit `jsonwebtoken` + `AUTH_SECRET`

### 4.4 Role-Based Access Control

| Seite / Aktion | Admin | Analyst | Viewer |
|----------------|-------|---------|--------|
| Dashboard Overview | ✓ | ✓ | ✓ |
| Device-Liste | ✓ | ✓ | ✓ |
| Device-Details | ✓ | ✓ | ✓ |
| Scans auslösen | ✓ | ✓ | ✗ |
| Agent-Management | ✓ | ✓ | ✓ |
| File Scan Results | ✓ | ✓ | ✓ |
| VT-Details | ✓ | ✓ | ✓ |
| Packet Analysis | ✓ | ✓ | ✓ |
| Timeline | ✓ | ✓ | ✓ |
| Alerts verwalten | ✓ | ✓ | ✗ |
| Reports generieren | ✓ | ✓ | ✗ |
| Discord-Einstellungen | ✓ | ✗ | ✗ |
| User-Management | ✓ | ✗ | ✗ |
| System-Settings | ✓ | ✗ | ✗ |

### 4.5 RBAC Implementation

- **Next.js Middleware** — schützt Seiten-Routen via `matcher`
- **API Middleware (Fastify)** — schützt API-Endpunkte via Decorator `requireRole('admin')`
- **UI-Ebene** — `useRole()` Hook blendet Aktionen aus

### 4.6 i18n (Internationalisierung)

- **Bibliothek:** next-intl
- **Sprachen:** Deutsch (de) + Englisch (en)
- **Strategie:** Domain-Präfix `/de/`, `/en/`
- **Umfang:** ~300 Translation Keys
  - common, auth, dashboard, devices, agents, packets, files, alerts, reports, settings, errors

---

## 5. Design System & UI

### 5.1 Color Palette

```css
--bg-canvas:       #0A0B0E    /* Main Background */
--bg-surface:      #111316    /* Sidebar, Shell */
--bg-elevated:     #181B20    /* Cards */
--bg-inset:        #0D0F12    /* Inputs, Tables */
--bg-hover:        #1F232A    /* Hover States */

--border-default:  #1E2128    /* Subtle Borders */
--border-hover:    #2A2E38    /* Hover Border */
--border-active:   #22D3EE    /* Active/Focus Border */

--text-primary:    #EDEEF0    /* Headings */
--text-secondary:  #8B8F9B    /* Body, Navigation */
--text-muted:      #5A5E6A    /* Labels, Placeholders */

--accent-cyan:     #22D3EE    /* Primary Accent, Links, Active */
--accent-emerald:  #34D399    /* Online, Clean, Positive */
--accent-violet:   #A78BFA    /* Security, VT Integration */
--accent-amber:    #FBBF24    /* Warning, Medium Threat */
--accent-red:      #F87171    /* Critical, Offline, Errors */

--glow-cyan:       rgba(34,211,238,0.15)
--glow-violet:     rgba(167,139,250,0.12)
--glow-red:        rgba(248,113,113,0.12)
```

### 5.2 Typography

| Role | Font | Weight | Usage |
|------|------|--------|-------|
| Display | Inter | 600-700 | Heading XL, 2XL |
| Heading | Inter | 500-600 | Section Titles |
| Body | Inter | 400-500 | Content |
| Mono | JetBrains Mono | 400-500 | IPs, Ports, Hashes, Logs, Terminal |

**Type Scale:** 12 / 14 / 15 / 18 / 24 / 32 / 48 px

### 5.3 Key Components

| Component | Description |
|-----------|-------------|
| **StatusPulse** | Live-Indicator mit Puls-Animation (cyan=scanning, green=online, red=threat) |
| **ThreatGauge** | Radial/Semi-Circular Threat Score Anzeige mit Farbverlauf |
| **StatCard** | Dashboard-KPI-Card mit Icon, Wert, Trend-Pfeil, Subtext |
| **ActivityFeed** | Real-time Activity Stream mit Auto-Scroll |
| **TimelineView** | Horizontale Timeline für Scan-History |
| **DeviceMap** | Netzwerk-Topologie als interaktives Canvas (Verbindungslinien) |
| **SidebarNav** | Links: Icons + Text, Glassmorphism-Hintergrund, kollabierbar (64px→240px) |
| **SearchCmd** | Cmd+K globale Suche (Geräte, Agents, Alerts) |
| **ThreatBadge** | Farbcodiertes Badge (Emerald→Amber→Red) |

### 5.4 Layout Structure

- **Sidebar:** 240px (collapsed: 64px), fixed, scrollbar
- **Content Area:** Flex, scrollbar, padding 24-32px
- **Top Bar:** Breadcrumb + Search + Language Switch + User Avatar
- **Status Bar:** Fixed bottom (optional): System Health, Last Scan, Uptime

### 5.5 Micro-Interactions

- Seiten-Übergänge: Framer Motion `fadeIn` + `slideIn`
- Card Hover: Scale 1.01 + Border-Glow (cyan)
- Threat Score: Pulse-Animation bei Aktualisierung
- Live Activity: Neue Einträge gleiten ein (slide-down)
- Scan-Status: Rotierender Glow-Ring während aktivem Scan
- Button: Scale 0.98 on click, color transition

---

## 6. Feature Modules

### 6.1 Network Discovery & Scanning

**Scan-Arten:**
- ARP Scan: `arp-scan` oder `scapy` ARP-Requests
- ICMP Scan: Ping-Sweep
- Port Scan TCP: TCP Connect Scan via Nmap
- Port Scan UDP: UDP Scan via Nmap  
- OS Detection: Nmap OS-Fingerprinting
- Service Detection: Nmap Service-Version-Detection

**Scan-Orchestrierung:**
1. Fastify API queued Scan-Job in DB (scans-Tabelle, status=pending)
2. Python Worker pollt alle 10s nach pending Jobs
3. Worker führt Scan aus, schreibt Ergebnisse direkt in SQLite
4. Worker aktualisiert Scan-Status (completed/failed)
5. Alert-Engine prüft auf neue Geräte, verschwundene Geräte, neue Ports
6. WebSocket-Broadcast an Frontend-Clients

**Continuous Monitoring:**
- Timer-basiert (konfigurierbar, default 60min)
- Leichter ARP-Check alle 5 Minuten (nur online/offline)
- Full Scan zum konfigurierten Intervall

### 6.2 Agent System

**Agent-Funktionen:**
1. File Scanner: Scannt Verzeichnisse, berechnet SHA256, sendet an API
2. Packet Capture: Startet/stoppt Capture auf Anweisung, sendet pcap
3. Process Monitor: Listet laufende Prozesse + Netzwerk-Verbindungen
4. Heartbeat: Alle 30s Status-Report an Server

**Agent-Protokoll:**
- Registration: POST /api/agents/register (mit Machine-ID + Public Key)
- Auth: JWT-Token nach Registration
- WebSocket: /ws/agent (Heartbeat, Commands, File-Results)
- REST: /api/agents/* (File-Upload, Status-Updates)

**Agent-Code:**
- Linux: Python-Skript mit systemd-Service, embedded
- Windows: Python-Skript mit NSSM/Windows Service Wrapper, Npcap für Packet Capture

### 6.3 Packet Analysis

**Capture-Modi:**
- Dauerhaft: Kontinuierliches Mitschneiden auf definiertem Interface
- Anlassbezogen: Vom Agent oder Admin gestartet (z.B. bei Alert)

**Analyse-Pipeline:**
1. Capture → pcap-Datei auf Disk
2. Post-Processing: DNS-Extraktion, Connection-Tracking
3. Beaconing Detection: Regelmäßige Verbindungsmuster erkennen
4. Top-Talker: Sortiert nach Bytes/Packets
5. Ergebnisse in SQLite (packet_dns_queries, packet_connections)

**Cleanup:** systemd-Timer löscht täglich pcap-Dateien + DB-Einträge älter als 7 Tage

### 6.4 VirusTotal Integration

**Lookup-Typen:** SHA256-Hashes, URLs, Domains, IP-Adressen

**Caching-Strategie:**
- VT-Responses werden in vt_cache mit 24h TTL gecached
- Intelligentes Caching: Bekannte Clean-Hashes seltener prüfen
- Rate-Limiting: 4 Requests/Minute (Free Tier), Queue bei Überschreitung

**Trigger:**
- Manuell: User klickt "Check on VT" bei Hash/URL/Domain
- Automatisch: Neue File-Scans von Agents werden automatisch gecheckt

### 6.5 Alerting & Reporting

**Discord Alerts:**
- Format: Discord Embeds mit Farbcodierung (cyan/amber/red nach Severity)
- Footer: NetViren + Timestamp
- Types: New Device, Threat Detected, Port Change, VT Hit, Beaconing

**PDF Reports (täglich):**
- Generierung via Puppeteer (HTML → PDF)
- Inhalt: Device Status, Threats, Top-Talker, Port Changes, VT Hits, Threat Score
- Automatisch: systemd-Timer täglich um 06:00
- Manuell: Über Dashboard jederzeit auslösbar

### 6.6 User Management

**REST API:**
- `GET /api/users` — List users (admin only)
- `POST /api/users` — Create user (admin only)
- `PATCH /api/users/:id` — Update user/role (admin only)
- `DELETE /api/users/:id` — Deactivate user (admin only)
- `GET /api/users/me` — Current user profile
- `PATCH /api/users/me` — Update own profile

**Whitelist/Blacklist:**
- Devices: ip_address, mac_address
- Hashes: sha256 (File Hashes)
- Domains: domain (DNS queries, URLs)
- IPs: ip_address (connections, VT lookups)

---

## 7. Deployment

### 7.1 Systemd Services

| Service | Type | Restart | After |
|---------|------|---------|-------|
| netviren-api | simple | always | network.target |
| netviren-frontend | simple | always | netviren-api.service |
| netviren-scanner | simple | always | netviren-api.service |
| netviren-packet-capture | simple | always | network-online.target |
| netviren-agent-handler | simple | always | netviren-api.service |

### 7.2 Install Script (install.sh)

1. System packages: build-essential, libpcap-dev, nmap, arp-scan, python3, python3-pip, nodejs, npm
2. Create user `netviren`
3. Create directories: `/opt/netviren/`, `/var/lib/netviren/db/`, `/var/lib/netviren/packets/`, `/var/log/netviren/`
4. Install Node.js via NodeSource
5. Install Python packages (scapy, pyshark, python-nmap, fastapi, uvicorn)
6. Copy project files
7. Run `npm install` + build für API und Frontend
8. Run database migrations
9. Create initial admin user (prompt for credentials)
10. Copy systemd service files
11. Set capabilities (CAP_NET_RAW, CAP_NET_ADMIN) on Python binaries
12. Enable + start all services
13. Configure nginx reverse proxy (optional)

---

## 8. Error Handling Strategy

| Layer | Strategie |
|-------|-----------|
| **API (Fastify)** | Global Error Handler → strukturierte JSON-Fehler `{error, code, message, details}` |
| **Frontend** | React Error Boundary + Toast-System (Sonner) + Skeleton Loading States |
| **Python Worker** | Retry-Logic (3 Versuche), Circuit Breaker bei Nmap-Fehlern, Logging nach stderr |
| **Agents** | Exponential Backoff bei Connection-Verlust, lokaler Cache bei Offline-Betrieb |
| **VT API** | Rate-Limiting Queue, 429-Handling, Cache-Fallback |

**Loading States in UI:**
- Initial Load: Skeleton-Screens mit shimmer-Animation
- Actions: Button-Loading-Spinner, deaktivierter State
- Data Refresh: Sanfter Refresh ohne Full-Page-Load (SWR/React Query)
- Error: Inline Error-Message mit Retry-Button

---

## 9. Security Considerations

- **Passwort-Hashing:** bcrypt (12 rounds)
- **JWT Secret:** 256-Bit random, via Environment
- **API Rate Limiting:** 100 req/min pro IP (Fastify `@fastify/rate-limit`)
- **CORS:** Nur Frontend-Origin erlaubt
- **SQL Injection:** Keine — prepared statements via better-sqlite3
- **Agent Auth:** JWT + optional Public-Key-Challenge
- **Packet Storage:** Zugriff nur für netviren-user, keine world-readable Permissions
- **HTTPS:** Nginx Reverse Proxy mit Let's Encrypt (optional)

---

## 10. View/Route Map

| Route | View | Roles |
|-------|------|-------|
| `/login` | Login Page | Public |
| `/` | Overview Dashboard | All authenticated |
| `/devices` | Device List + Map | All |
| `/devices/:id` | Device Detail | All |
| `/agents` | Agent Management | All |
| `/agents/:id` | Agent Detail | All |
| `/files` | File Scan Results | All |
| `/files/:id` | VT Detail View | All |
| `/packets` | Packet Capture List | All |
| `/packets/:id` | Packet Analysis Detail | All |
| `/timeline` | Timeline / History | All |
| `/alerts` | Alerts | All |
| `/reports` | Reports List + Generate | Admin, Analyst |
| `/settings` | System Settings | Admin |
| `/settings/users` | User Management | Admin |
| `/settings/discord` | Discord Config | Admin |
| `/settings/whitelist` | Whitelist/Blacklist | Admin |
