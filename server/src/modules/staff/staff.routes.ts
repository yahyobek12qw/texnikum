import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  STAFF_KINDS,
  staffCreateSchema,
  staffUpdateSchema,
  type AdminStaff,
  type Locale,
  type StaffTranslationInput,
} from '@uchkoprik/shared';
import { audit } from '../../lib/audit.js';
import { assertEditable } from '../../middleware/auth.js';
import { notFound } from '../../lib/errors.js';
import { param, parse } from '../../lib/http.js';
import { toAdminMediaRef } from '../../lib/media-urls.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import { addStatusRoutes } from '../../lib/status-routes.js';
import {
  adminTitle,
  applyTranslationPatch,
  toTranslationMap,
  translationStatus,
} from '../../lib/translations.js';
import { assertMediaOfKind } from '../media/media.service.js';

const include = { translations: true, photoMedia: true } satisfies Prisma.StaffInclude;
type Row = Prisma.StaffGetPayload<{ include: typeof include }>;

const toAdmin = (s: Row): AdminStaff => ({
  id: s.id,
  kind: s.kind,
  status: s.status,
  photo: toAdminMediaRef(s.photoMedia),
  email: s.email,
  phone: s.phone,
  sortOrder: s.sortOrder,
  updatedAt: s.updatedAt.toISOString(),
  title: adminTitle(s.translations, (t) => t.fullName),
  translationStatus: translationStatus(s.translations),
  translations: toTranslationMap(s.translations, (t) => ({ fullName: t.fullName, position: t.position, bio: t.bio })),
});

async function load(id: string): Promise<Row> {
  const row = await prisma.staff.findUnique({ where: { id }, include });
  if (!row) throw notFound('Xodim topilmadi');
  return row;
}

async function applyTranslations(
  tx: Tx,
  staffId: string,
  patch: Partial<Record<Locale, StaffTranslationInput | null | undefined>> | undefined,
) {
  const existing = (await tx.staffTranslation.findMany({ where: { staffId }, select: { locale: true } })).map((t) => t.locale);
  await applyTranslationPatch({
    patch,
    existing,
    upsert: (locale, d) =>
      tx.staffTranslation.upsert({
        where: { staffId_locale: { staffId, locale } },
        create: { staffId, locale, fullName: d.fullName, position: d.position, bio: d.bio },
        update: { fullName: d.fullName, position: d.position, bio: d.bio },
      }),
    remove: (locale) => tx.staffTranslation.delete({ where: { staffId_locale: { staffId, locale } } }),
  });
}

const listQuery = z.object({ kind: z.enum(STAFF_KINDS).optional() });

export function adminStaffRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = parse(listQuery, req.query);
    const rows = await prisma.staff.findMany({
      where: q.kind ? { kind: q.kind } : {},
      include,
      orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ items: rows.map(toAdmin) });
  });

  router.post('/', async (req, res) => {
    const input = parse(staffCreateSchema, req.body);
    await assertMediaOfKind(input.photoMediaId, 'IMAGE');
    const id = await prisma.$transaction(async (tx) => {
      const s = await tx.staff.create({
        data: {
          kind: input.kind,
          photoMediaId: input.photoMediaId ?? null,
          email: input.email || null,
          phone: input.phone || null,
          sortOrder: input.sortOrder,
        },
      });
      await applyTranslations(tx, s.id, input.translations);
      return s.id;
    });
    const row = await load(id);
    await audit(req, { action: 'CREATE', entity: 'staff', entityId: id, summary: `Xodim qo‘shildi: ${toAdmin(row).title}` });
    res.status(201).json(toAdmin(row));
  });

  router.get('/:id', async (req, res) => res.json(toAdmin(await load(param(req, 'id')))));

  router.patch('/:id', async (req, res) => {
    const id = param(req, 'id');
    const input = parse(staffUpdateSchema, req.body);
    assertEditable(req, (await load(id)).status);
    if (input.photoMediaId !== undefined) await assertMediaOfKind(input.photoMediaId, 'IMAGE');
    await prisma.$transaction(async (tx) => {
      await tx.staff.update({
        where: { id },
        data: {
          ...(input.kind !== undefined ? { kind: input.kind } : {}),
          ...(input.photoMediaId !== undefined ? { photoMediaId: input.photoMediaId } : {}),
          ...(input.email !== undefined ? { email: input.email || null } : {}),
          ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });
      await applyTranslations(tx, id, input.translations);
    });
    const row = await load(id);
    await audit(req, { action: 'UPDATE', entity: 'staff', entityId: id, summary: `Xodim ma’lumotlari tahrirlandi: ${toAdmin(row).title}` });
    res.json(toAdmin(row));
  });

  addStatusRoutes(router, {
    entity: 'staff',
    label: 'Xodim',
    load,
    save: (id, data) => prisma.staff.update({ where: { id }, data: { status: data.status } }),
    serialize: async (id) => toAdmin(await load(id)),
    title: (row) => toAdmin(row).title,
  });

  router.delete('/:id', async (req, res) => {
    const id = param(req, 'id');
    const row = await load(id);
    await prisma.staff.delete({ where: { id } });
    await audit(req, { action: 'DELETE', entity: 'staff', entityId: id, summary: `Xodim o‘chirildi: ${toAdmin(row).title}` });
    res.status(204).end();
  });

  return router;
}
