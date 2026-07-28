# NetViren Architecture

## System Architecture Diagram

```
                          ┌──────────────────────────────────────────────────┐
                          │              Proxmox LXC / VM                    │
                          │         (Debian 12 / Ubuntu 24.04)               │
                          │                                                   │
                          │  ┌──────────────┐   ┌────────────────────────┐  │
                          │  │   Nginx      │   │      systemd            │  │
                          │  │  (Reverse    │   │  ┌───────────────────┐ │  │
                          │  │   Proxy)     │   │  │ netviren-*.service│ │  │
                          │  └──────┬───────┘   │  │ (5 services)      │ │  │
                          │         │           │  └───────────────────┘ │  │
                          │         │           └────────────────────────┘  │
                          │         ▼                                       │
                          │  ┌────────────────────────────────────────┐     │
                          │  │         Fastify API (:4000)             │     │
                          │  │  REST + WebSocket + JWT Auth + CORS    │     │
                          │  │  Plugins: cors, websocket, rate-limit, │     │
                          │  │           multipart                     │     │
                          │  └────────┬──────────┬─────────────────────┘     │
                          │           │          │                           │
                          │    ┌──────▼──┐  ┌────▼─────────────┐            │
                          │    │ Next.js  │  │ Python Scanner   │            │
                          │    │ (:3000)  │  │ Worker            │            │
                          │    │ Auth.js  │  │ polls DB for jobs│            │
                          │    │ SSR + i18n│  │ every 10s        │            │
                          │    └──────────┘  └────────┬─────────┘            │
                          │                              │                  │
                          │    ┌─────────────────────────▼──────────┐       │
                          │    │       SQLite (shared WAL mode)      │       │
                          │    │  /var/lib/netviren/db/netviren.db  │       │
                          │    └────────────────┬────────────────────┘       │
                          │                     │                            │
                          │  ┌──────────────────▼──────────────────┐         │
                          │  │       Packet Capture Worker         │         │
                          │  │  Python (scapy, pyshark)            │         │
                          │  │  pcap storage + DNS/connection      │         │
                          │  │  analysis + beaconing detection     │         │
                          │  └─────────────────────────────────────┘         │
                          │                                                   │
                          │  ┌──────────────────┐  ┌──────────────────────┐  │
                          │  │ Agent Handler     │  │   Discord Webhook   │  │
                          │  │ Fastify (:4001)   │  │   (from API)        │  │
                          │  │ Agent WebSocket   │  └──────────────────────┘  │
                          │  │ + Agent REST API  │                            │
                          │  └────────┬─────────┘                            │
                          │           │                                       │
                          │  ┌────────▼────────┐  ┌──────────────────────┐   │
                          │  │ Linux Agent     │  │ Windows Agent         │   │
                          │  │ (Python)        │  │ (Python + Npcap)      │   │
                          │  │ systemd service │  │ Windows Service       │   │
                          │  │ file scan,      │  │ file scan (WMI),      │   │
                          │  │ processes,      │  │ processes,            │   │
                          │  │ connections     │  │ connections, capture  │   │
                          │  └─────────────────┘  └──────────────────────┘   │
                          └──────────────────────────────────────────────────┘
```

## Service Descriptions

### 1. `netviren-api` (Fastify, :4000)

The central API server built with Fastify 5. It handles all REST API requests, WebSocket connections for live dashboard updates, JWT validation, and orchestration of scan jobs.

**Key responsibilities:**
- REST API for all modules (devices, scans, agents, packets, alerts, reports, settings, users, auth)
- WebSocket endpoint at `/ws` for real-time dashboard updates (broadcasts scan status, alerts, device changes)
- JWT token validation for all authenticated endpoints
- Rate limiting (100 requests/minute per IP)
- File upload support via multipart (500MB limit)
- CORS restricted to frontend origin

**Dependencies:** Fastify 5, better-sqlite3, jsonwebtoken, bcryptjs, puppeteer, node-cron, zod, pino

### 2. `netviren-frontend` (Next.js 15, :3000)

Server-side rendered frontend built with Next.js 15 App Router. Handles authentication via Auth.js, internationalization via next-intl, and renders the dashboard UI.

**Key responsibilities:**
- Login page with credentials, Google OAuth, and GitHub OAuth
- Dashboard with real-time stats (threat score, devices online, active scans)
- Device management (list, detail, ports, whitelist/blacklist)
- Agent management (list, detail, files, processes, connections)
- Packet capture management and analysis view
- Alert management with severity filtering
- Report generation and download
- Settings and user management (admin only)
- Internationalization (English + German)

