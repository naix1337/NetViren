import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/connection.js';
import { authMiddleware } from '../../middleware/auth.js';
import { signToken } from '../../lib/jwt.js';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Public: login
  app.post('/api/auth/login', async (req, reply) => {
    const { username, password } = req.body as { username?: string; password?: string };
    if (!username || !password) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Username and password required' });
    }
    const user = getDb().prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username) as any;
    if (!user) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }
    if (!user.password_hash) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Account uses OAuth' });
    }
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid credentials' });
    }
    const token = signToken({ userId: user.id, role: user.role, username: user.username });
    return { token, user: { id: user.id, username: user.username, email: user.email, role: user.role, avatarUrl: user.avatar_url } };
  });

  // Protected: get current user
  app.get('/api/me', { preHandler: [authMiddleware] }, async (req, reply) => {
    const user = getDb().prepare('SELECT id, username, email, role, avatar_url, is_active, created_at FROM users WHERE id = ?').get(req.user!.userId) as any;
    if (!user) return reply.status(404).send({ error: 'Not found' });
    return { user: { ...user, avatarUrl: user.avatar_url, isActive: Boolean(user.is_active), createdAt: user.created_at } };
  });

  // Protected: update profile
  app.patch('/api/me', { preHandler: [authMiddleware] }, async (req, reply) => {
    const { email, avatarUrl } = req.body as { email?: string; avatarUrl?: string };
    const db = getDb();
    if (email) {
      const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, req.user!.userId);
      if (existing) return reply.status(409).send({ error: 'Conflict', message: 'Email already in use' });
    }
    db.prepare('UPDATE users SET email = COALESCE(?, email), avatar_url = COALESCE(?, avatar_url), updated_at = datetime(\'now\') WHERE id = ?')
      .run(email ?? null, avatarUrl ?? null, req.user!.userId);
    const user = db.prepare('SELECT id, username, email, role, avatar_url, is_active, created_at FROM users WHERE id = ?').get(req.user!.userId) as any;
    return { user: { ...user, avatarUrl: user.avatar_url, isActive: Boolean(user.is_active), createdAt: user.created_at } };
  });

  // Public: set session cookie (for frontend to persist token in httpOnly cookie)
  app.post('/api/auth/set-session', async (req, reply) => {
    const { token } = req.body as { token?: string };
    if (!token) {
      return reply.status(400).send({ error: 'Bad Request', message: 'token is required' });
    }
    const isSecure = req.headers['x-forwarded-proto'] === 'https';
    reply.setCookie('netviren_token', token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });
    return { ok: true };
  });

  // Public: logout (clear session cookie)
  app.post('/api/auth/logout', async (_req, reply) => {
    reply.setCookie('netviren_token', '', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });
    return { ok: true };
  });
}
