import { Router, type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { changePasswordSchema, loginSchema, type AdminSession } from '@uchkoprik/shared';
import type { Config } from '../../config/env.js';
import { unauthorized, badRequest } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { parse } from '../../lib/http.js';
import { hashPassword, verifyAgainstDummy, verifyPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';
import { ROLE_PERMISSIONS } from '@uchkoprik/shared';
import { getModules } from '../../lib/modules.js';
import { requireSession } from '../../middleware/auth.js';
import {
  clearSessionCookie,
  createSession,
  hashToken,
  sessionCookieName,
  setSessionCookie,
} from './session.js';

function tooManyAttempts(_req: Request, res: Response) {
  res.status(429).json({
    error: {
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Juda ko‘p urinish. Birozdan so‘ng qayta urinib ko‘ring.',
    },
  });
}

export function authRouter(config: Config) {
  const router = Router();
  const requireAuth = requireSession(config);

  // Faqat muvaffaqiyatsiz urinishlar hisoblanadi: IP bo'yicha va (taqsimlangan hujumga qarshi) email bo'yicha.
  const ipLimiter = rateLimit({
    windowMs: config.loginRateWindowMs,
    limit: config.loginRateMax,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: tooManyAttempts,
  });
  const emailLimiter = rateLimit({
    windowMs: config.loginRateWindowMs,
    limit: config.loginRateMax * 2,
    skipSuccessfulRequests: true,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const email = (req.body as { email?: unknown } | undefined)?.email;
      return `email:${typeof email === 'string' ? email.trim().toLowerCase().slice(0, 200) : 'none'}`;
    },
    validate: { keyGeneratorIpFallback: false },
    handler: tooManyAttempts,
  });

  router.post('/login', ipLimiter, emailLimiter, async (req, res) => {
    const { email, password } = parse(loginSchema, req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    let valid = false;
    if (user?.isActive) valid = await verifyPassword(user.passwordHash, password);
    else await verifyAgainstDummy(password);

    if (!user || !valid) {
      await audit(
        { auth: undefined, ip: req.ip },
        { action: 'LOGIN_FAILED', entity: 'auth', summary: 'Muvaffaqiyatsiz kirish urinishi' },
      );
      // Foydalanuvchi mavjudligini oshkor qilmaydi
      throw unauthorized('Elektron pochta yoki parol noto‘g‘ri', 'INVALID_CREDENTIALS');
    }

    // Eski sessiya cookie'si bo'lsa bekor qilinadi (session fixation'ga qarshi)
    const old = (req.cookies as Record<string, string> | undefined)?.[sessionCookieName(config)];
    if (old) await prisma.session.deleteMany({ where: { id: hashToken(old) } });

    const { token, csrfToken } = await createSession(user.id, req, config);
    setSessionCookie(res, token, config);
    await audit(
      { auth: { userId: user.id, email: user.email, name: user.name, role: user.role, permissions: [], sessionId: '', csrfToken: '' }, ip: req.ip },
      { action: 'LOGIN', entity: 'auth', entityId: user.id, summary: 'Tizimga kirdi' },
    );

    const body: AdminSession = {
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      csrfToken,
      permissions: [...ROLE_PERMISSIONS[user.role]],
      modules: await getModules(),
    };
    res.json(body);
  });

  router.post('/logout', requireAuth, async (req, res) => {
    await prisma.session.deleteMany({ where: { id: req.auth!.sessionId } });
    await audit(req, { action: 'LOGOUT', entity: 'auth', entityId: req.auth!.userId, summary: 'Tizimdan chiqdi' });
    clearSessionCookie(res, config);
    res.status(204).end();
  });

  router.get('/me', requireAuth, async (req, res) => {
    const a = req.auth!;
    const body: AdminSession = {
      user: { id: a.userId, email: a.email, name: a.name, role: a.role },
      csrfToken: a.csrfToken,
      permissions: [...a.permissions],
      modules: await getModules(),
    };
    res.json(body);
  });

  router.post('/change-password', requireAuth, async (req, res) => {
    const input = parse(changePasswordSchema, req.body);
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user || !(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw badRequest('Joriy parol noto‘g‘ri', 'WRONG_PASSWORD');
    }
    if (input.currentPassword === input.newPassword) {
      throw badRequest('Yangi parol joriy paroldan farq qilishi kerak', 'SAME_PASSWORD');
    }
    const passwordHash = await hashPassword(input.newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
      // Boshqa barcha sessiyalar bekor qilinadi
      prisma.session.deleteMany({ where: { userId: user.id, NOT: { id: req.auth!.sessionId } } }),
    ]);
    await audit(req, { action: 'CHANGE_PASSWORD', entity: 'user', entityId: user.id, summary: 'Parol o‘zgartirildi' });
    res.status(204).end();
  });

  return router;
}