**Auth Architecture:** Auth.js runs in Next.js (not Fastify). The login page and OAuth callbacks are handled by Next.js. After authentication, a JWT is issued which the frontend uses for Fastify API calls via `Authorization: Bearer <token>`.

**Dependencies:** Next.js 15, React 19, next-auth v5, next-intl, Tailwind CSS, shadcn/ui, Radix UI, Framer Motion, Recharts, Sonner

### 3. `netviren-scanner` (Python)

Python-based scanner worker that polls the SQLite database for pending scan jobs and executes them using scapy and python-nmap.

**Key responsibilities:**
- Polls the `scans` table every 10 seconds for pending jobs
- Executes ARP scans via scapy for device discovery
- Performs TCP port scans via python-nmap
- Performs UDP port scans via python-nmap (configurable)
- Runs OS fingerprinting via Nmap OS detection
- Writes discovered devices, ports, and OS info directly to the shared SQLite database
- Continuous monitoring mode: ARP-based online/offline detection every 60 seconds
- Updates scan status (running -> completed/failed) and counts

**Scan types:**
- `arp` — ARP scan of local network
- `port_tcp` — TCP port scan
- `port_udp` — UDP port scan (optional)
- `os` — OS fingerprinting
- `full` — All of the above

**Dependencies:** scapy, python-nmap

### 4. `netviren-packet-capture` (Python)

Python-based packet capture and analysis worker. Captures network traffic, stores PCAP files, and performs post-capture analysis.

**Key responsibilities:**
- Starts/stops packet captures on specified network interfaces
- Stores raw PCAP files to disk
- Extracts DNS queries from captured traffic
- Tracks network connections (src/dst IPs, ports, bytes, packets)
- Performs beaconing detection (regular connection pattern analysis)
- Identifies top talkers sorted by bytes/packets
- Cleanup of expired captures (default 7-day retention)

**Capture modes:**
- Continuous: ongoing capture on a defined interface
- Triggered: started on demand by an admin or agent

**Dependencies:** scapy, pyshark

### 5. `netviren-agent-handler` (Fastify, :4001)

A dedicated Fastify server for agent communication, running on port 4001. Handles agent registration, heartbeats, and command delivery.

**Key responsibilities:**
- Agent registration endpoint (generates unique tokens)
- Agent heartbeat receiver (updates online status, IP, timestamp)
- Command queue for agents (scan file, capture packets, etc.)
- REST endpoints for agent file uploads

**Note:** Agent authentication uses per-agent tokens (nanoid(64)), not the main JWT system.

## Data Flow

### Scan Flow

```
User/Admin triggers scan        Scanner Worker polls DB
        │                              │
        ▼                              │
  POST /api/scans                      │
  (creates scan record                 │
   with status=pending)                │
        │                              │
        └──────────────┬──────────────┘
                       ▼
              Execute scan (Python)
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
    ARP Scan   Port Scan   OS Detect
    (scapy)    (nmap)      (nmap)
        │         │         │
        └─────────┼─────────┘
                  ▼
          Write results to SQLite
          Update scan status
                  │
                  ▼
          WebSocket broadcast
          (scan:updated event
           to dashboard clients)
```

### Agent Communication Flow

```
Agent starts up
       │
       ▼
  POST /api/agents/register
  (sends machineId, agentType)
       │
       ▼
  Receives agent_id + auth_token
       │
       ▼
  Every 30s: POST /api/agents/:id/heartbeat
  (sends status, ipAddress, osVersion)
       │
       ▼
  GET /api/agents/:id/commands
  (checks for pending commands)
       │
       ▼
  POST /api/agents/:id/files
  (uploads file scan results with SHA256 hashes)
       │
       ▼
  API checks hash against VirusTotal
  (if VT integration is enabled)
```

### Packet Capture Flow

```
Admin starts capture                     Agent starts capture
        │                                       │
        ▼                                       ▼
  Capture job created                    Agent captures traffic
  in SQLite (status=capturing)           using Npcap/scapy
        │                                       │
        └──────────────┬───────────────────────┘
                       ▼
              PCAP file written to disk
                       │
                       ▼
              Post-capture analysis
                  │
        ┌─────────┼─────────┐
        ▼         ▼         ▼
    DNS Query  Connection  Beaconing
    Extraction  Tracking   Detection
        │         │         │
        └─────────┼─────────┘
                  ▼
          Results stored in SQLite
          (packet_dns_queries,
           packet_connections)
                  │
                  ▼
          WebSocket broadcast
          (capture analysis complete)
```

