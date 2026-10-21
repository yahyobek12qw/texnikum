import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  alumnusCreateSchema,
  alumnusUpdateSchema,
  type AdminAlumnus,
  type AlumnusTranslationInput,
  type Locale,
  type PublicAlumnus,
} from '@uchkoprik/shared';
import { audit } from '../../lib/audit.js';
import { notFound } from '../../lib/errors.js';
import { param, parse } from '../../lib/http.js';
import { toAdminMediaRef, toImageRef } from '../../lib/media-urls.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import { addStatusRoutes } from '../../lib/status-routes.js';
import { adminTitle, applyTranslationPatch, resolveTranslation, toTranslationMap, translationStatus } from '../../lib/translations.js';
import { assertEditable } from '../../middleware/auth.js';
import { assertMediaOfKind } from '../media/media.service.js';

export const alumnusInclude = {
  translations: true,
  photoMedia: { include: { translations: true } },
} satisfies Prisma.AlumnusInclude;
export type AlumnusRow = Prisma.AlumnusGetPayload<{ include: typeof alumnusInclude }>;

const toAdmin = (a: AlumnusRow): AdminAlumnus => ({
  id: a.id,
  graduationYear: a.graduationYear,
  photo: toAdminMediaRef(a.photoMedia),
  status: a.status,
  sortOrder: a.sortOrder,
  updatedAt: a.updatedAt.toISOString(),
  title: adminTitle(a.translations, (t) => t.fullName),
  translationStatus: translationStatus(a.translations),
  translations: toTranslationMap(a.translations, (t) => ({ fullName: t.fullName, program: t.program, workplace: t.workplace, story: t.story })),
});

export function toPublicAlumnus(a: AlumnusRow, locale: Locale): PublicAlumnus | null {
  const r = resolveTranslation(a.translations, locale);
  if (!r) return null;
  return {
    id: a.id,
    requestedLocale: locale,
    locale: r.tr.locale,
    isFallback: r.isFallback,
    graduationYear: a.graduationYear,
    fullName: r.tr.fullName,
    program: r.tr.program,
    workplace: r.tr.workplace,
    story: r.tr.story,
    photo: toImageRef(a.photoMedia, locale),
  };
}

async function load(id: string): Promise<AlumnusRow> {
  const row = await prisma.alumnus.findUnique({ where: { id }, include: alumnusInclude });
  if (!row) throw notFound('Bitiruvchi topilmadi');
  return row;
}

async function applyTranslations(tx: Tx, alumnusId: string, patch: Partial<Record<Locale, AlumnusTranslationInput | null | undefined>> | undefined) {
  const existing = (await tx.alumnusTranslation.findMany({ where: { alumnusId }, select: { locale: true } })).map((t) => t.locale);
  await applyTranslationPatch({
    patch,
    existing,
    upsert: (locale, d) =>
      tx.alumnusTranslation.upsert({
        where: { alumnusId_locale: { alumnusId, locale } },
        create: { alumnusId, locale, fullName: d.fullName, program: d.program, workplace: d.workplace, story: d.story },
        update: { fullName: d.fullName, program: d.program, workplace: d.workplace, story: d.story },
      }),
    remove: (locale) => tx.alumnusTranslation.delete({ where: { alumnusId_locale: { alumnusId, locale } } }),
  });
}

export function adminAlumniRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    const rows = await prisma.alumnus.findMany({ include: alumnusInclude, orderBy: [{ sortOrder: 'asc' }, { graduationYear: 'desc' }, { createdAt: 'desc' }] });
    res.json({ items: rows.map(toAdmin) });
  });

  router.post('/', async (req, res) => {
    const input = parse(alumnusCreateSchema, req.body);
    await assertMediaOfKind(input.photoMediaId, 'IMAGE');
    const id = await prisma.$transaction(async (tx) => {
      const a = await tx.alumnus.create({ data: { graduationYear: input.graduationYear ?? null, photoMediaId: input.photoMediaId ?? null, sortOrder: input.sortOrder } });
      await applyTranslations(tx, a.id, input.translations);
      return a.id;
    });
    const row = await load(id);
    await audit(req, { action: 'CREATE', entity: 'alumnus', entityId: id, summary: `Bitiruvchi qo‘shildi: ${toAdmin(row).title}` });
    res.status(201).json(toAdmin(row));
  });

  router.get('/:id', async (req, res) => res.json(toAdmin(await load(param(req, 'id')))));

  router.patch('/:id', async (req, res) => {
    const id = param(req, 'id');
    const input = parse(alumnusUpdateSchema, req.body);
    const current = await load(id);
    assertEditable(req, current.status);
    if (input.photoMediaId !== undefined) await assertMediaOfKind(input.photoMediaId, 'IMAGE');
    await prisma.$transaction(async (tx) => {
      await tx.alumnus.update({
        where: { id },
        data: {
          ...(input.graduationYear !== undefined ? { graduationYear: input.graduationYear } : {}),
          ...(input.photoMediaId !== undefined ? { photoMediaId: input.photoMediaId } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });
      await applyTranslations(tx, id, input.translations);
    });
    const row = await load(id);
    await audit(req, { action: 'UPDATE', entity: 'alumnus', entityId: id, summary: `Bitiruvchi tahrirlandi: ${toAdmin(row).title}` });
    res.json(toAdmin(row));
  });

  addStatusRoutes(router, {
    entity: 'alumnus',
    label: 'Bitiruvchi',
    load,
    save: (id, data) => prisma.alumnus.update({ where: { id }, data: { status: data.status } }),
    serialize: async (id) => toAdmin(await load(id)),
    title: (row) => toAdmin(row).title,
  });

  router.delete('/:id', async (req, res) => {
    const id = param(req, 'id');
    const row = await load(id);
    await prisma.alumnus.delete({ where: { id } });
    await audit(req, { action: 'DELETE', entity: 'alumnus', entityId: id, summary: `Bitiruvchi o‘chirildi: ${toAdmin(row).title}` });
    res.status(204).end();
  });

  return router;
}
