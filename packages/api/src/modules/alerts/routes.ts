import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/connection.js';
import { authMiddleware } from '../../middleware/auth.js';
import { broadcast } from '../../websocket/handler.js';

export async function alertRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/alerts', async (req, _rep) => {
    const { severity, isRead, limit, offset } = req.query as {
      severity?: string; isRead?: string; limit?: string; offset?: string;
    };
    let sql = 'SELECT * FROM alerts';
    const conditions: string[] = [];
    const params: any[] = [];

    if (severity) {
      conditions.push('severity = ?');
      params.push(severity);
    }
    if (isRead !== undefined) {
      conditions.push('is_read = ?');
      params.push(isRead === 'true' ? 1 : 0);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += ' ORDER BY created_at DESC';

    const limitVal = parseInt(limit || '50', 10);
    const offsetVal = parseInt(offset || '0', 10);
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limitVal, offsetVal);

    const alerts = getDb().prepare(sql).all(...params);
    const total = (getDb().prepare('SELECT COUNT(*) as count FROM alerts' + (conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '')).get(...params.slice(0, -2)) as any)?.count || 0;
    const unreadCount = (getDb().prepare("SELECT COUNT(*) as count FROM alerts WHERE is_read = 0").get() as any)?.count || 0;

    return { alerts, total, unreadCount };
  });

  app.patch('/api/alerts/:id/read', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id) as any;
    if (!alert) return reply.status(404).send({ error: 'Not found' });
    db.prepare("UPDATE alerts SET is_read = 1 WHERE id = ?").run(id);
    const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
    broadcast('alert:updated', updated);
    return { alert: updated };
  });

  app.patch('/api/alerts/read-all', async (_req, _rep) => {
    const db = getDb();
    db.prepare("UPDATE alerts SET is_read = 1 WHERE is_read = 0").run();
    broadcast('alerts:read-all', {});
    return { success: true };
  });
}
