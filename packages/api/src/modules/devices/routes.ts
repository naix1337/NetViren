import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/connection.js';
import { authMiddleware } from '../../middleware/auth.js';

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
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

export async function deviceRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/devices', async (_req, _rep) => {
    const devices = getDb().prepare('SELECT * FROM devices ORDER BY last_seen DESC').all();
    return { devices: (devices as any[]).map(formatDevice) };
  });

  app.get('/api/devices/:id', async (req, rep) => {
    const { id } = req.params as { id: string };
    const device = getDb().prepare('SELECT * FROM devices WHERE id = ?').get(id) as any;
    if (!device) return rep.status(404).send({ error: 'Not found' });
    return { device: formatDevice(device) };
  });

  app.get('/api/devices/:id/ports', async (req) => {
    const { id } = req.params as { id: string };
    const ports = getDb().prepare('SELECT * FROM device_ports WHERE device_id = ? ORDER BY port').all(id);
    return { ports };
  });

  app.patch('/api/devices/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { whitelisted, blacklisted, tags, notes } = req.body as {
      whitelisted?: boolean; blacklisted?: boolean; tags?: string[]; notes?: string;
    };
    const db = getDb();
    const existing = db.prepare('SELECT id FROM devices WHERE id = ?').get(id);
    if (!existing) return reply.status(404).send({ error: 'Not found' });

    const updates: string[] = [];
    const values: any[] = [];
    if (whitelisted !== undefined) { updates.push('whitelisted = ?'); values.push(whitelisted ? 1 : 0); }
    if (blacklisted !== undefined) { updates.push('blacklisted = ?'); values.push(blacklisted ? 1 : 0); }
    if (tags !== undefined) { updates.push('tags = ?'); values.push(JSON.stringify(tags)); }
    if (notes !== undefined) { updates.push('notes = ?'); values.push(notes); }
    if (updates.length > 0) {
      updates.push('updated_at = datetime(\'now\')');
      values.push(id);
      db.prepare(`UPDATE devices SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(id) as any;
    return { device: formatDevice(device) };
  });
}
