import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyToken, JwtPayload } from '../lib/jwt.js';

declare module 'fastify' {
  interface FastifyRequest { user?: JwtPayload; }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  let token: string | null = null;

  // Check Authorization header first
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  }

  // Fallback to netviren_token cookie (set by frontend after login)
  if (!token) {
    const cookie = request.headers.cookie;
    if (cookie) {
      const match = cookie.match(/netviren_token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }
  }

  if (!token) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Missing token' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token' });
    return;
  }
  request.user = payload;
}

export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    await authMiddleware(request, reply);
    if (reply.sent) return;
    if (!request.user || !roles.includes(request.user.role)) {
      reply.status(403).send({ error: 'Forbidden', message: 'Insufficient permissions' });
    }
  };
}
