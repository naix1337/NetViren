import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/connection.js';
import { getEnv } from '../../config/env.js';
import { authMiddleware } from '../../middleware/auth.js';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';

export async function agentRoutes(app: FastifyInstance): Promise<void> {
  // Agent registration and heartbeat use token-based auth (no JWT)
  // All other agent routes require JWT authentication
  app.addHook('preHandler', async (req, reply) => {
    const path = req.url.split('?')[0];
    if (path === '/api/agents/register' || path.match(/^\/api\/agents\/[^/]+\/heartbeat$/)) {
      return; // Allow without JWT
    }
    if (path.startsWith('/api/agents')) {
      await authMiddleware(req, reply);
      if (reply.sent) return;
    }
  });

  // Register a new agent (agent-to-server, uses shared secret in body)
  app.post('/api/agents/register', async (req, reply) => {
    const { name, machineId, agentType, version, ipAddress, osVersion, publicKey, capabilities, registrationKey } = req.body as {
      name: string; machineId: string; agentType: string; version?: string;
      ipAddress?: string; osVersion?: string; publicKey?: string; capabilities?: string; registrationKey?: string;
    };
    if (!name || !machineId || !agentType) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name, machineId, and agentType are required' });
    }
    if (!['windows', 'linux'].includes(agentType)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'agentType must be windows or linux' });
    }

    // If AGENT_SECRET is configured, require matching registrationKey
    const agentSecret = getEnv().AGENT_SECRET;
    if (agentSecret && registrationKey !== agentSecret) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid registration key' });
    }
    const db = getDb();
    const existing = db.prepare('SELECT * FROM agents WHERE machine_id = ?').get(machineId) as any;
    if (existing) {
      // Re-register: update info and generate new token
      const authToken = nanoid(64);
      db.prepare(`
        UPDATE agents SET name = ?, version = ?, ip_address = ?, os_version = ?,
          public_key = ?, capabilities = ?, auth_token = ?, status = 'online',
          last_heartbeat = datetime('now')
        WHERE machine_id = ?
      `).run(name, version ?? null, ipAddress ?? null, osVersion ?? null, publicKey ?? null, capabilities ?? null, authToken, machineId);
      return { agent: { ...existing, auth_token: authToken } };
    }
    const id = nanoid();
    const authToken = nanoid(64);
    db.prepare(`
      INSERT INTO agents (id, name, machine_id, agent_type, version, ip_address, os_version,
        status, last_heartbeat, auth_token, public_key, capabilities)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'online', datetime('now'), ?, ?, ?)
    `).run(id, name, machineId, agentType, version ?? null, ipAddress ?? null, osVersion ?? null, authToken, publicKey ?? null, capabilities ?? null);
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
    return reply.status(201).send({ agent: { ...(agent as any), auth_token: authToken } });
  });

  // Agent heartbeat (token-authenticated)
  app.post('/api/agents/:id/heartbeat', async (req, reply) => {
    const { id } = req.params as { id: string };
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return reply.status(401).send({ error: 'Unauthorized', message: 'Missing token' });
    const db = getDb();
    const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
    if (!agent) return reply.status(404).send({ error: 'Not found' });
    if (agent.auth_token !== token) return reply.status(403).send({ error: 'Forbidden', message: 'Invalid token' });
    db.prepare("UPDATE agents SET status = 'online', last_heartbeat = datetime('now'), ip_address = COALESCE(?, ip_address) WHERE id = ?")
      .run((req.body as any)?.ipAddress ?? null, id);
    return { status: 'ok' };
  });

  // Get all agents
  app.get('/api/agents', async (_req, _rep) => {
    const agents = getDb().prepare('SELECT * FROM agents ORDER BY registered_at DESC').all();
    return { agents };
  });

  // Get single agent
  app.get('/api/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = getDb().prepare('SELECT * FROM agents WHERE id = ?').get(id) as any;
    if (!agent) return reply.status(404).send({ error: 'Not found' });
    return { agent };
  });

  // Get agent files
  app.get('/api/agents/:id/files', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = getDb().prepare('SELECT id FROM agents WHERE id = ?').get(id);
    if (!agent) return reply.status(404).send({ error: 'Not found' });
    const files = getDb().prepare('SELECT * FROM agent_file_scans WHERE agent_id = ? ORDER BY first_seen DESC').all(id);
    return { files };
  });

  // Get agent processes
  app.get('/api/agents/:id/processes', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = getDb().prepare('SELECT id FROM agents WHERE id = ?').get(id);
    if (!agent) return reply.status(404).send({ error: 'Not found' });
    const processes = getDb().prepare('SELECT * FROM agent_processes WHERE agent_id = ? ORDER BY first_seen DESC').all(id);
    return { processes };
  });

  // Get agent connections
  app.get('/api/agents/:id/connections', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = getDb().prepare('SELECT id FROM agents WHERE id = ?').get(id);
    if (!agent) return reply.status(404).send({ error: 'Not found' });
    const connections = getDb().prepare('SELECT * FROM agent_connections WHERE agent_id = ? ORDER BY first_seen DESC').all(id);
    return { connections };
  });

  // Get agent commands (placeholder - command system TBD)
  app.get('/api/agents/:id/commands', async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = getDb().prepare('SELECT id FROM agents WHERE id = ?').get(id);
    if (!agent) return reply.status(404).send({ error: 'Not found' });
    return { commands: [] };
  });

  // Delete an agent
  app.delete('/api/agents/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(id);
    if (!agent) return reply.status(404).send({ error: 'Not found' });
    db.prepare('DELETE FROM agents WHERE id = ?').run(id);
    return reply.status(204).send();
  });
}
