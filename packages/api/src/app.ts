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
import { authMiddleware } from './middleware/auth.js';

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

  // WebSocket for dashboard live updates (authenticated)
  app.register(async function (fastify) {
    fastify.get('/ws', { websocket: true, preHandler: authMiddleware }, (socket, req) => {
      socket.on('message', (data: Buffer) => { /* handle incoming WS messages */ });
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
