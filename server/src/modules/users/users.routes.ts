import { Router } from 'express';
import { userCreateSchema, userUpdateSchema, type AdminUserRow } from '@uchkoprik/shared';
import { audit } from '../../lib/audit.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { param, parse } from '../../lib/http.js';
import { hashPassword } from '../../lib/password.js';
import { prisma } from '../../lib/prisma.js';

type UserRow = { id: string; email: string; name: string; role: AdminUserRow['role']; isActive: boolean; createdAt: Date };

const toRow = (u: UserRow, lastLogin: Date | null | undefined): AdminUserRow => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt.toISOString(),
  lastLoginAt: lastLogin ? lastLogin.toISOString() : null,
});

async function lastLogins(ids: string[]): Promise<Map<string, Date>> {
  const rows = await prisma.auditLog.groupBy({
    by: ['userId'],
    where: { action: 'LOGIN', userId: { in: ids } },
    _max: { createdAt: true },
  });
  return new Map(rows.filter((r) => r.userId && r._max.createdAt).map((r) => [r.userId!, r._max.createdAt!]));
}

async function activeAdminCount(exceptId?: string) {
  return prisma.user.count({ where: { role: 'ADMIN', isActive: true, ...(exceptId ? { NOT: { id: exceptId } } : {}) } });
}

export function adminUsersRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    const users = await prisma.user.findMany({ orderBy: [{ createdAt: 'asc' }] });
    const logins = await lastLogins(users.map((u) => u.id));
    res.json({ items: users.map((u) => toRow(u, logins.get(u.id))) });
  });

  router.post('/', async (req, res) => {
    const input = parse(userCreateSchema, req.body);
    if (await prisma.user.findUnique({ where: { email: input.email } })) {
      throw conflict('Bu elektron pochta bilan foydalanuvchi mavjud', 'EMAIL_TAKEN');
    }
    const user = await prisma.user.create({
      data: { email: input.email, name: input.name, role: input.role, passwordHash: await hashPassword(input.password) },
    });
    await audit(req, { action: 'CREATE', entity: 'user', entityId: user.id, summary: `Foydalanuvchi yaratildi: ${user.email} (${user.role})`, meta: { role: user.role } });
    res.status(201).json(toRow(user, null));
  });

  router.patch('/:id', async (req, res) => {
    const id = param(req, 'id');
    const input = parse(userUpdateSchema, req.body);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw notFound('Foydalanuvchi topilmadi');
    const self = id === req.auth!.userId;

    if (self && ((input.role !== undefined && input.role !== user.role) || input.isActive === false)) {
      throw forbidden('O‘zingizning rolingizni o‘zgartirib yoki hisobingizni o‘chirib bo‘lmaydi', 'SELF_LOCKOUT');
    }
    const losingAdmin = user.role === 'ADMIN' && user.isActive && ((input.role !== undefined && input.role !== 'ADMIN') || input.isActive === false);
    if (losingAdmin && (await activeAdminCount(id)) === 0) {
      throw forbidden('Kamida bitta faol administrator qolishi shart', 'LAST_ADMIN');
    }

    const data = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.password !== undefined ? { passwordHash: await hashPassword(input.password) } : {}),
    };
    const updated = await prisma.user.update({ where: { id }, data });

    // Rol, faollik yoki parol o'zgarganda foydalanuvchining boshqa sessiyalari bekor qilinadi
    if (input.role !== undefined || input.isActive !== undefined || input.password !== undefined) {
      await prisma.session.deleteMany({ where: { userId: id, ...(self ? { NOT: { id: req.auth!.sessionId } } : {}) } });
    }
    const changes = [input.role !== undefined && 'rol', input.isActive !== undefined && 'faollik', input.password !== undefined && 'parol', input.name !== undefined && 'ism'].filter(Boolean).join(', ');
    await audit(req, { action: 'UPDATE', entity: 'user', entityId: id, summary: `Foydalanuvchi o‘zgartirildi: ${updated.email} (${changes})`, meta: { fields: changes } });
    const logins = await lastLogins([id]);
    res.json(toRow(updated, logins.get(id)));
  });

  return router;
}
