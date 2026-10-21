import crypto from 'node:crypto';
import type { Request, Response } from 'express';
import type { Config } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';

export const sessionCookieName = (config: Config) => (config.cookieSecure ? '__Host-sid' : 'sid');

export const hashToken = (token: string) => crypto.createHash('sha256').update(token).digest('hex');
const randomToken = () => crypto.randomBytes(32).toString('base64url');

export async function createSession(userId: string, req: Request, config: Config) {
  const token = randomToken();
  const csrfToken = randomToken();
  await prisma.session.create({
    data: {
      id: hashToken(token),
      userId,
      csrfToken,
      ip: req.ip ?? null,
      userAgent: (req.get('user-agent') ?? '').slice(0, 300) || null,
      expiresAt: new Date(Date.now() + config.sessionTtlMs),
    },
  });
  return { token, csrfToken };
}

export function setSessionCookie(res: Response, token: string, config: Config) {
  res.cookie(sessionCookieName(config), token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: config.sessionTtlMs,
  });
}

export function clearSessionCookie(res: Response, config: Config) {
  res.clearCookie(sessionCookieName(config), {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',
    path: '/',
  });
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export async function purgeExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
