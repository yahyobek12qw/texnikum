import type { Request, RequestHandler } from 'express';
import { ROLE_PERMISSIONS, hasPermission, type Permission } from '@uchkoprik/shared';
import type { Config } from '../config/env.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import { prisma } from '../lib/prisma.js';
import { hashToken, safeEqual, sessionCookieName } from '../modules/auth/session.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Admin API himoyasi: sessiya (cookie) + CSRF token (X-CSRF-Token sarlavhasi).
 * Rol va ruxsatlar SERVERDA bazadan olinadi; frontenddagi yashirin tugmalarga tayanilmaydi.
 */
export function requireSession(config: Config): RequestHandler {
  const cookieName = sessionCookieName(config);
  return async (req, _res, next) => {
    const token = (req.cookies as Record<string, string> | undefined)?.[cookieName];
    if (!token) throw unauthorized();

    const session = await prisma.session.findUnique({
      where: { id: hashToken(token) },
      include: { user: true },
    });
    if (!session || !session.user.isActive) throw unauthorized();
    if (session.expiresAt.getTime() <= Date.now()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      throw unauthorized('Sessiya muddati tugagan. Qayta kiring.', 'SESSION_EXPIRED');
    }

    if (!SAFE_METHODS.has(req.method)) {
      const header = req.get('x-csrf-token');
      if (!header || !safeEqual(header, session.csrfToken)) {
        throw forbidden('CSRF tekshiruvi muvaffaqiyatsiz tugadi', 'CSRF_INVALID');
      }
    }

    if (Date.now() - session.lastSeenAt.getTime() > TOUCH_INTERVAL_MS) {
      await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    }

    req.auth = {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      permissions: ROLE_PERMISSIONS[session.user.role],
      sessionId: session.id,
      csrfToken: session.csrfToken,
    };
    next();
  };
}

export function can(req: Pick<Request, 'auth'>, permission: Permission): boolean {
  return Boolean(req.auth && hasPermission(req.auth.role, permission));
}

export function assertCan(req: Pick<Request, 'auth'>, permission: Permission): void {
  if (!can(req, permission)) {
    throw forbidden('Bu amal uchun ruxsatingiz yo‘q', 'PERMISSION_DENIED');
  }
}

/** Bitta ruxsatni talab qiladigan marshrutlar uchun. */
export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    assertCan(req, permission);
    next();
  };
}

const STATUS_ACTION = /\/(publish|unpublish|archive)$/;

/**
 * Kontent marshrutlari (sahifa, yangilik, hujjat, yo'nalish, xodim, video, bitiruvchi, hamkor, kategoriya) uchun
 * usul va amalga qarab ruxsat tanlanadi.
 */
export const contentGuard: RequestHandler = (req, _res, next) => {
  let needed: Permission;
  if (SAFE_METHODS.has(req.method)) needed = 'content.read';
  else if (req.method === 'DELETE') needed = 'content.delete';
  else if (STATUS_ACTION.test(req.path)) needed = 'content.publish';
  else needed = 'content.write';

  assertCan(req, needed);

  // Holat o'zgartirish yoki rejalashtirish ham nashr huquqini talab qiladi
  if (!SAFE_METHODS.has(req.method) && needed === 'content.write') {
    const body = (req.body ?? {}) as { status?: unknown; scheduledAt?: unknown };
    if ((body.status !== undefined && body.status !== 'DRAFT') || (typeof body.scheduledAt === 'string' && body.scheduledAt)) {
      assertCan(req, 'content.publish');
    }
  }
  next();
};

/** Nashr huquqi bo'lmagan foydalanuvchi allaqachon nashr qilingan materialni tahrirlay olmaydi (aks holda u bilvosita nashr qilgan bo'lardi). */
export function assertEditable(req: Pick<Request, 'auth'>, status: string): void {
  if (status === 'PUBLISHED' && !can(req, 'content.publish')) {
    throw forbidden('Nashr qilingan materialni tahrirlash uchun nashr huquqi kerak', 'PUBLISHED_EDIT_DENIED');
  }
}

/** Brauzerdan kelgan o'zgartiruvchi so'rovlarda Origin ruxsat etilgan manbalardan biri bo'lishi shart. */
export function originGuard(config: Config): RequestHandler {
  const allowed = new Set<string>([new URL(config.publicUrl).origin, ...config.corsOrigins]);
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get('origin');
    if (!origin) return next(); // brauzer bo'lmagan klient; baribir CSRF token talab qilinadi
    const host = req.get('host');
    const sameHost = host ? origin === `${req.protocol}://${host}` : false;
    if (sameHost || allowed.has(origin)) return next();
    throw forbidden('So‘rov manbasi ruxsat etilmagan', 'ORIGIN_NOT_ALLOWED');
  };
}
