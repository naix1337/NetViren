import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';

export interface JwtPayload {
  userId: string;
  role: 'admin' | 'analyst' | 'viewer';
  username: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, getEnv().AUTH_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getEnv().AUTH_SECRET) as JwtPayload;
  } catch { return null; }
}
