import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/connection.js';
import { requireRole } from '../../middleware/auth.js';

export async function settingRoutes(app: FastifyInstance): Promise<void> {
  // All settings endpoints require admin role
  app.addHook('preHandler', requireRole('admin'));

  app.get('/api/settings', async (_req, _rep) => {
    const rows = getDb().prepare('SELECT key, value FROM settings').all() as any[];
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return { settings };
  });

  app.put('/api/settings', async (req, reply) => {
    const { settings } = req.body as { settings: Record<string, string> };
    if (!settings || typeof settings !== 'object') {
      return reply.status(400).send({ error: 'Bad Request', message: 'settings object is required' });
    }
    const db = getDb();
    const upsert = db.prepare(`
      INSERT INTO settings (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    const transaction = db.transaction((entries: [string, string][]) => {
      for (const [key, value] of entries) {
        upsert.run(key, String(value));
      }
    });
    transaction(Object.entries(settings));
    return { success: true };
  });
}
