import { FastifyInstance } from 'fastify';
import { getDb } from '../../db/connection.js';
import { requireRole } from '../../middleware/auth.js';
import { nanoid } from 'nanoid';
import bcrypt from 'bcryptjs';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // All user management endpoints require admin role
  app.addHook('preHandler', requireRole('admin'));

  app.get('/api/users', async (_req, _rep) => {
    const users = getDb().prepare('SELECT id, username, email, role, avatar_url, is_active, created_at, updated_at FROM users ORDER BY created_at DESC').all();
    return { users: (users as any[]).map((u) => ({ ...u, avatarUrl: u.avatar_url, isActive: Boolean(u.is_active), createdAt: u.created_at, updatedAt: u.updated_at })) };
  });

  app.post('/api/users', async (req, reply) => {
    const { username, email, password, role } = req.body as {
      username?: string; email?: string; password?: string; role?: string;
    };
    if (!username || !password) {
      return reply.status(400).send({ error: 'Bad Request', message: 'username and password are required' });
    }
    if (role && !['admin', 'analyst', 'viewer'].includes(role)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'role must be admin, analyst, or viewer' });
    }
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return reply.status(409).send({ error: 'Conflict', message: 'Username already taken' });
    }
    if (email) {
      const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (emailExists) {
        return reply.status(409).send({ error: 'Conflict', message: 'Email already in use' });
      }
    }
    const id = nanoid();
    const passwordHash = await bcrypt.hash(password, 10);
    db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, username, email || null, passwordHash, role || 'viewer');
    const user = db.prepare('SELECT id, username, email, role, avatar_url, is_active, created_at FROM users WHERE id = ?').get(id) as any;
    return reply.status(201).send({ user: { ...user, avatarUrl: user.avatar_url, isActive: Boolean(user.is_active), createdAt: user.created_at } });
  });

  app.patch('/api/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { username, email, password, role, isActive } = req.body as {
      username?: string; email?: string; password?: string; role?: string; isActive?: boolean;
    };
    const db = getDb();
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
    if (!existing) return reply.status(404).send({ error: 'Not found' });

    if (role && !['admin', 'analyst', 'viewer'].includes(role)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'role must be admin, analyst, or viewer' });
    }
    if (username) {
      const dup = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, id);
      if (dup) return reply.status(409).send({ error: 'Conflict', message: 'Username already taken' });
    }
    if (email) {
      const dup = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, id);
      if (dup) return reply.status(409).send({ error: 'Conflict', message: 'Email already in use' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    if (username !== undefined) { updates.push('username = ?'); values.push(username); }
    if (email !== undefined) { updates.push('email = ?'); values.push(email); }
    if (role !== undefined) { updates.push('role = ?'); values.push(role); }
    if (isActive !== undefined) { updates.push('is_active = ?'); values.push(isActive ? 1 : 0); }
    if (password !== undefined) {
      updates.push('password_hash = ?');
      values.push(await bcrypt.hash(password, 10));
    }
    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }
    const user = db.prepare('SELECT id, username, email, role, avatar_url, is_active, created_at, updated_at FROM users WHERE id = ?').get(id) as any;
    return { user: { ...user, avatarUrl: user.avatar_url, isActive: Boolean(user.is_active), createdAt: user.created_at, updatedAt: user.updated_at } };
  });

  app.delete('/api/users/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) return reply.status(404).send({ error: 'Not found' });
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return reply.status(204).send();
  });
}
