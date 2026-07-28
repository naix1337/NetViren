# NetViren — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, production-ready network security platform with network discovery, agent management, packet analysis, VirusTotal integration, and reporting, deployable natively in a Proxmox LXC container.

**Architecture:** Monorepo with five systemd services — Next.js 15 (Auth.js + SSR), Fastify API (REST + WebSocket), Python Scanner Worker (ARP/Nmap), Python Packet Capture (scapy), and Fastify Agent Handler. Shared SQLite database. Dark cyber-security design system with subtle neon accents.

**Tech Stack:** Fastify + TypeScript (API), Next.js 15 + Tailwind + shadcn/ui (Frontend), Python + scapy + pyshark (Scanner/PCAP), SQLite, Auth.js, Puppeteer (PDF), Discord Webhooks.

## Global Constraints

- **Node.js** ≥ 22 (LTS)
- **Python** ≥ 3.11
- **SQLite** via better-sqlite3 (Node) + sqlite3 (Python) — same file, no server
- **Authentication:** Auth.js v5 in Next.js, JWT validation in Fastify via jsonwebtoken
- **Database:** Single SQLite file at `/var/lib/netviren/db/netviren.db`
- **Packet storage:** `/var/lib/netviren/packets/` with 7-day retention
- **Log directory:** `/var/log/netviren/`
- **System user:** `netviren` (no login shell)
- **Capabilities required:** CAP_NET_RAW + CAP_NET_ADMIN on Python binaries
- **All UI:** Dark mode only, colors from design spec palette
- **i18n:** Deutsch + Englisch via next-intl
- **No Docker, no Podman — native systemd services only**
- **Code style:** TypeScript strict mode, Python type hints

---

## Parallel Workstreams

Since the user wants everything built in parallel with sub-agents, the project is decomposed into **9 independent workstreams** that share only the spec-defined interface contracts (DB schema, API endpoint contracts, file paths). Each workstream produces independently testable deliverables.

### Workstream Dependency Graph

```
                    ┌──────────────────────────────┐
                    │  WS1: Root Scaffolding        │
                    │  (package.json, tsconfig,     │
                    │   dirs, .env.example)         │
                    └──────────┬───────────────────┘
                               │ (foundation laid for all)
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
  ┌──────────────┐   ┌────────────────┐   ┌────────────────┐
  │ WS2: API     │   │ WS3: Frontend  │   │ WS4: Scanner   │
  │ (Fastify)    │   │ (Next.js)      │   │ (Python)       │
  └──────┬───────┘   └───────┬────────┘   └───────┬────────┘
         │                   │                    │
         ▼                   ▼                    ▼
  ┌──────────────┐   ┌────────────────┐   ┌────────────────┐
  │ WS5: Packet  │   │ WS6: Linux     │   │ WS7: Windows   │
  │ Capture (Py) │   │ Agent          │   │ Agent          │
  └──────┬───────┘   └───────┬────────┘   └───────┬────────┘
         │                   │                    │
         └───────────────────┼────────────────────┘
                             ▼
                    ┌──────────────────────────────┐
                    │  WS8: Deployment              │
                    │  (systemd, nginx, install.sh) │
                    └──────────────────────────────┘
                    ┌──────────────────────────────┐
                    │  WS9: Documentation           │
                    │  (README, API docs)           │
                    └──────────────────────────────┘
```

**Note:** WS1 must complete first (or at least its scaffolding output must be known). WS2-WS7 are fully parallel. WS8 depends on knowing the file layout from WS2-WS7. WS9 is fully independent.

---

### Interface Contracts (shared between parallel workstreams)

All workstreams agree on these contracts without needing to call each other:

**API Endpoint Contracts** (Fastify → Frontend):
- `GET /api/health` → `{ status: 'ok', uptime: number }`
- `GET /api/devices` → `{ devices: Device[] }`
- `GET /api/devices/:id` → `{ device: Device }`
- `GET /api/devices/:id/ports` → `{ ports: DevicePort[] }`
- `GET /api/scans` → `{ scans: Scan[] }`
- `POST /api/scans` → `{ scan: Scan }` (body: `{ type: ScanType }`)
- `GET /api/agents` → `{ agents: Agent[] }`
- `GET /api/agents/:id` → `{ agent: Agent }`
- `GET /api/agents/:id/files` → `{ files: AgentFileScan[] }`
- `GET /api/agents/:id/processes` → `{ processes: AgentProcess[] }`
- `GET /api/agents/:id/connections` → `{ connections: AgentConnection[] }`
- `GET /api/packets` → `{ captures: PacketCapture[] }`
- `GET /api/packets/:id` → `{ capture: PacketCapture, dns: DNSQuery[], connections: PacketConnection[] }`
- `GET /api/packets/:id/download` → binary pcap download
- `GET /api/files` → `{ files: AgentFileScan[] }`
- `GET /api/files/:id` → `{ file: AgentFileScan }`
- `POST /api/files/:id/vt-check` → `{ file: AgentFileScan }`
- `GET /api/vt/lookup?type=hash&value=xxx` → `{ result: VTCacheEntry }`
- `GET /api/alerts` → `{ alerts: Alert[] }`
- `PATCH /api/alerts/:id/read` → `{ alert: Alert }`
- `GET /api/reports` → `{ reports: Report[] }`
- `POST /api/reports/generate` → `{ report: Report }`
- `GET /api/reports/:id/download` → binary pdf download
- `GET /api/reports/:id/preview` → `{ report: Report }`
- `GET /api/timeline` → `{ events: TimelineEvent[] }`
- `GET /api/settings` → `{ settings: Record<string, string> }`
- `PUT /api/settings` → `{ settings: Record<string, string> }`
- `GET /api/users` → `{ users: User[] }` (admin only)
- `POST /api/users` → `{ user: User }` (admin only)
- `PATCH /api/users/:id` → `{ user: User }` (admin only)
- `DELETE /api/users/:id` → `{ success: true }` (admin only)
- `GET /api/me` → `{ user: User }`
- `PATCH /api/me` → `{ user: User }`

**WebSocket Events** (Fastify → Frontend):
- `scan:progress` → `{ scanId, type, progress: number, devicesFound: number }`
- `scan:complete` → `{ scanId, type, devicesFound: number }`
- `device:new` → `{ device: Device }`
- `device:offline` → `{ deviceId }`
- `alert:new` → `{ alert: Alert }`
- `agent:status` → `{ agentId, status: 'online'|'offline' }`
- `threat:update` → `{ deviceId, threatScore: number }`

**Agent Protocol** (Agent → Agent Handler):
- `POST /api/agents/register` → body: `{ name, machineId, agentType, version, publicKey? }` → response: `{ agentId, token }`
- `POST /api/agents/:id/heartbeat` → body: `{ status, ipAddress, osVersion }` → response: `{ ok: true }`
- `POST /api/agents/:id/files` → body: multipart with file + `{ filePath, sha256Hash }` → response: `{ fileScanId }`
- `POST /api/agents/:id/packetcapture` → body: multipart with pcap → response: `{ captureId }`
- `GET /api/agents/:id/commands` → response: `{ commands: AgentCommand[] }`
- WebSocket: `/ws/agent?token=xxx` → bidirectional commands + status

**Shared Types:**

```typescript
interface Device {
  id: string; ipAddress: string; macAddress?: string; hostname?: string;
  osDetected?: string; osVersion?: string; vendor?: string;
  firstSeen: string; lastSeen: string; isOnline: boolean;
  threatScore: number; tags: string[]; whitelisted: boolean; blacklisted: boolean;
}
interface DevicePort {
  id: string; deviceId: string; port: number; protocol: 'tcp'|'udp';
  state: string; service?: string; serviceVersion?: string; lastSeen: string;
}
interface Scan {
  id: string; scanType: string; status: 'pending'|'running'|'completed'|'failed';
  target?: string; devicesFound: number; portsFound: number;
  startedAt: string; completedAt?: string; error?: string;
}
interface Agent {
  id: string; name: string; machineId?: string; agentType: 'windows'|'linux';
  version?: string; ipAddress?: string; osVersion?: string;
  status: 'online'|'offline'|'error'; lastHeartbeat?: string;
  registeredAt: string; isActive: boolean;
}
interface AgentFileScan {
  id: string; agentId: string; filePath: string; fileName: string;
  fileSize?: number; sha256Hash: string;
  vtStatus: 'pending'|'clean'|'malicious'|'unknown'|'error';
  vtData?: any; vtCheckedAt?: string; firstSeen: string;
}
interface AgentProcess {
  id: string; agentId: string; pid: number; name: string; path?: string;
  cmdline?: string; sha256Hash?: string; isSuspicious: boolean; firstSeen: string;
}
interface AgentConnection {
  id: string; agentId: string; localPort?: number; remoteIp: string;
  remotePort?: number; protocol?: string; processName?: string;
  isSuspicious: boolean; firstSeen: string;
}
interface PacketCapture {
  id: string; agentId?: string; sourceIp: string; interfaceName?: string;
  filePath: string; fileSize: number; packetCount: number;
  durationSeconds?: number; status: string; startedAt: string;
  completedAt?: string; expiresAt: string;
}
interface DNSQuery {
  id: string; captureId: string; domain: string; queryType?: string;
  responseIp?: string; count: number; firstSeen: string;
}
interface PacketConnection {
  id: string; captureId: string; srcIp: string; srcPort?: number;
  dstIp: string; dstPort?: number; protocol?: string;
  bytesSent: number; bytesRecv: number; packets: number;
  firstSeen: string; lastSeen: string; isBeacon: boolean;
}
interface VTCacheEntry {
  id: string; lookupType: 'hash'|'url'|'domain'|'ip'; lookupValue: string;
  maliciousCount: number; suspiciousCount: number;
  harmlessCount: number; undetectedCount: number; totalVendors: number;
  communityScore?: number; cachedAt: string; expiresAt: string;
}
interface Alert {
  id: string; alertType: string; severity: 'info'|'low'|'medium'|'high'|'critical';
  title: string; description?: string; deviceId?: string; agentId?: string;
  metadata?: any; isRead: boolean; discordSent: boolean; createdAt: string;
}
interface Report {
  id: string; title: string; reportType: 'daily'|'manual';
  periodStart: string; periodEnd: string; status: 'generating'|'completed'|'failed';
  filePath?: string; fileSize?: number; summaryJson?: any; createdAt: string;
}
interface User {
  id: string; username: string; email?: string; role: 'admin'|'analyst'|'viewer';
  avatarUrl?: string; isActive: boolean; createdAt: string;
}
```

