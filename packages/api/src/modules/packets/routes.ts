import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/connection.js';
import { authMiddleware } from '../../middleware/auth.js';
import { nanoid } from 'nanoid';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';

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
    // Get related DNS queries and connections
    const dnsQueries = getDb().prepare('SELECT * FROM packet_dns_queries WHERE capture_id = ? ORDER BY first_seen').all(id);
    const connections = getDb().prepare('SELECT * FROM packet_connections WHERE capture_id = ? ORDER BY first_seen').all(id);
    return { packet, dnsQueries, connections };
  });

  app.get('/api/packets/:id/download', async (req, reply) => {
    const { id } = req.params as { id: string };
    const packet = getDb().prepare('SELECT * FROM packet_captures WHERE id = ?').get(id) as any;
    if (!packet) return reply.status(404).send({ error: 'Not found' });
    const filePath = packet.file_path;
    if (!filePath || !fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'File not found' });
    }
    const stream = fs.createReadStream(filePath);
    reply.header('Content-Type', 'application/vnd.tcpdump.pcap');
    reply.header('Content-Disposition', `attachment; filename="capture-${id}.pcap"`);
    return reply.send(stream);
  });

  // Delete a packet capture
  app.delete('/api/packets/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const packet = db.prepare('SELECT * FROM packet_captures WHERE id = ?').get(id) as any;
    if (!packet) return reply.status(404).send({ error: 'Not found' });
    // Delete the file if it exists
    if (packet.file_path && fs.existsSync(packet.file_path)) {
      fs.unlinkSync(packet.file_path);
    }
    // CASCADE will clean up related DNS and connection records
    db.prepare('DELETE FROM packet_captures WHERE id = ?').run(id);
    return reply.status(204).send();
  });
}
