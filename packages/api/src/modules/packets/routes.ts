import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/connection.js';
import { authMiddleware, requireRole } from '../../middleware/auth.js';
import { broadcast } from '../../websocket/handler.js';
import { nanoid } from 'nanoid';
import * as fs from 'fs';
import * as path from 'path';

const PACKET_DIR = process.env.PACKET_DIR || '/var/lib/netviren/packets';

function validatePacketPath(filePath: string): string {
  const resolved = fs.realpathSync(path.resolve(filePath));
  const packetDir = fs.realpathSync(path.resolve(PACKET_DIR)) + path.sep;
  if (!resolved.startsWith(packetDir)) {
    throw new Error('Access denied: file outside packet directory');
  }
  return resolved;
}

export async function packetRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/packets', async (_req, _rep) => {
    const packets = getDb().prepare('SELECT * FROM packet_captures ORDER BY started_at DESC').all();
    return { packets };
  });

  app.get('/api/packets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const packet = getDb().prepare('SELECT * FROM packet_captures WHERE id = ?').get(id) as any;
    if (!packet) return reply.status(404).send({ error: 'Not found' });
    const dnsQueries = getDb().prepare('SELECT * FROM packet_dns_queries WHERE capture_id = ? ORDER BY first_seen').all(id);
    const connections = getDb().prepare('SELECT * FROM packet_connections WHERE capture_id = ? ORDER BY first_seen').all(id);
    return { packet, dnsQueries, connections };
  });

  app.get('/api/packets/:id/download', async (req, reply) => {
    const { id } = req.params as { id: string };
    const packet = getDb().prepare('SELECT * FROM packet_captures WHERE id = ?').get(id) as any;
    if (!packet) return reply.status(404).send({ error: 'Not found' });
    const filePath = packet.file_path;
    if (!filePath) return reply.status(404).send({ error: 'File not found' });
    // Validate path before checking existence (prevents path traversal)
    let safePath: string;
    try {
      safePath = validatePacketPath(filePath);
    } catch {
      return reply.status(403).send({ error: 'Access denied' });
    }
    if (!fs.existsSync(safePath)) {
      return reply.status(404).send({ error: 'File not found' });
    }
    const stream = fs.createReadStream(safePath);
    reply.header('Content-Type', 'application/vnd.tcpdump.pcap');
    reply.header('Content-Disposition', `attachment; filename="capture-${id}.pcap"`);
    return reply.send(stream);
  });

  // Delete a packet capture (admin only)
  app.delete('/api/packets/:id', { preHandler: requireRole('admin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const packet = db.prepare('SELECT * FROM packet_captures WHERE id = ?').get(id) as any;
    if (!packet) return reply.status(404).send({ error: 'Not found' });
    if (packet.file_path && fs.existsSync(packet.file_path)) {
      let safePath: string;
      try {
        safePath = validatePacketPath(packet.file_path);
      } catch {
        return reply.status(403).send({ error: 'Access denied' });
      }
      fs.unlinkSync(safePath);
    }
    db.prepare('DELETE FROM packet_captures WHERE id = ?').run(id);
    return reply.status(204).send();
  });

  app.post('/api/packets', async (req, reply) => {
    const { interfaceName, duration, sourceIp } = req.body as { interfaceName?: string; duration?: number; sourceIp?: string };
    if (!interfaceName || !duration) {
      return reply.status(400).send({ error: 'Bad Request', message: 'interfaceName and duration are required' });
    }
    const id = nanoid();
    const db = getDb();
    const now = new Date().toISOString();

    // Calculate expires_at based on retention days setting
    const settingsRow = db.prepare("SELECT value FROM settings WHERE key = 'packet_retention_days'").get() as any;
    const retentionDays = settingsRow ? parseInt(settingsRow.value, 10) : 7;
    const expiresAt = new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000).toISOString();

    // file_path will be set by the worker; use placeholder
    const filePath = `/var/lib/netviren/packets/${id}.pcap`;

    db.prepare(`
      INSERT INTO packet_captures (id, interface_name, duration_seconds, status, started_at, source_ip, file_path, expires_at)
      VALUES (?, ?, ?, 'capturing', ?, ?, ?, ?)
    `).run(id, interfaceName, duration, now, sourceIp || '0.0.0.0', filePath, expiresAt);
    const packet = db.prepare('SELECT * FROM packet_captures WHERE id = ?').get(id);
    broadcast('packet:started', packet);
    return reply.status(201).send(packet);
  });
}
