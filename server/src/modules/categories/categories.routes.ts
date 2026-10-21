import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  CATEGORY_SCOPES,
  categoryCreateSchema,
  categoryUpdateSchema,
  type AdminCategory,
  type CategoryTranslationInput,
  type Locale,
} from '@uchkoprik/shared';
import { z } from 'zod';
import { audit } from '../../lib/audit.js';
import { conflict, notFound } from '../../lib/errors.js';
import { param, parse } from '../../lib/http.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import {
  adminTitle,
  applyTranslationPatch,
  toTranslationMap,
  translationStatus,
} from '../../lib/translations.js';

const include = {
  translations: true,
  _count: { select: { news: true, documents: true } },
} satisfies Prisma.CategoryInclude;
type Row = Prisma.CategoryGetPayload<{ include: typeof include }>;

const toAdmin = (c: Row): AdminCategory => ({
  id: c.id,
  scope: c.scope,
  sortOrder: c.sortOrder,
  name: adminTitle(c.translations, (t) => t.name),
  usageCount: c._count.news + c._count.documents,
  translationStatus: translationStatus(c.translations),
  translations: toTranslationMap(c.translations, (t) => ({ name: t.name, slug: t.slug })),
});

async function load(id: string): Promise<Row> {
  const row = await prisma.category.findUnique({ where: { id }, include });
  if (!row) throw notFound('Kategoriya topilmadi');
  return row;
}

async function applyTranslations(
  tx: Tx,
  categoryId: string,
  patch: Partial<Record<Locale, CategoryTranslationInput | null | undefined>> | undefined,
) {
  const existing = (await tx.categoryTranslation.findMany({ where: { categoryId }, select: { locale: true } })).map((t) => t.locale);
  await applyTranslationPatch({
    patch,
    existing,
    upsert: (locale, d) =>
      tx.categoryTranslation.upsert({
        where: { categoryId_locale: { categoryId, locale } },
        create: { categoryId, locale, name: d.name, slug: d.slug },
        update: { name: d.name, slug: d.slug },
      }),
    remove: (locale) => tx.categoryTranslation.delete({ where: { categoryId_locale: { categoryId, locale } } }),
  });
}

const listQuery = z.object({ scope: z.enum(CATEGORY_SCOPES).optional() });

export function adminCategoriesRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = parse(listQuery, req.query);
    const rows = await prisma.category.findMany({
      where: q.scope ? { scope: q.scope } : {},
      include,
      orderBy: [{ scope: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ items: rows.map(toAdmin) });
  });

  router.post('/', async (req, res) => {
    const input = parse(categoryCreateSchema, req.body);
    const id = await prisma.$transaction(async (tx) => {
      const c = await tx.category.create({ data: { scope: input.scope, sortOrder: input.sortOrder } });
      await applyTranslations(tx, c.id, input.translations);
      return c.id;
    });
    const row = await load(id);
    await audit(req, { action: 'CREATE', entity: 'category', entityId: id, summary: `Kategoriya yaratildi: ${toAdmin(row).name}` });
    res.status(201).json(toAdmin(row));
  });

  router.get('/:id', async (req, res) => res.json(toAdmin(await load(param(req, 'id')))));

  router.patch('/:id', async (req, res) => {
    const id = param(req, 'id');
    const input = parse(categoryUpdateSchema, req.body);
    await load(id);
    await prisma.$transaction(async (tx) => {
      if (input.sortOrder !== undefined) await tx.category.update({ where: { id }, data: { sortOrder: input.sortOrder } });
      await applyTranslations(tx, id, input.translations);
    });
    const row = await load(id);
    await audit(req, { action: 'UPDATE', entity: 'category', entityId: id, summary: `Kategoriya tahrirlandi: ${toAdmin(row).name}` });
    res.json(toAdmin(row));
  });

  router.delete('/:id', async (req, res) => {
    const id = param(req, 'id');
    const row = await load(id);
    if (row._count.news + row._count.documents > 0) {
      throw conflict('Kategoriya materiallarda ishlatilmoqda. Avval ularni boshqa kategoriyaga o‘tkazing.', 'CATEGORY_IN_USE');
    }
    await prisma.category.delete({ where: { id } });
    await audit(req, { action: 'DELETE', entity: 'category', entityId: id, summary: `Kategoriya o‘chirildi: ${toAdmin(row).name}` });
    res.status(204).end();
  });

  return router;
}
