import { Router, type Request } from 'express';
import type { Prisma } from '@prisma/client';
import {
  localeSchema,
  newsCreateSchema,
  newsListQuery,
  newsUpdateSchema,
  type AdminNews,
  type Locale,
  type NewsTranslationInput,
  type Paginated,
} from '@uchkoprik/shared';
import { audit } from '../../lib/audit.js';
import { assertEditable } from '../../middleware/auth.js';
import { badRequest } from '../../lib/errors.js';
import { makeMeta, pageArgs, param, parse } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { assertMediaOfKind } from '../media/media.service.js';
import {
  applyNewsTranslations,
  assertCategoryScope,
  getNewsOrThrow,
  newsInclude,
  toAdminNews,
  toPublicNewsDetail,
  upsertNewsTranslation,
} from './news.service.js';

const date = (v: string | null | undefined) => (v ? new Date(v) : null);

function assertScheduleInFuture(scheduledAt: Date | null) {
  if (scheduledAt && scheduledAt.getTime() <= Date.now()) {
    throw badRequest('Rejalashtirilgan sana kelajakda bo‘lishi kerak', 'SCHEDULE_IN_PAST');
  }
}

export function adminNewsRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = parse(newsListQuery, req.query);
    const where: Prisma.NewsWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.q) {
      where.translations = {
        some: {
          OR: [
            { title: { contains: q.q, mode: 'insensitive' } },
            { slug: { contains: q.q, mode: 'insensitive' } },
          ],
        },
      };
    }
    const [total, rows] = await Promise.all([
      prisma.news.count({ where }),
      prisma.news.findMany({ where, include: newsInclude, orderBy: { updatedAt: 'desc' }, ...pageArgs(q.page, q.pageSize) }),
    ]);
    const body: Paginated<AdminNews> = { items: rows.map(toAdminNews), meta: makeMeta(q.page, q.pageSize, total) };
    res.json(body);
  });

  router.post('/', async (req, res) => {
    const input = parse(newsCreateSchema, req.body);
    await assertCategoryScope(input.categoryId, 'NEWS');
    await assertMediaOfKind(input.coverMediaId, 'IMAGE');
    const scheduledAt = date(input.scheduledAt);
    assertScheduleInFuture(scheduledAt);

    const id = await prisma.$transaction(async (tx) => {
      const news = await tx.news.create({
        data: {
          type: input.type,
          categoryId: input.categoryId ?? null,
          coverMediaId: input.coverMediaId ?? null,
          isImportant: input.isImportant,
          publishedAt: date(input.publishedAt),
          scheduledAt,
          eventAt: date(input.eventAt),
          createdById: req.auth!.userId,
        },
      });
      const entries = Object.entries(input.translations) as [Locale, NewsTranslationInput | null | undefined][];
      for (const [locale, data] of entries) if (data) await upsertNewsTranslation(tx, news.id, locale, data);
      return news.id;
    });
    const row = await getNewsOrThrow(id);
    await audit(req, { action: 'CREATE', entity: 'news', entityId: id, summary: `Material yaratildi (${row.type}): ${row.translations[0]?.title ?? id}` });
    res.status(201).json(toAdminNews(row));
  });

  router.get('/:id', async (req, res) => {
    res.json(toAdminNews(await getNewsOrThrow(param(req, 'id'))));
  });

  router.get('/:id/preview', async (req, res) => {
    const locale = parse(localeSchema, req.query.locale ?? 'uz');
    const row = await getNewsOrThrow(param(req, 'id'));
    const detail = toPublicNewsDetail(row, locale);
    if (!detail) throw badRequest('Bu tilda matn yo‘q', 'NO_TRANSLATION');
    res.json(detail);
  });

  router.patch('/:id', async (req, res) => {
    const id = param(req, 'id');
    const input = parse(newsUpdateSchema, req.body);
    const current = await getNewsOrThrow(id);
    assertEditable(req, current.status);
    if (input.categoryId !== undefined) await assertCategoryScope(input.categoryId, 'NEWS');
    if (input.coverMediaId !== undefined) await assertMediaOfKind(input.coverMediaId, 'IMAGE');
    const scheduledAt = input.scheduledAt !== undefined ? date(input.scheduledAt) : undefined;
    if (scheduledAt) {
      assertScheduleInFuture(scheduledAt);
      if (current.status === 'PUBLISHED') throw badRequest('Nashr qilingan materialni rejalashtirib bo‘lmaydi', 'ALREADY_PUBLISHED');
    }

    await prisma.$transaction(async (tx) => {
      await tx.news.update({
        where: { id },
        data: {
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.coverMediaId !== undefined ? { coverMediaId: input.coverMediaId } : {}),
          ...(input.isImportant !== undefined ? { isImportant: input.isImportant } : {}),
          ...(input.publishedAt !== undefined ? { publishedAt: date(input.publishedAt) } : {}),
          ...(scheduledAt !== undefined ? { scheduledAt } : {}),
          ...(input.eventAt !== undefined ? { eventAt: date(input.eventAt) } : {}),
        },
      });
      await applyNewsTranslations(tx, id, input.translations);
    });
    const row = await getNewsOrThrow(id);
    await audit(req, { action: 'UPDATE', entity: 'news', entityId: id, summary: `Material tahrirlandi: ${row.translations.find((t) => t.locale === 'uz')?.title ?? id}` });
    res.json(toAdminNews(row));
  });

  async function setStatus(req: Request, status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED', action: string, label: string) {
    const id = param(req, 'id');
    const current = await getNewsOrThrow(id);
    if (status === 'PUBLISHED' && !current.translations.some((t) => t.locale === 'uz')) {
      throw badRequest('Nashr qilish uchun o‘zbekcha versiya mavjud bo‘lishi kerak', 'MISSING_DEFAULT_TRANSLATION');
    }
    await prisma.news.update({
      where: { id },
      data: {
        status,
        ...(status === 'PUBLISHED' ? { publishedAt: current.publishedAt ?? new Date(), scheduledAt: null } : {}),
      },
    });
    const row = await getNewsOrThrow(id);
    await audit(req, { action, entity: 'news', entityId: id, summary: `${label}: ${row.translations.find((t) => t.locale === 'uz')?.title ?? id}` });
    return toAdminNews(row);
  }

  router.post('/:id/publish', async (req, res) => res.json(await setStatus(req, 'PUBLISHED', 'PUBLISH', 'Material nashr qilindi')));
  router.post('/:id/unpublish', async (req, res) => res.json(await setStatus(req, 'DRAFT', 'UNPUBLISH', 'Material nashrdan qaytarildi')));
  router.post('/:id/archive', async (req, res) => res.json(await setStatus(req, 'ARCHIVED', 'ARCHIVE', 'Material arxivlandi')));

  router.delete('/:id', async (req, res) => {
    const id = param(req, 'id');
    const row = await getNewsOrThrow(id);
    await prisma.news.delete({ where: { id } });
    await audit(req, { action: 'DELETE', entity: 'news', entityId: id, summary: `Material o‘chirildi: ${row.translations.find((t) => t.locale === 'uz')?.title ?? id}` });
    res.status(204).end();
  });

  return router;
}
