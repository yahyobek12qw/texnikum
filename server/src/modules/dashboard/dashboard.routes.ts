import { Router } from 'express';
import { z } from 'zod';
import {
  paginationQuery,
  type DashboardStats,
  type Paginated,
  type TranslationOverviewRow,
} from '@uchkoprik/shared';
import { makeMeta, pageArgs, parse } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { adminTitle, translationStatus } from '../../lib/translations.js';
import { toAuditEntry } from '../audit/audit.routes.js';

export function adminDashboardRouter() {
  const router = Router();

  /** Barcha ko'rsatkichlar bazadan hisoblanadi (doimiy sonlar yo'q). */
  router.get('/', async (_req, res) => {
    const [pagesByStatus, newsByStatus, docsByStatus, media, recentPages, recentNews, recentDocs, recentActions] =
      await Promise.all([
        prisma.page.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.news.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.document.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.media.count(),
        prisma.page.findMany({ orderBy: { updatedAt: 'desc' }, take: 5, include: { translations: true } }),
        prisma.news.findMany({ orderBy: { updatedAt: 'desc' }, take: 5, include: { translations: true } }),
        prisma.document.findMany({ orderBy: { updatedAt: 'desc' }, take: 5, include: { translations: true } }),
        prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10 }),
      ]);

    const count = (rows: { status: string; _count: { _all: number } }[], status: string) =>
      rows.find((r) => r.status === status)?._count._all ?? 0;
    const total = (rows: { _count: { _all: number } }[]) => rows.reduce((s, r) => s + r._count._all, 0);

    const recentContent = [
      ...recentPages.map((p) => ({ type: 'page', id: p.id, title: adminTitle(p.translations, (t) => t.title), status: p.status, updatedAt: p.updatedAt })),
      ...recentNews.map((n) => ({ type: 'news', id: n.id, title: adminTitle(n.translations, (t) => t.title), status: n.status, updatedAt: n.updatedAt })),
      ...recentDocs.map((d) => ({ type: 'document', id: d.id, title: adminTitle(d.translations, (t) => t.title), status: d.status, updatedAt: d.updatedAt })),
    ]
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, 8)
      .map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }));

    const body: DashboardStats = {
      pages: {
        total: total(pagesByStatus),
        published: count(pagesByStatus, 'PUBLISHED'),
        draft: count(pagesByStatus, 'DRAFT'),
        archived: count(pagesByStatus, 'ARCHIVED'),
      },
      news: { total: total(newsByStatus), published: count(newsByStatus, 'PUBLISHED'), draft: count(newsByStatus, 'DRAFT') },
      documents: { total: total(docsByStatus), published: count(docsByStatus, 'PUBLISHED') },
      media: { total: media },
      recentContent,
      recentActions: recentActions.map(toAuditEntry),
    };
    res.json(body);
  });

  return router;
}

const overviewQuery = paginationQuery.extend({
  entity: z.enum(['page', 'news', 'document', 'program', 'staff']).default('page'),
  missing: z.enum(['uz', 'ru', 'en']).optional(),
});

/** Uch tilli tarjimalar holati: qaysi material qaysi tilda mavjud. */
export function adminTranslationsRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = parse(overviewQuery, req.query);
    const args = pageArgs(q.page, q.pageSize);
    const missingWhere = q.missing ? { translations: { none: { locale: q.missing } } } : {};

    let rows: TranslationOverviewRow[] = [];
    let total = 0;
    if (q.entity === 'page') {
      const where = missingWhere;
      total = await prisma.page.count({ where });
      const items = await prisma.page.findMany({ where, include: { translations: true }, orderBy: { updatedAt: 'desc' }, ...args });
      rows = items.map((i) => ({ entity: 'page', id: i.id, title: adminTitle(i.translations, (t) => t.title), status: i.status, translations: translationStatus(i.translations) }));
    } else if (q.entity === 'news') {
      const where = missingWhere;
      total = await prisma.news.count({ where });
      const items = await prisma.news.findMany({ where, include: { translations: true }, orderBy: { updatedAt: 'desc' }, ...args });
      rows = items.map((i) => ({ entity: 'news', id: i.id, title: adminTitle(i.translations, (t) => t.title), status: i.status, translations: translationStatus(i.translations) }));
    } else if (q.entity === 'document') {
      const where = missingWhere;
      total = await prisma.document.count({ where });
      const items = await prisma.document.findMany({ where, include: { translations: true }, orderBy: { updatedAt: 'desc' }, ...args });
      rows = items.map((i) => ({ entity: 'document', id: i.id, title: adminTitle(i.translations, (t) => t.title), status: i.status, translations: translationStatus(i.translations) }));
    } else if (q.entity === 'program') {
      const where = missingWhere;
      total = await prisma.educationProgram.count({ where });
      const items = await prisma.educationProgram.findMany({ where, include: { translations: true }, orderBy: { updatedAt: 'desc' }, ...args });
      rows = items.map((i) => ({ entity: 'program', id: i.id, title: adminTitle(i.translations, (t) => t.title), status: i.status, translations: translationStatus(i.translations) }));
    } else {
      const where = missingWhere;
      total = await prisma.staff.count({ where });
      const items = await prisma.staff.findMany({ where, include: { translations: true }, orderBy: { updatedAt: 'desc' }, ...args });
      rows = items.map((i) => ({ entity: 'staff', id: i.id, title: adminTitle(i.translations, (t) => t.fullName), status: i.status, translations: translationStatus(i.translations) }));
    }

    const body: Paginated<TranslationOverviewRow> = { items: rows, meta: makeMeta(q.page, q.pageSize, total) };
    res.json(body);
  });

  return router;
}
