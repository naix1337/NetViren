import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/connection.js';
import { authMiddleware } from '../../middleware/auth.js';
import { broadcast } from '../../websocket/handler.js';
import { nanoid } from 'nanoid';

export async function scanRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/scans', async (_req, _rep) => {
    const scans = getDb().prepare('SELECT * FROM scans ORDER BY started_at DESC').all();
    return { scans };
  });

  app.post('/api/scans', async (req, reply) => {
    const { scanType, target } = req.body as { scanType?: string; target?: string };
    if (!scanType) return reply.status(400).send({ error: 'Bad Request', message: 'scanType is required' });
    const id = nanoid();
    getDb().prepare(`
      INSERT INTO scans (id, scan_type, status, target, triggered_by)
      VALUES (?, ?, 'pending', ?, ?)
    `).run(id, scanType, target || null, req.user?.userId || null);
    const scan = getDb().prepare('SELECT * FROM scans WHERE id = ?').get(id);
    broadcast('scan:created', scan);
    return reply.status(201).send({ scan });
  });

  app.get('/api/scans/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const scan = getDb().prepare('SELECT * FROM scans WHERE id = ?').get(id);
    if (!scan) return reply.status(404).send({ error: 'Not found' });
    return { scan };
  });

  app.post('/api/scans/:id/cancel', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const existing = db.prepare('SELECT * FROM scans WHERE id = ?').get(id) as any;
    if (!existing) return reply.status(404).send({ error: 'Not found' });
    if (existing.status !== 'pending' && existing.status !== 'running') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Scan cannot be cancelled' });
    }
    db.prepare("UPDATE scans SET status = 'failed', error = 'cancelled', completed_at = datetime('now') WHERE id = ?").run(id);
    const scan = db.prepare('SELECT * FROM scans WHERE id = ?').get(id);
    broadcast('scan:updated', scan);
    return { scan };
  });
}