## Database Overview

NetViren uses a single SQLite database file shared between the Node.js API (via better-sqlite3) and the Python workers (via sqlite3 module). WAL (Write-Ahead Logging) mode is enabled for concurrent read/write access.

### Database Schema Summary

**Users & Authentication (4 tables)**
| Table | Purpose |
|-------|---------|
| `users` | User accounts with roles (admin, analyst, viewer), bcrypt password hashes |
| `accounts` | OAuth provider accounts (Google, GitHub) linked to users |
| `sessions` | Session tokens for persistent login |
| `verification_tokens` | Email verification tokens |

**Network Discovery (2 tables)**
| Table | Purpose |
|-------|---------|
| `devices` | Discovered network devices with IP, MAC, OS, threat score, whitelist/blacklist |
| `device_ports` | Open ports detected on devices with service versions |
| `scans` | Scan job queue and history (types: arp, port_tcp, port_udp, os, full) |

**Agent System (4 tables)**
| Table | Purpose |
|-------|---------|
| `agents` | Registered agents with type (windows/linux), status, auth tokens |
| `agent_file_scans` | Files scanned by agents with SHA256 hashes and VT results |
| `agent_processes` | Running processes reported by agents |
| `agent_connections` | Network connections reported by agents |

**Packet Analysis (3 tables)**
| Table | Purpose |
|-------|---------|
| `packet_captures` | Capture sessions with file paths, sizes, durations |
| `packet_dns_queries` | DNS queries extracted from captures |
| `packet_connections` | Network connections tracked during captures, with beaconing flags |

**Threat Intelligence (1 table)**
| Table | Purpose |
|-------|---------|
| `vt_cache` | VirusTotal lookup cache with 1-hour TTL, vendor counts |

**Alerts & Reports (2 tables)**
| Table | Purpose |
|-------|---------|
| `alerts` | Severity-based alerts with Discord delivery tracking |
| `reports` | Daily and manual PDF report records |

**Configuration (1 table)**
| Table | Purpose |
|-------|---------|
| `settings` | Key-value store for all configurable settings |

All IDs are generated using nanoid (URL-safe unique IDs). Timestamps use ISO 8601 format via SQLite's `datetime('now')`. Foreign keys with CASCADE/SET NULL referential actions maintain data integrity.

## Security Model

### Authentication

- **Browser users** authenticate via Auth.js (NextAuth v5) running in the Next.js frontend
- **Providers:** Credentials (username/password with bcrypt), Google OAuth, GitHub OAuth
- **Session strategy:** JWT-based (not database sessions)
- **JWT contents:** `{ userId, role, username }` — signed with HS256, 7-day expiry
- **Cookie:** `__Secure-authjs.session-token` (httpOnly, secure, sameSite=lax)
- **API auth:** Frontend sends JWT in `Authorization: Bearer <token>` header

### Role-Based Access Control

| Role | Permissions |
|------|------------|
| **admin** | Full access: settings, user management, Discord config, all actions |
| **analyst** | Read/write: devices, scans, agents, files, packets, alerts, reports |
| **viewer** | Read-only: dashboard, devices, agents, files, packets, timeline |

RBAC enforced at three layers:
1. **Next.js middleware** (`middleware.ts`) — protects page routes
2. **Fastify middleware** (`auth.ts`) — `requireRole('admin')` decorator on API routes
3. **UI layer** — `useRole()` hook conditionally renders actions

### Agent Authentication

- Each agent receives a unique `auth_token` (nanoid, 64 characters) during registration
- Agent tokens are stored in the `agents.auth_token` column
- Agents authenticate via `Authorization: Bearer <agent-token>` header
- Agent heartbeat and registration endpoints bypass JWT auth

### Capabilities

- **Password hashing:** bcrypt with 12 salt rounds
- **JWT secret:** 256-bit random value via `AUTH_SECRET` environment variable
- **API rate limiting:** 100 requests/minute per IP via `@fastify/rate-limit`
- **CORS:** Only the configured `FRONTEND_URL` origin is allowed
- **SQL injection prevention:** Parameterized queries via better-sqlite3 prepared statements
- **Packet storage:** Files stored with restricted permissions, accessible only by the netviren system user
- **HTTPS:** Optional via Nginx reverse proxy with Let's Encrypt
- **Agent auth:** Per-agent tokens with optional public-key challenge support
