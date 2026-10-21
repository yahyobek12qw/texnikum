import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { auditListQuery, type AuditLogEntry, type Paginated } from '@uchkoprik/shared';
import { makeMeta, pageArgs, parse } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';

export const toAuditEntry = (a: {
  id: string;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  ip: string | null;
  createdAt: Date;
}): AuditLogEntry => ({
  id: a.id,
  userEmail: a.userEmail,
  action: a.action,
  entity: a.entity,
  entityId: a.entityId,
  summary: a.summary,
  ip: a.ip,
  createdAt: a.createdAt.toISOString(),
});

export function adminAuditRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = parse(auditListQuery, req.query);
    const where: Prisma.AuditLogWhereInput = {};
    if (q.entity) where.entity = q.entity;
    if (q.action) where.action = q.action;
    if (q.q) {
      where.OR = [
        { summary: { contains: q.q, mode: 'insensitive' } },
        { userEmail: { contains: q.q, mode: 'insensitive' } },
      ];
    }
    const [total, rows] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...pageArgs(q.page, q.pageSize) }),
    ]);
    const body: Paginated<AuditLogEntry> = { items: rows.map(toAuditEntry), meta: makeMeta(q.page, q.pageSize, total) };
    res.json(body);
  });

  return router;
}
