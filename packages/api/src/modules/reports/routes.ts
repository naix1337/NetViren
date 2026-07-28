import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/connection.js';
import { authMiddleware } from '../../middleware/auth.js';
import { broadcast } from '../../websocket/handler.js';
import { nanoid } from 'nanoid';
import * as fs from 'fs';
import * as path from 'path';

export async function reportRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/reports', async (_req, _rep) => {
    const reports = getDb().prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
    return { reports };
  });

  app.get('/api/reports/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const report = getDb().prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;
    if (!report) return reply.status(404).send({ error: 'Not found' });
    return { report: { ...report, summary: report.summary_json ? JSON.parse(report.summary_json) : null } };
  });

  app.post('/api/reports/generate', async (req, reply) => {
    const { title, reportType, periodStart, periodEnd } = req.body as {
      title?: string; reportType?: string; periodStart?: string; periodEnd?: string;
    };
    if (!title || !reportType || !periodStart || !periodEnd) {
      return reply.status(400).send({ error: 'Bad Request', message: 'title, reportType, periodStart, and periodEnd are required' });
    }
    if (!['daily', 'manual'].includes(reportType)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'reportType must be daily or manual' });
    }
    const id = nanoid();
    const db = getDb();
    db.prepare(`
      INSERT INTO reports (id, title, report_type, period_start, period_end, status, created_by)
      VALUES (?, ?, ?, ?, ?, 'generating', ?)
    `).run(id, title, reportType, periodStart, periodEnd, req.user?.userId || null);

    // Broadcast report generation started
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    broadcast('report:generating', report);

    // Generate report asynchronously (simplified - in production use puppeteer)
    // For now, we mark it as completed with no file
    db.prepare(`
      UPDATE reports SET status = 'completed', summary_json = ?, file_path = ?, file_size = ?
      WHERE id = ?
    `).run(JSON.stringify({
      title,
      period: { start: periodStart, end: periodEnd },
      generatedAt: new Date().toISOString(),
      generatedBy: req.user?.username || 'system',
      summary: 'Report generated successfully.',
    }), null, null, id);

    const completedReport = db.prepare('SELECT * FROM reports WHERE id = ?').get(id);
    broadcast('report:completed', completedReport);

    return reply.status(201).send({ report: completedReport });
  });

  app.get('/api/reports/:id/download', async (req, reply) => {
    const { id } = req.params as { id: string };
    const report = getDb().prepare('SELECT * FROM reports WHERE id = ?').get(id) as any;
    if (!report) return reply.status(404).send({ error: 'Not found' });
    if (report.status !== 'completed') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Report not yet completed' });
    }
    if (!report.file_path || !fs.existsSync(report.file_path)) {
      return reply.status(404).send({ error: 'File not found', message: 'Report file is not available on disk' });
    }
    const stream = fs.createReadStream(report.file_path);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="report-${id}.pdf"`);
    return reply.send(stream);
  });
}
