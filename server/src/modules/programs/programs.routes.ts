import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  programCreateSchema,
  programUpdateSchema,
  type AdminProgram,
  type Locale,
  type ProgramTranslationInput,
} from '@uchkoprik/shared';
import { audit } from '../../lib/audit.js';
import { assertEditable } from '../../middleware/auth.js';
import { notFound } from '../../lib/errors.js';
import { iso, param, parse } from '../../lib/http.js';
import { sanitizeRichText } from '../../lib/html.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import { addStatusRoutes } from '../../lib/status-routes.js';
import {
  adminTitle,
  applyTranslationPatch,
  toTranslationMap,
  translationStatus,
} from '../../lib/translations.js';

const include = { translations: true } satisfies Prisma.EducationProgramInclude;
type Row = Prisma.EducationProgramGetPayload<{ include: typeof include }>;

const toAdmin = (p: Row): AdminProgram => ({
  id: p.id,
  code: p.code,
  status: p.status,
  sortOrder: p.sortOrder,
  publishedAt: iso(p.publishedAt),
  updatedAt: p.updatedAt.toISOString(),
  title: adminTitle(p.translations, (t) => t.title),
  translationStatus: translationStatus(p.translations),
  translations: toTranslationMap(p.translations, (t) => ({
    title: t.title,
    summary: t.summary,
    description: t.description,
    duration: t.duration,
    qualification: t.qualification,
  })),
});

async function load(id: string): Promise<Row> {
  const row = await prisma.educationProgram.findUnique({ where: { id }, include });
  if (!row) throw notFound('Yo‘nalish topilmadi');
  return row;
}

async function applyTranslations(
  tx: Tx,
  programId: string,
  patch: Partial<Record<Locale, ProgramTranslationInput | null | undefined>> | undefined,
) {
  const existing = (await tx.educationProgramTranslation.findMany({ where: { programId }, select: { locale: true } })).map((t) => t.locale);
  await applyTranslationPatch({
    patch,
    existing,
    upsert: (locale, d) => {
      const v = {
        title: d.title,
        summary: d.summary,
        description: sanitizeRichText(d.description),
        duration: d.duration,
        qualification: d.qualification,
      };
      return tx.educationProgramTranslation.upsert({
        where: { programId_locale: { programId, locale } },
        create: { programId, locale, ...v },
        update: v,
      });
    },
    remove: (locale) => tx.educationProgramTranslation.delete({ where: { programId_locale: { programId, locale } } }),
  });
}

export function adminProgramsRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    const rows = await prisma.educationProgram.findMany({ include, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    res.json({ items: rows.map(toAdmin) });
  });

  router.post('/', async (req, res) => {
    const input = parse(programCreateSchema, req.body);
    const id = await prisma.$transaction(async (tx) => {
      const p = await tx.educationProgram.create({ data: { code: input.code || null, sortOrder: input.sortOrder } });
      await applyTranslations(tx, p.id, input.translations);
      return p.id;
    });
    const row = await load(id);
    await audit(req, { action: 'CREATE', entity: 'program', entityId: id, summary: `Yo‘nalish yaratildi: ${toAdmin(row).title}` });
    res.status(201).json(toAdmin(row));
  });

  router.get('/:id', async (req, res) => res.json(toAdmin(await load(param(req, 'id')))));

  router.patch('/:id', async (req, res) => {
    const id = param(req, 'id');
    const input = parse(programUpdateSchema, req.body);
    assertEditable(req, (await load(id)).status);
    await prisma.$transaction(async (tx) => {
      await tx.educationProgram.update({
        where: { id },
        data: {
          ...(input.code !== undefined ? { code: input.code || null } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });
      await applyTranslations(tx, id, input.translations);
    });
    const row = await load(id);
    await audit(req, { action: 'UPDATE', entity: 'program', entityId: id, summary: `Yo‘nalish tahrirlandi: ${toAdmin(row).title}` });
    res.json(toAdmin(row));
  });

  addStatusRoutes(router, {
    entity: 'program',
    label: 'Yo‘nalish',
    load,
    save: (id, data) => prisma.educationProgram.update({ where: { id }, data }),
    serialize: async (id) => toAdmin(await load(id)),
    title: (row) => toAdmin(row).title,
  });

  router.delete('/:id', async (req, res) => {
    const id = param(req, 'id');
    const row = await load(id);
    await prisma.educationProgram.delete({ where: { id } });
    await audit(req, { action: 'DELETE', entity: 'program', entityId: id, summary: `Yo‘nalish o‘chirildi: ${toAdmin(row).title}` });
    res.status(204).end();
  });

  return router;
}
