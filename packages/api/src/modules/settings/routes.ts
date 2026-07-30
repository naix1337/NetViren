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

  async function updateSettings(req: any, reply: any) {
    if (!req.body) return reply.status(400).send({ error: 'Bad Request', message: 'Request body is required' });
    const { settings } = req.body as { settings: Record<string, string> };
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
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
  }

  app.put('/api/settings', updateSettings);
  app.post('/api/settings', updateSettings);

  // Test Discord webhook
  app.post('/api/settings/test-webhook', async (req, reply) => {
    const { webhookUrl } = req.body as { webhookUrl?: string };
    if (!webhookUrl) {
      return reply.status(400).send({ error: 'Bad Request', message: 'webhookUrl is required' });
    }
    // Validate webhook URL to prevent SSRF
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(webhookUrl);
    } catch {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid webhook URL' });
    }
    if (parsedUrl.protocol !== 'https:') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Webhook URL must use HTTPS' });
    }
    if (!parsedUrl.hostname.endsWith('discord.com') && !parsedUrl.hostname.endsWith('discordapp.com')) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Webhook URL must be a Discord webhook' });
    }
    try {
      const response = await fetch(webhookUrl, { redirect: 'manual',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'NetViren Test Notification',
          embeds: [{
            title: 'Webhook Test',
            description: 'This is a test message from NetViren to verify your Discord webhook configuration.',
            color: 0x00ff00,
            timestamp: new Date().toISOString(),
          }],
        }),
      });
      if (!response.ok) {
        return reply.status(400).send({ error: 'Webhook failed', message: `Discord responded with status ${response.status}` });
      }
      return { success: true, message: 'Test webhook sent successfully' };
    } catch (err: any) {
      return reply.status(500).send({ error: 'Webhook error', message: err.message || 'Failed to send test webhook' });
    }
  });
}