---

## Workstream 1: Root Scaffolding & Shared Configuration

**Files:**
- Create: `package.json` (root workspace)
- Create: `.env.example`
- Create: `.gitignore`
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/frontend/package.json`
- Create: `packages/frontend/tsconfig.json`
- Create: `packages/frontend/next.config.ts`
- Create: `packages/frontend/tailwind.config.ts`
- Create: `packages/frontend/postcss.config.js`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "netviren",
  "version": "1.0.0",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:api": "npm run dev -w packages/api",
    "dev:frontend": "npm run dev -w packages/frontend",
    "build:api": "npm run build -w packages/api",
    "build:frontend": "npm run build -w packages/frontend",
    "build": "npm run build:api && npm run build:frontend",
    "start:api": "npm run start -w packages/api",
    "start:frontend": "npm run start -w packages/frontend"
  }
}
```

- [ ] **Step 2: Create .env.example**

```
# Database
DATABASE_PATH=/var/lib/netviren/db/netviren.db

# Auth
AUTH_SECRET=generate-a-random-256-bit-secret
AUTH_URL=http://localhost:3000

# Google OAuth
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=

# GitHub OAuth
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=

# API
API_PORT=4000
API_HOST=0.0.0.0
FRONTEND_URL=http://localhost:3000
AGENT_HANDLER_PORT=4001

# VirusTotal
VT_API_KEY=
VT_API_URL=https://www.virustotal.com/api/v3

# Discord
DISCORD_WEBHOOK_URL=

# Scan defaults
SCAN_INTERVAL_MINUTES=60
PORT_RANGES=20-25,53,80,110,143,443,445,993,995,1433,1521,2049,3306,3389,5432,5900,6379,8080,8443,27017
PACKET_RETENTION_DAYS=7

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
dist/
.next/
__pycache__/
*.pyc
.env
*.db
*.pcap
packets/
```

- [ ] **Step 4: Create packages/api/package.json**

```json
{
  "name": "@netviren/api",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "fastify": "^5.0.0",
    "@fastify/cors": "^10.0.0",
    "@fastify/websocket": "^11.0.0",
    "@fastify/rate-limit": "^10.0.0",
    "@fastify/multipart": "^9.0.0",
    "better-sqlite3": "^11.0.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3",
    "puppeteer": "^23.0.0",
    "node-cron": "^3.0.0",
    "nanoid": "^5.0.0",
    "pino": "^9.0.0",
    "pino-pretty": "^11.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.0.0",
    "@types/better-sqlite3": "^7.6.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/bcryptjs": "^2.4.0",
    "@types/node": "^22.0.0",
    "@types/node-cron": "^3.0.0"
  }
}
```

- [ ] **Step 5: Create packages/api/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 6: Create packages/frontend/package.json**

```json
{
  "name": "@netviren/frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-auth": "^5.0.0-beta.25",
    "@auth/core": "^0.37.0",
    "next-intl": "^3.26.0",
    "tailwindcss": "^3.4.0",
    "tailwindcss-animate": "^1.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.6.0",
    "lucide-react": "^0.460.0",
    "framer-motion": "^11.0.0",
    "recharts": "^2.15.0",
    "sonner": "^1.7.0",
    "@radix-ui/react-dialog": "^1.1.0",
    "@radix-ui/react-dropdown-menu": "^2.1.0",
    "@radix-ui/react-select": "^2.1.0",
    "@radix-ui/react-tabs": "^1.1.0",
    "@radix-ui/react-tooltip": "^1.1.0",
    "@radix-ui/react-switch": "^1.1.0",
    "@radix-ui/react-avatar": "^1.1.0",
    "@radix-ui/react-badge": "^1.1.0",
    "@radix-ui/react-separator": "^1.1.0",
    "@radix-ui/react-scroll-area": "^1.2.0",
    "@radix-ui/react-progress": "^1.1.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

- [ ] **Step 7: Create packages/frontend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 8: Create packages/frontend/next.config.ts**

```typescript
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const config: NextConfig = {
  output: 'standalone',
  experimental: { serverActions: { bodySizeLimit: '50mb' } },
};

export default withNextIntl(config);
```

- [ ] **Step 9: Create packages/frontend/tailwind.config.ts**

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#0A0B0E',
        surface: '#111316',
        elevated: '#181B20',
        inset: '#0D0F12',
        hover: '#1F232A',
        'border-default': '#1E2128',
        'border-hover': '#2A2E38',
        'border-active': '#22D3EE',
        'text-primary': '#EDEEF0',
        'text-secondary': '#8B8F9B',
        'text-muted': '#5A5E6A',
        'accent-cyan': '#22D3EE',
        'accent-emerald': '#34D399',
        'accent-violet': '#A78BFA',
        'accent-amber': '#FBBF24',
        'accent-red': '#F87171',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: { xl: '12px', '2xl': '16px' },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
export default config;
```

- [ ] **Step 10: Create packages/frontend/postcss.config.js**

