import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/connection.js';
import { authMiddleware } from '../../middleware/auth.js';
import { getEnv } from '../../config/env.js';
import { nanoid } from 'nanoid';

export async function vtRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  app.get('/api/vt/lookup', async (req, reply) => {
    const { type, value } = req.query as { type?: string; value?: string };
    if (!type || !value) {
      return reply.status(400).send({ error: 'Bad Request', message: 'type and value query params are required' });
    }
    if (!['hash', 'url', 'domain', 'ip'].includes(type)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'type must be hash, url, domain, or ip' });
    }

    const db = getDb();
    const now = new Date().toISOString();

    // Check cache first
    const cached = db.prepare('SELECT * FROM vt_cache WHERE lookup_type = ? AND lookup_value = ? AND expires_at > ?').get(type, value, now) as any;
    if (cached) {
      return {
        cached: true,
        result: {
          id: cached.id,
          lookupType: cached.lookup_type,
          lookupValue: cached.lookup_value,
          maliciousCount: cached.malicious_count,
          suspiciousCount: cached.suspicious_count,
          harmlessCount: cached.harmless_count,
          undetectedCount: cached.undetected_count,
          totalVendors: cached.total_vendors,
          communityScore: cached.community_score,
          cachedAt: cached.cached_at,
          expiresAt: cached.expires_at,
          responseData: JSON.parse(cached.response_data),
        },
      };
    }

    // Check if VT API key is configured
    const env = getEnv();
    if (!env.VT_API_KEY) {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'VirusTotal API key not configured' });
    }

    // Perform VT API lookup
    try {
      const url = type === 'hash'
        ? `${env.VT_API_URL}/files/${value}`
        : type === 'url'
          ? `${env.VT_API_URL}/urls/${Buffer.from(value).toString('base64url')}`
          : type === 'domain'
            ? `${env.VT_API_URL}/domains/${value}`
            : `${env.VT_API_URL}/ip_addresses/${value}`;

      const response = await fetch(url, {
        headers: { 'x-apikey': env.VT_API_KEY },
      });

      if (!response.ok) {
        return reply.status(response.status).send({ error: 'VT API error', message: `VirusTotal API returned ${response.status}` });
      }

      const data = await response.json();
      const attributes = data.data?.attributes;
      const stats = attributes?.last_analysis_stats || {};

      const maliciousCount = stats.malicious || 0;
      const suspiciousCount = stats.suspicious || 0;
      const harmlessCount = stats.harmless || 0;
      const undetectedCount = stats.undetected || 0;
      const totalVendors = maliciousCount + suspiciousCount + harmlessCount + undetectedCount;

      // Cache the result (expires in 1 hour)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const cacheId = nanoid();
      db.prepare(`
        INSERT OR REPLACE INTO vt_cache (id, lookup_type, lookup_value, response_data,
          malicious_count, suspicious_count, harmless_count, undetected_count,
          total_vendors, cached_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(cacheId, type, value, JSON.stringify(data), maliciousCount, suspiciousCount, harmlessCount, undetectedCount, totalVendors, now, expiresAt);

      return {
        cached: false,
        result: {
          id: cacheId,
          lookupType: type,
          lookupValue: value,
          maliciousCount,
          suspiciousCount,
          harmlessCount,
          undetectedCount,
          totalVendors,
          cachedAt: now,
          expiresAt,
          responseData: data,
        },
      };
    } catch (err: any) {
      return reply.status(502).send({ error: 'VT API error', message: err.message });
    }
  });

  app.post('/api/vt/lookup', async (req, reply) => {
    const { hash } = req.body as { hash?: string };
    if (!hash) {
      return reply.status(400).send({ error: 'Bad Request', message: 'hash is required' });
    }
    if (!/^[a-f0-9]{64}$/i.test(hash)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid hash format' });
    }

    const db = getDb();
    const now = new Date().toISOString();
    const type = 'hash';
    const value = hash;

    // Check cache first
    const cached = db.prepare('SELECT * FROM vt_cache WHERE lookup_type = ? AND lookup_value = ? AND expires_at > ?').get(type, value, now) as any;
    if (cached) {
      return {
        sha256: cached.lookup_value,
        positive: cached.malicious_count,
        total: cached.total_vendors,
        scanDate: cached.cached_at,
        cached: true,
      };
    }

    // Check if VT API key is configured
    const env = getEnv();
    if (!env.VT_API_KEY) {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'VirusTotal API key not configured' });
    }

    // Perform VT API lookup
    try {
      const url = `${env.VT_API_URL}/files/${value}`;
      const response = await fetch(url, {
        headers: { 'x-apikey': env.VT_API_KEY },
      });

      if (!response.ok) {
        return reply.status(response.status).send({ error: 'VT API error', message: `VirusTotal API returned ${response.status}` });
      }

      const data = await response.json();
      const attributes = data.data?.attributes;
      const stats = attributes?.last_analysis_stats || {};
      const sha256 = attributes?.sha256 || value;

      const maliciousCount = stats.malicious || 0;
      const suspiciousCount = stats.suspicious || 0;
      const harmlessCount = stats.harmless || 0;
      const undetectedCount = stats.undetected || 0;
      const totalVendors = maliciousCount + suspiciousCount + harmlessCount + undetectedCount;

      // Cache the result (expires in 1 hour)
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const cacheId = nanoid();
      db.prepare(`
        INSERT OR REPLACE INTO vt_cache (id, lookup_type, lookup_value, response_data,
          malicious_count, suspicious_count, harmless_count, undetected_count,
          total_vendors, cached_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(cacheId, type, value, JSON.stringify(data), maliciousCount, suspiciousCount, harmlessCount, undetectedCount, totalVendors, now, expiresAt);

      return {
        sha256,
        positive: maliciousCount,
        total: totalVendors,
        scanDate: now,
        cached: false,
      };
    } catch (err: any) {
      return reply.status(502).send({ error: 'VT API error', message: err.message });
    }
  });
}
