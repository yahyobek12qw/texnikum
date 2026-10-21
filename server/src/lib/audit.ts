import type { Request } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from './prisma.js';
import { logger } from './logger.js';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  summary: string;
  meta?: Prisma.InputJsonValue;
}

/** Administrator harakatini audit jurnaliga yozadi. Parol va tokenlar `meta`ga kiritilmasligi kerak. */
export async function audit(
  req: Pick<Request, 'auth' | 'ip'>,
  entry: AuditEntry,
  db: Tx = prisma,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: req.auth?.userId ?? null,
        userEmail: req.auth?.email ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        summary: entry.summary.slice(0, 500),
        meta: entry.meta,
        ip: req.ip ?? null,
      },
    });
  } catch (err) {
    // Audit xatosi asosiy amalni buzmasligi kerak, lekin jimgina yo'qolmasin.
    logger.error({ err }, 'audit log yozilmadi');
  }
}

/** Tizim (scheduler kabi) tomonidan bajarilgan harakatlar uchun. */
export async function auditSystem(entry: AuditEntry, db: Tx = prisma): Promise<void> {
  await audit({ auth: undefined, ip: undefined }, entry, db);
}