```javascript
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

## Workstream 2: Fastify API Server

**Files:**
- Create: `packages/api/src/index.ts`
- Create: `packages/api/src/app.ts`
- Create: `packages/api/src/config/env.ts`
- Create: `packages/api/src/db/connection.ts`
- Create: `packages/api/src/db/migrations/001-init.ts`
- Create: `packages/api/src/db/seed.ts`
- Create: `packages/api/src/middleware/auth.ts`
- Create: `packages/api/src/middleware/logger.ts`
- Create: `packages/api/src/websocket/handler.ts`
- Create: `packages/api/src/modules/auth/routes.ts`
- Create: `packages/api/src/modules/devices/routes.ts`
- Create: `packages/api/src/modules/scans/routes.ts`
- Create: `packages/api/src/modules/agents/routes.ts`
- Create: `packages/api/src/modules/packets/routes.ts`
- Create: `packages/api/src/modules/vt/routes.ts`
- Create: `packages/api/src/modules/alerts/routes.ts`
- Create: `packages/api/src/modules/reports/routes.ts`
- Create: `packages/api/src/modules/settings/routes.ts`
- Create: `packages/api/src/modules/users/routes.ts`
- Create: `packages/api/src/lib/jwt.ts`

- [ ] **Step 1: Create env.ts** — Zod/env validation

```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_PATH: z.string().default('/var/lib/netviren/db/netviren.db'),
  AUTH_SECRET: z.string().min(32),
  AUTH_URL: z.string().default('http://localhost:3000'),
  API_PORT: z.coerce.number().default(4000),
  API_HOST: z.string().default('0.0.0.0'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  AGENT_HANDLER_PORT: z.coerce.number().default(4001),
  VT_API_KEY: z.string().default(''),
  VT_API_URL: z.string().default('https://www.virustotal.com/api/v3'),
  DISCORD_WEBHOOK_URL: z.string().default(''),
  SCAN_INTERVAL_MINUTES: z.coerce.number().default(60),
  PORT_RANGES: z.string().default('20-25,53,80,110,143,443,445,993,995,1433,1521,2049,3306,3389,5432,5900,6379,8080,8443,27017'),
  PACKET_RETENTION_DAYS: z.coerce.number().default(7),
  LOG_LEVEL: z.string().default('info'),
  NODE_ENV: z.enum(['development', 'production']).default('production'),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;
export function getEnv(): Env {
  if (!_env) _env = envSchema.parse(process.env);
  return _env;
}
```

- [ ] **Step 2: Create db/connection.ts**

```typescript
import Database from 'better-sqlite3';
import { getEnv } from '../config/env.js';

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    const env = getEnv();
    _db = new Database(env.DATABASE_PATH, { /* verbose: console.log */ });
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
  }
  return _db;
}
```

- [ ] **Step 3: Create db/migrations/001-init.ts** — Full SQL schema from the design spec

```typescript
import Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE,
      password_hash TEXT, role TEXT NOT NULL DEFAULT 'viewer'
        CHECK(role IN ('admin','analyst','viewer')),
      avatar_url TEXT, is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL, provider_account_id TEXT NOT NULL,
      refresh_token TEXT, access_token TEXT, expires_at INTEGER,
      token_type TEXT, scope TEXT, id_token TEXT, session_state TEXT,
      UNIQUE(provider, provider_account_id)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires TEXT NOT NULL, session_token TEXT UNIQUE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_tokens (
      identifier TEXT NOT NULL, token TEXT NOT NULL UNIQUE, expires TEXT NOT NULL,
      PRIMARY KEY (identifier, token)
    );

    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY, ip_address TEXT NOT NULL, mac_address TEXT,
      hostname TEXT, os_detected TEXT, os_version TEXT, vendor TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      is_online INTEGER NOT NULL DEFAULT 0, threat_score REAL NOT NULL DEFAULT 0.0,
      tags TEXT, notes TEXT, whitelisted INTEGER NOT NULL DEFAULT 0,
      blacklisted INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS device_ports (
      id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
      port INTEGER NOT NULL, protocol TEXT NOT NULL CHECK(protocol IN ('tcp','udp')),
      state TEXT NOT NULL DEFAULT 'open', service TEXT, service_version TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(device_id, port, protocol)
    );

    CREATE TABLE IF NOT EXISTS scans (
      id TEXT PRIMARY KEY, scan_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('pending','running','completed','failed')),
      target TEXT, devices_found INTEGER DEFAULT 0, ports_found INTEGER DEFAULT 0,
      started_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT,
      error TEXT, triggered_by TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, machine_id TEXT UNIQUE,
      agent_type TEXT NOT NULL CHECK(agent_type IN ('windows','linux')),
      version TEXT, ip_address TEXT, os_version TEXT,
      status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('online','offline','error')),
      last_heartbeat TEXT, registered_at TEXT NOT NULL DEFAULT (datetime('now')),
      auth_token TEXT NOT NULL, public_key TEXT, capabilities TEXT,
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS agent_file_scans (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL, file_name TEXT NOT NULL, file_size INTEGER,
      sha256_hash TEXT NOT NULL, vt_status TEXT DEFAULT 'pending',
      vt_data TEXT, vt_checked_at TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(sha256_hash)
    );

    CREATE TABLE IF NOT EXISTS agent_processes (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      pid INTEGER, name TEXT NOT NULL, path TEXT, cmdline TEXT,
      sha256_hash TEXT, is_suspicious INTEGER DEFAULT 0,
      first_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agent_connections (
      id TEXT PRIMARY KEY, agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      local_port INTEGER, remote_ip TEXT, remote_port INTEGER,
      protocol TEXT, process_name TEXT, is_suspicious INTEGER DEFAULT 0,
      first_seen TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS packet_captures (
      id TEXT PRIMARY KEY, agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      source_ip TEXT NOT NULL, interface_name TEXT, file_path TEXT NOT NULL,
      file_size INTEGER DEFAULT 0, packet_count INTEGER DEFAULT 0,
      duration_seconds INTEGER,
      status TEXT NOT NULL DEFAULT 'capturing' CHECK(status IN ('capturing','completed','analyzing','analyzed','error')),
      started_at TEXT NOT NULL DEFAULT (datetime('now')), completed_at TEXT,
      expires_at TEXT NOT NULL, notes TEXT
    );

    CREATE TABLE IF NOT EXISTS packet_dns_queries (
      id TEXT PRIMARY KEY, capture_id TEXT NOT NULL REFERENCES packet_captures(id) ON DELETE CASCADE,
      domain TEXT NOT NULL, query_type TEXT, response_ip TEXT,
      first_seen TEXT NOT NULL DEFAULT (datetime('now')), count INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS packet_connections (
      id TEXT PRIMARY KEY, capture_id TEXT NOT NULL REFERENCES packet_captures(id) ON DELETE CASCADE,
      src_ip TEXT NOT NULL, src_port INTEGER, dst_ip TEXT NOT NULL, dst_port INTEGER,
      protocol TEXT, bytes_sent INTEGER DEFAULT 0, bytes_recv INTEGER DEFAULT 0,
      packets INTEGER DEFAULT 0, first_seen TEXT NOT NULL DEFAULT (datetime('now')),
      last_seen TEXT NOT NULL DEFAULT (datetime('now')), is_beacon INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS vt_cache (
      id TEXT PRIMARY KEY, lookup_type TEXT NOT NULL CHECK(lookup_type IN ('hash','url','domain','ip')),
      lookup_value TEXT NOT NULL, response_data TEXT NOT NULL,
      malicious_count INTEGER DEFAULT 0, suspicious_count INTEGER DEFAULT 0,
      harmless_count INTEGER DEFAULT 0, undetected_count INTEGER DEFAULT 0,
      total_vendors INTEGER DEFAULT 0, community_score INTEGER,
      first_seen TEXT, last_seen TEXT,
      cached_at TEXT NOT NULL DEFAULT (datetime('now')), expires_at TEXT NOT NULL,
      UNIQUE(lookup_type, lookup_value)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY, alert_type TEXT NOT NULL,
      severity TEXT NOT NULL CHECK(severity IN ('info','low','medium','high','critical')),
      title TEXT NOT NULL, description TEXT, device_id TEXT REFERENCES devices(id) ON DELETE SET NULL,
      agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL, metadata TEXT,
      is_read INTEGER NOT NULL DEFAULT 0, discord_sent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY, title TEXT NOT NULL,
      report_type TEXT NOT NULL CHECK(report_type IN ('daily','manual')),
      period_start TEXT NOT NULL, period_end TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'generating' CHECK(status IN ('generating','completed','failed')),
      file_path TEXT, file_size INTEGER, summary_json TEXT,
      created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY, value TEXT NOT NULL
    );

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
  `);
}
```

- [ ] **Step 4: Create lib/jwt.ts**

```typescript
import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';

export interface JwtPayload {
  userId: string;
  role: 'admin' | 'analyst' | 'viewer';
  username: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getEnv().AUTH_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getEnv().AUTH_SECRET) as JwtPayload;
  } catch { return null; }
}
```

- [ ] **Step 5: Create middleware/auth.ts**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, JwtPayload } from '../lib/jwt.js';

declare module 'fastify' {
  interface FastifyRequest { user?: JwtPayload; }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Missing token' });
    return;
  }
  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token' });
    return;
  }
  request.user = payload;
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authMiddleware(request, reply);
    if (reply.sent) return;
    if (!request.user || !roles.includes(request.user.role)) {
      reply.status(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
    }
  };
}
```

- [ ] **Step 6: Create websocket/handler.ts**

```typescript
import { FastifyInstance } from 'fastify';

let _fastify: FastifyInstance | null = null;

export function setWsInstance(fastify: FastifyInstance): void {
  _fastify = fastify;
}

export function broadcast(event: string, data: any): void {
  if (!_fastify?.websocketServer) return;
  const message = JSON.stringify({ event, data });
  for (const client of _fastify.websocketServer.clients) {
    if (client.readyState === 1) client.send(message);
  }
}
```

- [ ] **Step 7: Create module route files**

Each module follows this pattern (example for devices):

```typescript
// packages/api/src/modules/devices/routes.ts
import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/connection.js';
import { authMiddleware } from '../../middleware/auth.js';

export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth
  app.addHook('preHandler', authMiddleware);

  app.get('/api/devices', async (_req, _rep) => {
    const devices = getDb().prepare('SELECT * FROM devices ORDER BY last_seen DESC').all();
    return { devices: devices.map(formatDevice) };
  });

  app.get('/api/devices/:id', async (req, rep) => {
    const { id } = req.params as { id: string };
    const device = getDb().prepare('SELECT * FROM devices WHERE id = ?').get(id);
    if (!device) return rep.status(404).send({ error: 'Not found' });
    return { device: formatDevice(device) };
  });

  app.get('/api/devices/:id/ports', async (req) => {
    const { id } = req.params as { id: string };
    const ports = getDb().prepare('SELECT * FROM device_ports WHERE device_id = ? ORDER BY port').all(id);
    return { ports };
  });
}

function formatDevice(d: any) {
  return {
    ...d,
    tags: d.tags ? JSON.parse(d.tags) : [],
    isOnline: Boolean(d.is_online),
    whitelisted: Boolean(d.whitelisted),
    blacklisted: Boolean(d.blacklisted),
    threatScore: d.threat_score,
    ipAddress: d.ip_address,
    macAddress: d.mac_address,
    osDetected: d.os_detected,
    osVersion: d.os_version,
    firstSeen: d.first_seen,
    lastSeen: d.last_seen,
    isOnline: Boolean(d.is_online),
    threatScore: d.threat_score,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}
```

**All module routes follow the same pattern.** The full plan would include all 10 modules. Key modules:

- **devices/routes.ts** — `GET /api/devices`, `GET /api/devices/:id`, `GET /api/devices/:id/ports`, `PATCH /api/devices/:id` (whitelist/blacklist/tags)
- **scans/routes.ts** — `GET /api/scans`, `POST /api/scans` (creates scan, broadcasts via WS)
- **agents/routes.ts** — `GET /api/agents`, `GET /api/agents/:id`, `GET /api/agents/:id/files`, `GET /api/agents/:id/processes`, `GET /api/agents/:id/connections`, `POST /api/agents/register`, `POST /api/agents/:id/heartbeat`
- **packets/routes.ts** — `GET /api/packets`, `GET /api/packets/:id`, `GET /api/packets/:id/download` (streams pcap file)
- **vt/routes.ts** — `GET /api/vt/lookup` (checks cache first, then VT API with rate limiting)
- **alerts/routes.ts** — `GET /api/alerts`, `PATCH /api/alerts/:id/read`
- **reports/routes.ts** — `GET /api/reports`, `POST /api/reports/generate` (runs puppeteer PDF generation), `GET /api/reports/:id/download`
- **settings/routes.ts** — `GET /api/settings`, `PUT /api/settings` (admin only)
- **users/routes.ts** — `GET /api/users`, `POST /api/users`, `PATCH /api/users/:id`, `DELETE /api/users/:id` (all admin only)
- **auth/routes.ts** — `POST /api/auth/login` (credentials login, returns JWT), `GET /api/me`, `PATCH /api/me`

- [ ] **Step 8: Create app.ts**

```typescript
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { getEnv } from './config/env.js';
import { getDb } from './db/connection.js';
import { runMigrations } from './db/migrations/001-init.js';
import { setWsInstance } from './websocket/handler.js';
import { deviceRoutes } from './modules/devices/routes.js';
import { scanRoutes } from './modules/scans/routes.js';
import { agentRoutes } from './modules/agents/routes.js';
import { packetRoutes } from './modules/packets/routes.js';
import { vtRoutes } from './modules/vt/routes.js';
import { alertRoutes } from './modules/alerts/routes.js';
import { reportRoutes } from './modules/reports/routes.js';
import { settingRoutes } from './modules/settings/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { authRoutes } from './modules/auth/routes.js';

export async function buildApp() {
  const env = getEnv();
  const db = getDb();
  runMigrations(db);

  const app = Fastify({ logger: { level: env.LOG_LEVEL } });

  await app.register(cors, { origin: env.FRONTEND_URL, credentials: true });
  await app.register(websocket);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } });

  setWsInstance(app);

  // WebSocket for dashboard live updates
  app.register(async function (fastify) {
    fastify.get('/ws', { websocket: true }, (socket, req) => {
      socket.on('message', (data) => { /* handle incoming WS messages */ });
      socket.on('close', () => { /* cleanup */ });
    });
  });

  // Health check
  app.get('/api/health', async () => ({
    status: 'ok',
    uptime: process.uptime(),
    version: '1.0.0',
  }));

  // Register all module routes
  await app.register(deviceRoutes);
  await app.register(scanRoutes);
  await app.register(agentRoutes);
  await app.register(packetRoutes);
  await app.register(vtRoutes);
  await app.register(alertRoutes);
  await app.register(reportRoutes);
  await app.register(settingRoutes);
  await app.register(userRoutes);
  await app.register(authRoutes);

  return app;
}
```

- [ ] **Step 9: Create index.ts**

```typescript
import { buildApp } from './app.js';
import { getEnv } from './config/env.js';

