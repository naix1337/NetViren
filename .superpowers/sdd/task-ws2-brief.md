
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