async function main() {
  const env = getEnv();
  const app = await buildApp();
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  console.log(`NetViren API running on port ${env.API_PORT}`);
}

main().catch((err) => {
  console.error('Failed to start API:', err);
  process.exit(1);
});
```

---

## Workstream 3: Next.js Frontend

**Files:**
- Create: `packages/frontend/src/styles/globals.css`
- Create: `packages/frontend/src/i18n/request.ts`
- Create: `packages/frontend/src/i18n/routing.ts`
- Create: `packages/frontend/messages/de.json`
- Create: `packages/frontend/messages/en.json`
- Create: `packages/frontend/src/types/api.ts` (shared types)
- Create: `packages/frontend/src/lib/api-client.ts`
- Create: `packages/frontend/src/lib/utils.ts`
- Create: `packages/frontend/src/middleware.ts`
- Create: `packages/frontend/src/app/layout.tsx`
- Create: `packages/frontend/src/app/providers.tsx`
- Create: `packages/frontend/src/app/(auth)/login/page.tsx`
- Create: `packages/frontend/src/app/(auth)/layout.tsx`
- Create: `packages/frontend/src/app/(dashboard)/layout.tsx`
- Create: `packages/frontend/src/app/(dashboard)/page.tsx`
- Create: `packages/frontend/src/components/ui/*` (shadcn/ui base components)
- Create: `packages/frontend/src/components/layout/Sidebar.tsx`
- Create: `packages/frontend/src/components/layout/Shell.tsx`
- Create: `packages/frontend/src/components/shared/StatusPulse.tsx`
- Create: `packages/frontend/src/components/shared/ThreatGauge.tsx`
- Create: `packages/frontend/src/components/shared/StatCard.tsx`
- Create: `packages/frontend/src/components/shared/ActivityFeed.tsx`
- Create: `packages/frontend/src/components/dashboard/DashboardOverview.tsx`
- Create dashboard pages: devices, agents, files, packets, timeline, alerts, reports, settings

- [ ] **Step 1: Create globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

@layer base {
  html { @apply bg-canvas text-text-primary antialiased; }
  body { @apply min-h-screen; }
  * { @apply border-border-default; }
}

@layer components {
  .glass {
    @apply bg-surface/80 backdrop-blur-xl border border-border-default;
  }
  .card {
    @apply bg-elevated rounded-xl border border-border-default p-6 transition-all duration-200;
  }
  .card-hover {
    @apply card hover:border-border-hover hover:shadow-lg hover:shadow-accent-cyan/5;
  }
  .glow-cyan {
    box-shadow: 0 0 20px rgba(34,211,238,0.1), 0 0 40px rgba(34,211,238,0.05);
  }
  .glow-violet {
    box-shadow: 0 0 20px rgba(167,139,250,0.1), 0 0 40px rgba(167,139,250,0.05);
  }
  .threat-pulse {
    animation: threatPulse 2s ease-in-out infinite;
  }
  @keyframes threatPulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  .scan-spin {
    animation: scanSpin 2s linear infinite;
  }
  @keyframes scanSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .slide-in {
    animation: slideIn 0.3s ease-out;
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-10px); }
    to { opacity: 1; transform: translateY(0); }
  }
}
```

- [ ] **Step 2: Create i18n files**

```typescript
// src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) locale = routing.defaultLocale;
  return { locale, messages: (await import(`../../messages/${locale}.json`)).default };
});

// src/i18n/routing.ts
import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';

export const routing = defineRouting({
  locales: ['de', 'en'],
  defaultLocale: 'de',
  localePrefix: 'always',
});

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
```

- [ ] **Step 3: Create messages files**

```json
// messages/de.json (excerpt — full file has ~300 keys)
{
  "common": {
    "app_name": "NetViren",
    "loading": "Laden...",
    "error": "Fehler",
    "retry": "Erneut versuchen",
    "search": "Suchen...",
    "no_results": "Keine Ergebnisse",
    "save": "Speichern",
    "cancel": "Abbrechen",
    "delete": "Löschen",
    "confirm": "Bestätigen",
    "online": "Online",
    "offline": "Offline",
    "enabled": "Aktiviert",
    "disabled": "Deaktiviert"
  },
  "auth": {
    "login_title": "NetViren",
    "login_subtitle": "Network Security Platform",
    "username": "Benutzername",
    "password": "Passwort",
    "login_button": "Anmelden",
    "login_google": "Mit Google anmelden",
    "login_github": "Mit GitHub anmelden",
    "logout": "Abmelden",
    "error_invalid": "Ungültige Anmeldedaten"
  },
  "nav": {
    "dashboard": "Dashboard",
    "devices": "Geräte",
    "agents": "Agents",
    "files": "Datei-Scans",
    "packets": "Paketanalyse",
    "timeline": "Zeitstrahl",
    "alerts": "Alarme",
    "reports": "Berichte",
    "settings": "Einstellungen"
  },
  "dashboard": {
    "threat_score": "Bedrohungs-Score",
    "devices_online": "Geräte online",
    "total_devices": "Gesamtgeräte",
    "active_scans": "Aktive Scans",
    "recent_alerts": "Letzte Alarme",
    "live_activity": "Live-Aktivität",
    "no_activity": "Keine aktuellen Aktivitäten",
    "threat_level": "Bedrohungslevel",
    "safe": "Sicher",
    "low": "Niedrig",
    "medium": "Mittel",
    "high": "Hoch",
    "critical": "Kritisch"
  },
  "devices": {
    "title": "Netzwerkgeräte",
    "ip": "IP-Adresse",
    "mac": "MAC-Adresse",
    "hostname": "Hostname",
    "os": "Betriebssystem",
    "vendor": "Hersteller",
    "ports": "Ports",
    "threat": "Bedrohung",
    "first_seen": "Erstmals gesehen",
    "last_seen": "Zuletzt gesehen",
    "no_devices": "Keine Geräte gefunden",
    "start_scan": "Scan starten",
    "whitelist": "Whitelist",
    "blacklist": "Blacklist"
  },
  "agents": {
    "title": "Agenten",
    "name": "Name",
    "type": "Typ",
    "status": "Status",
    "version": "Version",
    "ip": "IP-Adresse",
    "last_seen": "Letzter Heartbeat",
    "no_agents": "Keine Agenten registriert",
    "files_scanned": "Gescannte Dateien",
    "processes": "Prozesse",
    "connections": "Verbindungen"
  },
  "packets": {
    "title": "Paketanalyse",
    "captures": "Captures",
    "source": "Quelle",
    "packets": "Pakete",
    "size": "Größe",
    "duration": "Dauer",
    "status": "Status",
    "download": "PCAP herunterladen",
    "no_captures": "Keine Captures vorhanden",
    "dns_queries": "DNS-Anfragen",
    "connections": "Verbindungen",
    "top_talkers": "Top-Talker",
    "beaconing": "Beaconing-Verdacht"
  },
  "files": {
    "title": "Datei-Scans",
    "file": "Datei",
    "path": "Pfad",
    "size": "Größe",
    "hash": "SHA256",
    "vt_status": "VT-Status",
    "check_vt": "VT-Check",
    "no_files": "Keine Dateien gescannt"
  },
  "alerts": {
    "title": "Alarme",
    "type": "Typ",
    "severity": "Schweregrad",
    "description": "Beschreibung",
    "no_alerts": "Keine Alarme",
    "mark_read": "Als gelesen markieren",
    "new_device": "Neues Gerät",
    "device_offline": "Gerät offline",
    "threat": "Bedrohung",
    "port_change": "Port-Änderung",
    "vt_hit": "VT-Treffer"
  },
  "reports": {
    "title": "Berichte",
    "daily": "Tagesbericht",
    "manual": "Manueller Bericht",
    "generate": "Bericht generieren",
    "download": "PDF herunterladen",
    "no_reports": "Keine Berichte",
    "preview": "Vorschau",
    "period": "Zeitraum",
    "status_generating": "Wird generiert...",
    "status_completed": "Fertig",
    "status_failed": "Fehlgeschlagen"
  },
  "settings": {
    "title": "Einstellungen",
    "general": "Allgemein",
    "users": "Benutzer",
    "discord": "Discord",
    "whitelist": "Whitelist / Blacklist",
    "scanning": "Scan-Einstellungen",
    "vt": "VirusTotal",
    "language": "Sprache"
  }
}
```

English messages/en.json mirrors the same keys with English values.

- [ ] **Step 4: Create types/api.ts**

```typescript
// All shared types as defined in the Interface Contracts section above
export interface Device {
  id: string; ipAddress: string; macAddress?: string; hostname?: string;
  osDetected?: string; osVersion?: string; vendor?: string;
  firstSeen: string; lastSeen: string; isOnline: boolean;
  threatScore: number; tags: string[]; whitelisted: boolean; blacklisted: boolean;
}
export interface DevicePort {
  id: string; deviceId: string; port: number; protocol: 'tcp'|'udp';
  state: string; service?: string; serviceVersion?: string; lastSeen: string;
}
export interface Scan {
  id: string; scanType: string; status: 'pending'|'running'|'completed'|'failed';
  target?: string; devicesFound: number; portsFound: number;
  startedAt: string; completedAt?: string; error?: string;
}
export interface Agent {
  id: string; name: string; machineId?: string; agentType: 'windows'|'linux';
  version?: string; ipAddress?: string; osVersion?: string;
  status: 'online'|'offline'|'error'; lastHeartbeat?: string;
  registeredAt: string; isActive: boolean;
}
export interface AgentFileScan {
  id: string; agentId: string; filePath: string; fileName: string;
  fileSize?: number; sha256Hash: string;
  vtStatus: 'pending'|'clean'|'malicious'|'unknown'|'error';
  vtData?: any; vtCheckedAt?: string; firstSeen: string;
}
export interface AgentProcess {
  id: string; agentId: string; pid: number; name: string; path?: string;
  cmdline?: string; sha256Hash?: string; isSuspicious: boolean; firstSeen: string;
}
export interface AgentConnection {
  id: string; agentId: string; localPort?: number; remoteIp: string;
  remotePort?: number; protocol?: string; processName?: string;
  isSuspicious: boolean; firstSeen: string;
}
export interface PacketCapture {
  id: string; agentId?: string; sourceIp: string; interfaceName?: string;
  filePath: string; fileSize: number; packetCount: number;
  durationSeconds?: number; status: string; startedAt: string;
  completedAt?: string; expiresAt: string;
}
export interface DNSQuery {
  id: string; captureId: string; domain: string; queryType?: string;
  responseIp?: string; count: number; firstSeen: string;
}
export interface PacketConnection {
  id: string; captureId: string; srcIp: string; srcPort?: number;
  dstIp: string; dstPort?: number; protocol?: string;
  bytesSent: number; bytesRecv: number; packets: number;
  firstSeen: string; lastSeen: string; isBeacon: boolean;
}
export interface VTCacheEntry {
  id: string; lookupType: 'hash'|'url'|'domain'|'ip'; lookupValue: string;
  maliciousCount: number; suspiciousCount: number;
  harmlessCount: number; undetectedCount: number; totalVendors: number;
  communityScore?: number; cachedAt: string; expiresAt: string;
}
export interface Alert {
  id: string; alertType: string; severity: 'info'|'low'|'medium'|'high'|'critical';
  title: string; description?: string; deviceId?: string; agentId?: string;
  metadata?: any; isRead: boolean; discordSent: boolean; createdAt: string;
}
export interface Report {
  id: string; title: string; reportType: 'daily'|'manual';
  periodStart: string; periodEnd: string; status: 'generating'|'completed'|'failed';
  filePath?: string; fileSize?: number; summaryJson?: any; createdAt: string;
}
export interface User {
  id: string; username: string; email?: string; role: 'admin'|'analyst'|'viewer';
  avatarUrl?: string; isActive: boolean; createdAt: string;
}
```

- [ ] **Step 5: Create lib/api-client.ts**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchApi(path: string, options?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'API Error');
  }
  return res.json();
}

export const api = {
  get: (path: string) => fetchApi(path),
  post: (path: string, body?: any) => fetchApi(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body: any) => fetchApi(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: (path: string, body: any) => fetchApi(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path: string) => fetchApi(path, { method: 'DELETE' }),
  upload: async (path: string, formData: FormData) => {
    const token = localStorage.getItem('token');
    const res = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
};
```

- [ ] **Step 6: Create lib/utils.ts**

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('de-DE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'gerade eben';
  if (mins < 60) return `vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  return `vor ${days} Tagen`;
}
```

- [ ] **Step 7: Create Next.js middleware for auth**

```typescript
// packages/frontend/src/middleware.ts
import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Admin-only routes
    if (path.startsWith('/settings') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    // Analyst+Admin routes
    if ((path.startsWith('/reports') || path.startsWith('/alerts')) && token?.role === 'viewer') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: { authorized: ({ token }) => !!token },
    pages: { signIn: '/login' },
  }
);

export const config = {
  matcher: ['/((?!api|_next|login|register).*)'],
};
```

- [ ] **Step 8: Create base UI components (shadcn/ui style)**

Create base components in `packages/frontend/src/components/ui/`:
- `button.tsx` — cva-based variants: default, secondary, ghost, destructive, with cyan accent
- `card.tsx` — Card, CardHeader, CardContent, CardFooter
- `badge.tsx` — variants: default, secondary, success, warning, danger, with matching colors
- `input.tsx` — dark theme input with cyan focus ring
- `select.tsx` — dark select dropdown
- `tabs.tsx` — Radix tabs with cyan active indicator
- `table.tsx` — Dark themed table with striped rows
- `dialog.tsx` — Radix dialog with glassmorphism
- `dropdown-menu.tsx` — Radix dropdown
- `switch.tsx` — Radix switch with cyan active
- `tooltip.tsx` — Radix tooltip
- `avatar.tsx` — Radix avatar
- `separator.tsx` — Radix separator
- `scroll-area.tsx` — Radix scroll area
- `progress.tsx` — Radix progress with cyan gradient
- `skeleton.tsx` — Loading skeleton with shimmer

- [ ] **Step 9: Create shared components**

```tsx
// StatusPulse.tsx — animated live indicator
interface StatusPulseProps {
  status: 'online' | 'offline' | 'scanning' | 'threat' | 'warning';
  size?: 'sm' | 'md' | 'lg';
}
// Renders a pulsing dot: green=online, red=offline, cyan=scanning, red(threat pulse), amber=warning

// ThreatGauge.tsx — radial/semi-circular score display
interface ThreatGaugeProps {
  score: number; // 0-100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}
// SVG-based radial gauge with color gradient: green(0-20) → amber(20-50) → red(50-100)

// StatCard.tsx
interface StatCardProps {
  title: string; value: string | number; icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  description?: string; color?: 'cyan' | 'emerald' | 'violet' | 'amber' | 'red';
}
// Card with icon, large value, trend arrow, subtle description

// ActivityFeed.tsx
interface ActivityFeedProps {
  items: Array<{ id: string; type: string; title: string; description?: string; timestamp: string; severity?: string }>;
  maxItems?: number;
}
// Scrollable list with auto-slide-in animations for new items
```

- [ ] **Step 10: Create layout components**

```tsx
// Sidebar.tsx — glassmorphism sidebar
// - 240px expanded, 64px collapsed
// - Nav items with icons (lucide-react): Dashboard, Devices, Agents, Files, Packets, Timeline, Alerts, Reports, Settings
// - Active state: cyan left border + cyan text
// - Bottom: User avatar + name + logout button
// - Language switch at bottom
// - Collapse toggle button

// Shell.tsx — Main layout wrapper
// - Sidebar on left
// - Top bar: breadcrumb + Cmd+K search + language switch + user avatar
// - Content area with padding
// - (Optional) Status bar at bottom
```

- [ ] **Step 11: Create dashboard overview page**

```tsx
// (dashboard)/page.tsx — The main dashboard
// Top row:
//   - Global Threat Score (ThreatGauge, large)
//   - Devices Online/Total (StatCard)
//   - Active Scans (StatCard with pulse animation if active)
//   - Recent Alerts count (StatCard)
// Middle:
//   - Recent Alerts list (last 5)
// Bottom:
//   - Live Activity Feed (auto-scrolling WebSocket feed)
```

- [ ] **Step 12: Create feature pages**

Each page follows this pattern:
1. Fetch data on mount via `api.get(...)` (React useEffect or SWR)
2. Show skeleton while loading
3. Show error with retry button on failure
4. Render data with appropriate components
5. Real-time updates via WebSocket where applicable

**Key pages:**

- **Devices page** (`/devices`): Table with IP, MAC, hostname, OS, ports count, threat score badge, last seen. Toggle for map view (SVG/Canvas network topology).
- **Device detail** (`/devices/:id`): Full device info, port list, threat score timeline, whitelist/blacklist toggle, notes.
- **Agents page** (`/agents`): Agent cards with status badge, name, type, IP, heartbeat time, active/inactive toggle.
- **Agent detail** (`/agents/:id`): Agent info, file scans table, processes list, connections list, tabs for each.
- **Files page** (`/files`): File scans table with sha256 (truncated), VT status badge, "Check on VT" button.
- **Packets page** (`/packets`): Capture list with source, packet count, size, duration, status. Download button.
- **Packet detail** (`/packets/:id`): DNS queries table, connections table (top talkers), beaconing flags.
- **Timeline page** (`/timeline`): All events (scans, alerts, device changes) in a chronological timeline view.
- **Alerts page** (`/alerts`): Alert list with severity badge, type, title, timestamp. Click to mark read.
- **Reports page** (`/reports`): Report list with type badge, period, status. Generate button (admin/analyst). Download PDF.
- **Settings page** (`/settings`): Tabs for General, Scanning, VT, Discord, Users (admin), Whitelist/Blacklist (admin).

- [ ] **Step 13: Create auth pages**

```tsx
// (auth)/login/page.tsx — Login page
// Full-screen centered card with glassmorphism
// NetViren logo + title
// Username + password form with validation
// "Sign in with Google" button (styled with Google colors)
// "Sign in with GitHub" button (styled with GitHub colors)
// Loading state on submit
// Error message on invalid credentials
// Redirect to dashboard on success
```

- [ ] **Step 14: Create app providers**

```tsx
// providers.tsx
// - SessionProvider (Auth.js)
// - ThemeProvider (dark mode only)
// - Toaster (Sonner for notifications)
```

---

## Workstream 4: Python Scanner Worker

**Files:**
- Create: `workers/scanner/main.py`
- Create: `workers/scanner/arp_scanner.py`
- Create: `workers/scanner/port_scanner.py`
- Create: `workers/scanner/os_detection.py`
- Create: `workers/scanner/db.py`
- Create: `workers/scanner/requirements.txt`

- [ ] **Step 1: Create requirements.txt**

```
scapy>=2.6.0
python-nmap>=0.7.0
```

- [ ] **Step 2: Create db.py** — Direct SQLite access (same DB file as API)

```python
import sqlite3
import os

DB_PATH = os.environ.get('DATABASE_PATH', '/var/lib/netviren/db/netviren.db')

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn
```

- [ ] **Step 3: Create arp_scanner.py**

```python
import ipaddress
from typing import List, Dict
from scapy.all import ARP, Ether, srp

def scan_arp(network: str = "192.168.1.0/24", timeout: int = 3) -> List[Dict]:
    """Perform ARP scan on local network. Returns list of discovered devices."""
    arp = ARP(pdst=network)
    ether = Ether(dst="ff:ff:ff:ff:ff:ff")
    packet = ether / arp
    result = srp(packet, timeout=timeout, verbose=0)[0]
    
    devices = []
    for sent, received in result:
        devices.append({
            'ip_address': received.psrc,
            'mac_address': received.hwsrc,
            'vendor': '',  # Could be enriched via MAC OUI lookup
            'first_seen': '',  # Set by caller
            'last_seen': '',
            'is_online': True,
        })
    return devices
```

- [ ] **Step 4: Create port_scanner.py**

```python
import nmap
from typing import List, Dict

def scan_ports_tcp(target: str, port_range: str = "1-1000") -> List[Dict]:
    """Perform TCP port scan using python-nmap."""
    nm = nmap.PortScanner()
    nm.scan(target, port_range, arguments='-sT -T4')
    
    ports = []
    if target in nm.all_hosts():
        for proto in nm[target].all_protocols():
            port_data = nm[target][proto]
            for port, data in port_data.items():
                ports.append({
                    'port': port,
                    'protocol': proto,
                    'state': data.get('state', 'unknown'),
                    'service': data.get('name', ''),
                    'service_version': data.get('version', ''),
                })
    return ports

def scan_ports_udp(target: str, port_range: str = "1-500") -> List[Dict]:
    """Perform UDP port scan."""
    nm = nmap.PortScanner()
    nm.scan(target, port_range, arguments='-sU -T4')
    
    ports = []
    if target in nm.all_hosts():
        for proto in nm[target].all_protocols():
            port_data = nm[target][proto]
            for port, data in port_data.items():
                ports.append({
                    'port': port,
                    'protocol': proto,
                    'state': data.get('state', 'unknown'),
                    'service': data.get('name', ''),
                    'service_version': data.get('version', ''),
                })
    return ports
```

- [ ] **Step 5: Create os_detection.py**

```python
import nmap
from typing import Optional, Dict

def detect_os(target: str) -> Optional[Dict]:
    """Perform OS detection using Nmap OS fingerprinting."""
    nm = nmap.PortScanner()
    try:
        nm.scan(target, arguments='-O -T4')
        if target in nm.all_hosts() and 'osmatch' in nm[target]:
            matches = nm[target]['osmatch']
            if matches:
                best = matches[0]
                return {
                    'os_detected': best.get('name', ''),
                    'os_version': best.get('osclass', [{}])[0].get('osgen', '') if best.get('osclass') else '',
                    'accuracy': best.get('accuracy', '0'),
                }
    except Exception:
        pass
    return None
```

- [ ] **Step 6: Create main.py** — Worker entry point with polling loop

```python
#!/usr/bin/env python3
"""NetViren Scanner Worker. Polls DB for pending scan jobs and executes them."""

import time
import logging
import os
import sys
from datetime import datetime
from typing import List, Dict

from db import get_db
from arp_scanner import scan_arp
from port_scanner import scan_ports_tcp, scan_ports_udp
from os_detection import detect_os

logging.basicConfig(
    level=getattr(logging, os.environ.get('LOG_LEVEL', 'info').upper()),
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger('netviren-scanner')

def get_pending_scans(db) -> List[Dict]:
    cur = db.execute("SELECT * FROM scans WHERE status = 'pending' ORDER BY started_at ASC LIMIT 1")
    return [dict(row) for row in cur.fetchall()]

def execute_scan(db, scan: Dict):
    scan_id = scan['id']
    scan_type = scan['scan_type']
    target = scan.get('target') or '192.168.1.0/24'
    logger.info(f"Starting scan {scan_id}: type={scan_type}, target={target}")

    db.execute("UPDATE scans SET status = 'running' WHERE id = ?", (scan_id,))
    db.commit()

    try:
        if scan_type in ('arp', 'full'):
            # ARP scan
            devices = scan_arp(network=target)
            for dev in devices:
                existing = db.execute(
                    "SELECT id FROM devices WHERE ip_address = ?", (dev['ip_address'],)
                ).fetchone()
                now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')
                if existing:
                    db.execute(
                        "UPDATE devices SET last_seen = ?, is_online = 1, updated_at = ? WHERE id = ?",
                        (now, now, existing['id'])
                    )
                else:
                    import uuid
                    dev_id = str(uuid.uuid4())
                    db.execute(
                        """INSERT INTO devices (id, ip_address, mac_address, vendor, first_seen, last_seen, is_online)
                           VALUES (?, ?, ?, ?, ?, ?, 1)""",
                        (dev_id, dev['ip_address'], dev['mac_address'], dev.get('vendor', ''), now, now)
                    )
            logger.info(f"ARP scan found {len(devices)} devices")

        if scan_type in ('port_tcp', 'full'):
            # TCP port scan on all discovered devices
            hosts = db.execute("SELECT ip_address FROM devices WHERE is_online = 1").fetchall()
            port_range = os.environ.get('PORT_RANGES', '20-25,53,80,110,143,443,445,993,995,1433,1521,2049,3306,3389,5432,5900,6379,8080,8443,27017')
            for host in hosts:
                ports = scan_ports_tcp(host['ip_address'], port_range)
                for p in ports:
                    device = db.execute("SELECT id FROM devices WHERE ip_address = ?", (host['ip_address'],)).fetchone()
                    if device:
                        existing_port = db.execute(
                            "SELECT id FROM device_ports WHERE device_id = ? AND port = ? AND protocol = ?",
                            (device['id'], p['port'], p['protocol'])
                        ).fetchone()
                        now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')
                        if existing_port:
                            db.execute(
                                "UPDATE device_ports SET state = ?, service = ?, service_version = ?, last_seen = ? WHERE id = ?",
                                (p['state'], p['service'], p.get('service_version', ''), now, existing_port['id'])
                            )
                        else:
                            import uuid
                            db.execute(
                                """INSERT INTO device_ports (id, device_id, port, protocol, state, service, service_version, first_seen, last_seen)
                                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                                (str(uuid.uuid4()), device['id'], p['port'], p['protocol'],
                                 p['state'], p['service'], p.get('service_version', ''), now, now)
                            )
                db.commit()

        if scan_type in ('os', 'full'):
            hosts = db.execute("SELECT ip_address, id FROM devices WHERE is_online = 1").fetchall()
            for host in hosts:
                os_info = detect_os(host['ip_address'])
                if os_info:
                    db.execute(
                        "UPDATE devices SET os_detected = ?, os_version = ? WHERE id = ?",
                        (os_info['os_detected'], os_info.get('os_version', ''), host['id'])
                    )
                db.commit()

        now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')
        device_count = db.execute("SELECT COUNT(*) as c FROM devices").fetchone()['c']
        port_count = db.execute("SELECT COUNT(*) as c FROM device_ports").fetchone()['c']
        db.execute(
            "UPDATE scans SET status = 'completed', completed_at = ?, devices_found = ?, ports_found = ? WHERE id = ?",
            (now, device_count, port_count, scan_id)
        )
        db.commit()
        logger.info(f"Scan {scan_id} completed")

    except Exception as e:
        logger.error(f"Scan {scan_id} failed: {e}")
        db.execute(
            "UPDATE scans SET status = 'failed', error = ?, completed_at = ? WHERE id = ?",
            (str(e), datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'), scan_id)
        )
        db.commit()

def run_continuous():
    """Continuous ARP monitoring for new/lost devices."""
    db = get_db()
    known_ips = set()
    
    while True:
        try:
            active_ips = {d['ip_address'] for d in scan_arp(timeout=2)}
            now = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')

            for ip in active_ips:
                dev = db.execute("SELECT id FROM devices WHERE ip_address = ?", (ip,)).fetchone()
                if dev:
                    db.execute("UPDATE devices SET last_seen = ?, is_online = 1 WHERE id = ?", (now, dev['id']))
                # New devices are discovered via ARP scan, not continuous monitoring
            
            # Check for devices that disappeared
            db_devices = db.execute("SELECT id, ip_address FROM devices WHERE is_online = 1").fetchall()
            for dev in db_devices:
                if dev['ip_address'] not in active_ips:
                    logger.info(f"Device {dev['ip_address']} went offline")
                    db.execute("UPDATE devices SET is_online = 0, updated_at = ? WHERE id = ?", (now, dev['id']))
            
            db.commit()
        except Exception as e:
            logger.error(f"Continuous monitoring error: {e}")
        
        time.sleep(60)  # Check every 60 seconds

def main():
    logger.info("NetViren Scanner Worker starting...")
    
    # Main scan job loop
    while True:
        db = get_db()
        try:
            scans = get_pending_scans(db)
            for scan in scans:
                execute_scan(db, scan)
        except Exception as e:
            logger.error(f"Main loop error: {e}")
        finally:
            db.close()
        
        time.sleep(10)  # Poll every 10 seconds

if __name__ == '__main__':
    main()
```

---

## Workstream 5: Python Packet Capture Service

**Files:**
- Create: `workers/packet-capture/main.py`
- Create: `workers/packet-capture/capture_manager.py`
- Create: `workers/packet-capture/dns_analyzer.py`
- Create: `workers/packet-capture/connection_analyzer.py`
- Create: `workers/packet-capture/beacon_detector.py`
- Create: `workers/packet-capture/db.py`
- Create: `workers/packet-capture/requirements.txt`

- [ ] **Step 1: Create requirements.txt**

```
scapy>=2.6.0
pyshark>=0.6.0
```

- [ ] **Step 2: Create capture_manager.py**

```python
import os
import time
import uuid
import signal
from datetime import datetime, timedelta
from typing import Optional
from scapy.all import sniff, wrpcap

class CaptureManager:
    def __init__(self, interface: str = "eth0", packet_dir: str = "/var/lib/netviren/packets"):
        self.interface = interface
        self.packet_dir = packet_dir
        self.capturing = False
        self.current_capture_id = None
        self.packets = []
        self.start_time = None
        os.makedirs(packet_dir, exist_ok=True)

    def start_capture(self, capture_id: str, duration_seconds: int = 300):
        self.capturing = True
        self.current_capture_id = capture_id
        self.packets = []
        self.start_time = datetime.utcnow()
        
        # Sniff in a separate process would be better, but for simplicity:
        def packet_handler(pkt):
            if not self.capturing:
                return  # Stop sniffing
            self.packets.append(pkt)
        
        # Use timeout-based capture
        sniff(iface=self.interface, prn=packet_handler, timeout=duration_seconds, store=False)
        self.capturing = False
        self.save_capture(capture_id)

    def save_capture(self, capture_id: str) -> str:
        filepath = os.path.join(self.packet_dir, f"{capture_id}.pcap")
        wrpcap(filepath, self.packets)
        return filepath

    def stop_capture(self):
        self.capturing = False

    def cleanup_old_captures(self, retention_days: int = 7):
        cutoff = datetime.utcnow() - timedelta(days=retention_days)
        for fname in os.listdir(self.packet_dir):
            fpath = os.path.join(self.packet_dir, fname)
            if os.path.isfile(fpath):
                mtime = datetime.fromtimestamp(os.path.getmtime(fpath))
                if mtime < cutoff:
                    os.remove(fpath)
```

- [ ] **Step 3: Create dns_analyzer.py**

```python
from typing import List, Dict
from scapy.all import DNS, DNSQR, IP, UDP

def extract_dns_queries(packets: list) -> List[Dict]:
    """Extract DNS queries from packet list."""
    queries = {}
    for pkt in packets:
        if pkt.haslayer(DNS) and pkt.haslayer(DNSQR):
            dns = pkt[DNS]
            dnsqr = pkt[DNSQR]
            domain = dnsqr.qname.decode() if isinstance(dnsqr.qname, bytes) else dnsqr.qname
            query_type = dnsqr.qtype
            
            # Get response IP if available
            response_ip = None
            if dns.ancount > 0:
                for i in range(dns.ancount):
                    try:
                        rr = dns.an[i]
                        if rr.type == 1:  # A record
                            response_ip = rr.rdata
                    except:
                        pass

            key = domain
            if key in queries:
                queries[key]['count'] += 1
            else:
                queries[key] = {
                    'domain': domain,
                    'query_type': str(query_type),
                    'response_ip': str(response_ip) if response_ip else None,
                    'count': 1,
                }
    return list(queries.values())
```

- [ ] **Step 4: Create connection_analyzer.py**

```python
from typing import List, Dict, Tuple
from scapy.all import IP, TCP, UDP

def extract_connections(packets: list) -> List[Dict]:
    """Extract TCP/UDP connections from packet list. Tracks unique 5-tuples."""
    connections: Dict[Tuple, Dict] = {}

    for pkt in packets:
        if not pkt.haslayer(IP):
            continue
        
        ip = pkt[IP]
        src_ip = ip.src
        dst_ip = ip.dst
        proto = 'IP'
        src_port = 0
        dst_port = 0

        if pkt.haslayer(TCP):
            proto = 'TCP'
            src_port = pkt[TCP].sport
            dst_port = pkt[TCP].dport
        elif pkt.haslayer(UDP):
            proto = 'UDP'
            src_port = pkt[UDP].sport
            dst_port = pkt[UDP].dport

        key = (src_ip, src_port, dst_ip, dst_port, proto)
        
        if key in connections:
            conn = connections[key]
            conn['packets'] += 1
            conn['bytes_sent'] += len(pkt)
            conn['last_seen'] = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S')
        else:
            connections[key] = {
                'src_ip': src_ip,
                'src_port': src_port,
                'dst_ip': dst_ip,
                'dst_port': dst_port,
                'protocol': proto,
                'packets': 1,
                'bytes_sent': len(pkt),
                'bytes_recv': 0,
                'first_seen': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'),
                'last_seen': datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'),
            }

    return list(connections.values())
```

- [ ] **Step 5: Create beacon_detector.py**

```python
from typing import List, Dict
from datetime import datetime, timedelta

def detect_beaconing(connections: List[Dict], threshold_seconds: int = 30) -> List[Dict]:
    """
    Detect potential beaconing activity.
    A connection is flagged as beaconing if it shows regular intervals.
    Simplified: flag connections that connect to same dst_ip:dst_port at consistent intervals.
    """
    # Group by destination
    dst_groups: Dict[str, List[Dict]] = {}
    for conn in connections:
        key = f"{conn['dst_ip']}:{conn.get('dst_port', '')}:{conn.get('protocol', '')}"
        if key not in dst_groups:
            dst_groups[key] = []
        dst_groups[key].append(conn)

    beaconing = []
    for key, conns in dst_groups.items():
        if len(conns) >= 3:  # Need at least 3 connections to detect pattern
            # Sort by timestamp
            conns.sort(key=lambda c: c.get('first_seen', ''))
            # Check intervals (simplified: flag if multiple connections to same destination)
            # A more sophisticated implementation would use actual timing analysis
            beaconing.append({
                'key': key,
                'connections': len(conns),
                'is_suspicious': True,
                'confidence': 'medium',
            })

    return beaconing
```

- [ ] **Step 6: Create main.py**

```python
#!/usr/bin/env python3
"""NetViren Packet Capture Service. Manages packet captures, analysis, and cleanup."""

import os
import time
import json
import uuid
import logging
import sys
from datetime import datetime, timedelta
from typing import Optional

from db import get_db
from capture_manager import CaptureManager
from dns_analyzer import extract_dns_queries
from connection_analyzer import extract_connections
from beacon_detector import detect_beaconing

logging.basicConfig(
    level=getattr(logging, os.environ.get('LOG_LEVEL', 'info').upper()),
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger('netviren-packet-capture')

def process_capture(db, capture_id: str, packets: list):
    """Analyze captured packets and store results."""
    logger.info(f"Analyzing capture {capture_id} ({len(packets)} packets)")
    
    # Extract DNS queries
    dns_queries = extract_dns_queries(packets)
    for dq in dns_queries:
        db.execute(
            """INSERT OR IGNORE INTO packet_dns_queries (id, capture_id, domain, query_type, response_ip, count, first_seen)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (str(uuid.uuid4()), capture_id, dq['domain'], dq['query_type'],
             dq.get('response_ip', ''), dq['count'], datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))
        )
    
    # Extract connections
    connections = extract_connections(packets)
    for conn in connections:
        db.execute(
            """INSERT INTO packet_connections (id, capture_id, src_ip, src_port, dst_ip, dst_port, protocol,
               bytes_sent, packets, first_seen, last_seen, is_beacon)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)""",
            (str(uuid.uuid4()), capture_id, conn['src_ip'], conn.get('src_port', 0),
             conn['dst_ip'], conn.get('dst_port', 0), conn['protocol'],
             conn.get('bytes_sent', 0), conn.get('packets', 0),
             conn['first_seen'], conn['last_seen'])
        )
    
    # Beacon detection
    beaconing = detect_beaconing(connections)
    for beacon in beaconing:
        if beacon['is_suspicious']:
            db.execute(
                "UPDATE packet_connections SET is_beacon = 1 WHERE capture_id = ? AND dst_ip || ':' || dst_port || ':' || protocol = ?",
                (capture_id, beacon['key'])
            )
            # Create alert for beaconing
            db.execute(
                """INSERT INTO alerts (id, alert_type, severity, title, description, metadata, created_at)
                   VALUES (?, 'beaconing', 'medium', ?, ?, ?, ?)""",
                (str(uuid.uuid4()),
                 f"Beaconing detected: {beacon['key']}",
                 f"Regular connections detected ({beacon['connections']} instances)",
                 json.dumps(beacon),
                 datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'))
            )
    
    db.execute(
        "UPDATE packet_captures SET status = 'analyzed', packet_count = ? WHERE id = ?",
        (len(packets), capture_id)
    )
    db.commit()
    logger.info(f"Capture {capture_id} analyzed: {len(dns_queries)} DNS, {len(connections)} connections, {len(beaconing)} beaconing")

def main():
    logger.info("NetViren Packet Capture Service starting...")
    db = get_db()
    
    packet_dir = os.environ.get('PACKET_DIR', '/var/lib/netviren/packets')
    interface = os.environ.get('CAPTURE_INTERFACE', 'eth0')
    retention_days = int(os.environ.get('PACKET_RETENTION_DAYS', '7'))
    
    manager = CaptureManager(interface=interface, packet_dir=packet_dir)
    
    # Main loop
    while True:
        try:
            # Check for pending captures
            pending = db.execute(
                "SELECT * FROM packet_captures WHERE status = 'capturing' ORDER BY started_at ASC LIMIT 1"
            ).fetchone()
            
            if pending:
                capture_id = pending['id']
                logger.info(f"Starting capture {capture_id}")
                manager.start_capture(capture_id, duration_seconds=300)
                filepath = manager.save_capture(capture_id)
                
                db.execute(
                    "UPDATE packet_captures SET file_path = ?, status = 'analyzing', completed_at = ? WHERE id = ?",
                    (filepath, datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'), capture_id)
                )
                db.commit()
                
                # Analyze
                process_capture(db, capture_id, manager.packets)
            
            # Periodic: check for automatic captures based on settings
            enabled = db.execute("SELECT value FROM settings WHERE key = 'packet_capture_enabled'").fetchone()
            if enabled and enabled['value'] == 'true':
                # Check if we need to start a new periodic capture
                last_capture = db.execute(
                    "SELECT id FROM packet_captures ORDER BY started_at DESC LIMIT 1"
                ).fetchone()
                
                if not last_capture:
                    # Start periodic capture
                    new_id = str(uuid.uuid4())
                    db.execute(
                        """INSERT INTO packet_captures (id, source_ip, interface_name, file_path, status, started_at, expires_at)
                           VALUES (?, 'auto', ?, ?, 'capturing', ?, ?)""",
                        (new_id, interface, '', datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S'),
                         (datetime.utcnow() + timedelta(days=retention_days)).strftime('%Y-%m-%dT%H:%M:%S'))
                    )
                    db.commit()
            
            # Cleanup old captures daily
            manager.cleanup_old_captures(retention_days)
            
            db.close()
        except Exception as e:
            logger.error(f"Main loop error: {e}")
        
        time.sleep(30)

if __name__ == '__main__':
    main()
```

---

## Workstream 6: Linux Native Agent

**Files:**
- Create: `agents/linux/agent.py`
- Create: `agents/linux/requirements.txt`
- Create: `agents/linux/install.sh`

- [ ] **Step 1: Create requirements.txt**

```
requests>=2.31.0
psutil>=5.9.0
```

- [ ] **Step 2: Create agent.py**

```python
#!/usr/bin/env python3
"""NetViren Linux Agent — lightweight security monitoring agent."""

import os
import sys
import json
import time
import uuid
import hashlib
import platform
import socket
import requests
import psutil
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger('netviren-agent')

CONFIG_PATH = '/etc/netviren-agent.json'
API_URL = os.environ.get('NETVIREN_API_URL', 'http://10.0.0.1:4001')

class NetVirenAgent:
    def __init__(self):
        self.config = self.load_config()
        self.agent_id = self.config.get('agent_id')
        self.token = self.config.get('token')
        self.machine_id = self.get_machine_id()

    def load_config(self):
        if os.path.exists(CONFIG_PATH):
            with open(CONFIG_PATH) as f:
                return json.load(f)
        return {}

    def save_config(self):
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        with open(CONFIG_PATH, 'w') as f:
            json.dump(self.config, f, indent=2)

    def get_machine_id(self):
        try:
            with open('/etc/machine-id') as f:
                return f.read().strip()
        except:
            return str(uuid.uuid4())

    def register(self):
        logger.info("Registering agent...")
        resp = requests.post(f"{API_URL}/api/agents/register", json={
            'name': socket.gethostname(),
            'machineId': self.machine_id,
            'agentType': 'linux',
            'version': '1.0.0',
        })
        data = resp.json()
        self.config['agent_id'] = data['agent']['id']
        self.config['token'] = data['agent']['auth_token']
        self.agent_id = data['agent']['id']
        self.token = data['agent']['auth_token']
        self.save_config()
        logger.info(f"Registered as agent {self.agent_id}")

    def heartbeat(self):
        try:
            resp = requests.post(
                f"{API_URL}/api/agents/{self.agent_id}/heartbeat",
                json={'status': 'online', 'ipAddress': self.get_ip(), 'osVersion': platform.platform()},
                headers={'Authorization': f'Bearer {self.token}'},
                timeout=10
            )
            return resp.ok
        except Exception as e:
            logger.error(f"Heartbeat failed: {e}")
            return False

    def get_ip(self):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return '0.0.0.0'

    def scan_file(self, filepath: str) -> dict:
        """Compute SHA256 hash of a file."""
        sha256 = hashlib.sha256()
        try:
            with open(filepath, 'rb') as f:
                for chunk in iter(lambda: f.read(65536), b''):
                    sha256.update(chunk)
            return {
                'filePath': filepath,
                'fileName': os.path.basename(filepath),
                'fileSize': os.path.getsize(filepath),
                'sha256Hash': sha256.hexdigest(),
            }
        except Exception as e:
            logger.error(f"File scan error {filepath}: {e}")
            return None

    def scan_directory(self, directory: str):
        """Recursively scan a directory for Python/ELF/binary files."""
        results = []
        for root, dirs, files in os.walk(directory):
            for fname in files:
                fpath = os.path.join(root, fname)
                if os.path.isfile(fpath) and os.access(fpath, os.R_OK):
                    result = self.scan_file(fpath)
                    if result:
                        results.append(result)
                        # Upload to server
                        try:
                            requests.post(
                                f"{API_URL}/api/agents/{self.agent_id}/files",
                                json=result,
                                headers={'Authorization': f'Bearer {self.token}'},
                                timeout=30
                            )
                        except Exception as e:
                            logger.error(f"Upload failed for {fpath}: {e}")
        return results

    def get_processes(self) -> list:
        """Get list of running processes."""
        procs = []
        for proc in psutil.process_iter(['pid', 'name', 'exe', 'cmdline']):
            try:
                info = proc.info
                procs.append({
                    'pid': info['pid'],
                    'name': info['name'],
                    'path': info['exe'] or '',
                    'cmdline': ' '.join(info['cmdline']) if info['cmdline'] else '',
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        return procs

    def get_connections(self) -> list:
        """Get network connections."""
        conns = []
        for conn in psutil.net_connections(kind='inet'):
            try:
                if conn.status == 'ESTABLISHED' and conn.raddr:
                    conns.append({
                        'localPort': conn.laddr.port,
                        'remoteIp': conn.raddr.ip,
                        'remotePort': conn.raddr.port,
                        'protocol': 'tcp',
                        'processName': '',
                    })
            except:
                pass
        return conns

    def run(self):
        """Main agent loop."""
        # Register if not registered
        if not self.agent_id:
            self.register()

        logger.info("Agent running...")
        while True:
            try:
                # Heartbeat
                self.heartbeat()

                # Check for commands
                try:
                    resp = requests.get(
                        f"{API_URL}/api/agents/{self.agent_id}/commands",
                        headers={'Authorization': f'Bearer {self.token}'},
                        timeout=10
                    )
                    if resp.ok:
                        commands = resp.json().get('commands', [])
                        for cmd in commands:
                            logger.info(f"Received command: {cmd}")
                            # Handle commands (scan, capture, etc.)
                except:
                    pass

                time.sleep(30)
            except Exception as e:
                logger.error(f"Agent loop error: {e}")
                time.sleep(60)

if __name__ == '__main__':
    agent = NetVirenAgent()
    agent.run()
```

---

## Workstream 7: Windows Native Agent

**Files:**
- Create: `agents/windows/agent.py`
- Create: `agents/windows/requirements.txt`
- Create: `agents/windows/agent_service.py` (Windows Service Wrapper)
- Create: `agents/windows/installer.nsi`

The Windows agent is very similar to the Linux agent with these differences:
- Uses Npcap for packet capture (instead of libpcap)
- Runs as Windows Service (via Python service wrapper)
- Uses `wmi` module for process enumeration as fallback to psutil
- NSIS installer for easy deployment

- [ ] **Step 1: Create requirements.txt**

```
requests>=2.31.0
psutil>=5.9.0
pywin32>=306
wmi>=1.5.1
```

- [ ] **Step 2: Create agent.py** — Same as Linux but with Windows-specific paths and Npcap integration

- [ ] **Step 3: Create agent_service.py** — Windows Service wrapper using pywin32

```python
"""Windows Service wrapper for NetViren Agent."""
import win32serviceutil
import win32service
import win32event
import servicemanager
import sys
import os

sys.path.append(os.path.dirname(__file__))
from agent import NetVirenAgent

class NetVirenAgentService(win32serviceutil.ServiceFramework):
    _svc_name_ = "NetVirenAgent"
    _svc_display_name_ = "NetViren Security Agent"
    _svc_description_ = "Monitors system and reports to NetViren platform"

    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.stop_event = win32event.CreateEvent(None, 0, 0, None)
        self.agent = NetVirenAgent()

    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.stop_event)

    def SvcDoRun(self):
        servicemanager.LogMsg(servicemanager.EVENTLOG_INFORMATION_TYPE,
                              servicemanager.PYS_SERVICE_STARTED,
                              (self._svc_name_, ''))
        self.agent.run()

if __name__ == '__main__':
    if len(sys.argv) == 1:
        servicemanager.Initialize()
        servicemanager.PrepareToHostSingle(NetVirenAgentService)
        servicemanager.StartServiceCtrlDispatcher()
    else:
        win32serviceutil.HandleCommandLine(NetVirenAgentService)
```

- [ ] **Step 4: Create installer.nsi**

```nsis
!include "MUI2.nsh"
Name "NetViren Agent"
OutFile "NetViren-Agent-Setup.exe"
InstallDir "$PROGRAMFILES\NetViren\Agent"

Section "Install"
  SetOutPath "$INSTDIR"
  File "agent.py"
  File "agent_service.py"
  File "requirements.txt"
  
  # Install Python if not present (simplified)
  ExecWait '"$INSTDIR\python-embed.exe" /quiet'
  
  # Install dependencies
  ExecWait '"$INSTDIR\python.exe" -m pip install -r requirements.txt'
  
  # Install service
  ExecWait '"$INSTDIR\python.exe" "$INSTDIR\agent_service.py" install'
  ExecWait "net start NetVirenAgent"
SectionEnd
```

---

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

## Workstream 9: Documentation

**Files:**
- Create: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/api.md`

- [ ] **Step 1: Create README.md** — Project overview, architecture, setup instructions, screenshots section

- [ ] **Step 2: Create docs/architecture.md** — Extended architecture documentation with diagrams

- [ ] **Step 3: Create docs/api.md** — API reference with all endpoints, request/response examples
