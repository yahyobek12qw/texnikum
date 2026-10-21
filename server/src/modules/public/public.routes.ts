import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import {
  CATEGORY_SCOPES,
  DOCUMENT_TYPES,
  NEWS_TYPE_ROUTES,
  STAFF_KINDS,
  localeSchema,
  paginationQuery,
  publicDocumentsQuery,
  publicNewsQuery,
  publicSearchQuery,
  type Locale,
  type Paginated,
  type PublicCategory,
  type PublicDocument,
  type PublicAlumnus,
  type PublicGalleryItem,
  type PublicPartner,
  type PublicVideo,
  type PublicNewsItem,
  type PublicProgram,
  type PublicStaffMember,
  type SearchResult,
} from '@uchkoprik/shared';
import type { Config } from '../../config/env.js';
import { notFound } from '../../lib/errors.js';
import { iso, makeMeta, pageArgs, param, parse, snippet, stripHtml } from '../../lib/http.js';
import { toImageRef } from '../../lib/media-urls.js';
import { NEWS_TYPE_MODULE, documentTypeAllowed, enabledDocumentTypes, enabledNewsTypes, getModules, requireModule, staffKindAllowed } from '../../lib/modules.js';
import { prisma } from '../../lib/prisma.js';
import { resolveTranslation } from '../../lib/translations.js';
import { documentInclude, toPublicDocument } from '../documents/documents.service.js';
import { mediaFilePath } from '../media/media.service.js';
import { getPublicNavigation } from '../navigation/navigation.service.js';
import {
  findPublishedNewsBySlug,
  newsListInclude,
  publicNewsWhere,
  toPublicNewsDetail,
  toPublicNewsItem,
} from '../news/news.service.js';
import { alumnusInclude, toPublicAlumnus } from '../alumni/alumni.routes.js';
import { partnerInclude, toPublicPartner } from '../partners/partners.routes.js';
import { getPublicPage } from '../pages/pages.public.js';
import { trackHandler } from '../stats/stats.js';
import { toPublicVideo, videoInclude } from '../videos/videos.routes.js';
import { getPublicSettings } from '../settings/settings.service.js';

const localeQuery = z.object({ locale: localeSchema.default('uz') });

export function publicRouter(config: Config) {
  const router = Router();

  router.get('/settings', async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    res.json(await getPublicSettings(locale));
  });

  router.get('/navigation', async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    res.json(await getPublicNavigation(locale));
  });

  router.get('/pages/:slug', async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    res.json(await getPublicPage(param(req, 'slug'), locale));
  });

  // ───────────── Yangiliklar ─────────────

  router.get('/news', async (req, res) => {
    const q = parse(publicNewsQuery, req.query);
    const modules = await getModules();
    const enabled = enabledNewsTypes(modules);
    if (q.type && !enabled.includes(q.type)) throw notFound('Bu bo‘lim hozircha o‘chirilgan', 'MODULE_DISABLED');
    const where: Prisma.NewsWhereInput = { ...publicNewsWhere(), type: q.type ?? { in: enabled } };
    if (q.important === 'true') where.isImportant = true;
    if (q.category) where.category = { translations: { some: { slug: q.category } } };
    if (q.q) {
      where.translations = {
        some: { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { excerpt: { contains: q.q, mode: 'insensitive' } }] },
      };
    }
    const [total, rows] = await Promise.all([
      prisma.news.count({ where }),
      prisma.news.findMany({
        where,
        include: newsListInclude,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        ...pageArgs(q.page, q.pageSize),
      }),
    ]);
    const items = rows.map((r) => toPublicNewsItem(r, q.locale)).filter((i): i is PublicNewsItem => i !== null);
    const body: Paginated<PublicNewsItem> = { items, meta: makeMeta(q.page, q.pageSize, total) };
    res.json(body);
  });

  router.get('/news/:slug', async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    const row = await findPublishedNewsBySlug(param(req, 'slug'), locale);
    const detail = row ? toPublicNewsDetail(row, locale) : null;
    if (!detail || !(await getModules())[NEWS_TYPE_MODULE[detail.type]]) throw notFound('Material topilmadi', 'NEWS_NOT_FOUND');
    res.json(detail);
  });

  // ───────────── Hujjatlar ─────────────

  router.get('/documents', async (req, res) => {
    const q = parse(publicDocumentsQuery, req.query);
    const allowed = enabledDocumentTypes(await getModules());
    const where: Prisma.DocumentWhereInput = { status: 'PUBLISHED', type: { in: allowed as (typeof DOCUMENT_TYPES)[number][] } };
    if (q.type) {
      const types = q.type.split(',').filter((t): t is (typeof DOCUMENT_TYPES)[number] => (DOCUMENT_TYPES as readonly string[]).includes(t) && allowed.includes(t));
      where.type = { in: types };
    }
    if (q.category) where.category = { translations: { some: { slug: q.category } } };
    if (q.q) {
      where.OR = [
        { number: { contains: q.q, mode: 'insensitive' } },
        {
          translations: {
            some: { OR: [{ title: { contains: q.q, mode: 'insensitive' } }, { description: { contains: q.q, mode: 'insensitive' } }] },
          },
        },
      ];
    }
    const [total, rows] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        include: documentInclude,
        orderBy: [{ docDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
        ...pageArgs(q.page, q.pageSize),
      }),
    ]);
    const items = rows.map((r) => toPublicDocument(r, q.locale)).filter((i): i is PublicDocument => i !== null);
    const body: Paginated<PublicDocument> = { items, meta: makeMeta(q.page, q.pageSize, total) };
    res.json(body);
  });

  /** Faqat nashr qilingan hujjat fayli yuklab olinadi; qoralama/arxiv uchun 404. */
  router.get('/documents/:id/download', async (req, res) => {
    const doc = await prisma.document.findFirst({
      where: { id: param(req, 'id'), status: 'PUBLISHED' },
      include: { fileMedia: true },
    });
    if (!doc || !documentTypeAllowed(doc.type, await getModules())) throw notFound('Hujjat topilmadi', 'DOCUMENT_NOT_FOUND');
    const file = mediaFilePath(config, doc.fileMedia);
    if (req.query.inline === '1' && doc.fileMedia.mimeType === 'application/pdf') {
      res.type('application/pdf');
      res.setHeader('Content-Disposition', 'inline');
      return res.sendFile(file);
    }
    return res.download(file, doc.fileMedia.originalName);
  });

  // ───────────── Kategoriyalar, yo'nalishlar, xodimlar, galereya ─────────────

  router.get('/categories', async (req, res) => {
    const q = parse(localeQuery.extend({ scope: z.enum(CATEGORY_SCOPES).optional() }), req.query);
    const rows = await prisma.category.findMany({
      where: q.scope ? { scope: q.scope } : {},
      include: { translations: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const items: PublicCategory[] = [];
    for (const c of rows) {
      const r = resolveTranslation(c.translations, q.locale);
      if (r) items.push({ id: c.id, name: r.tr.name, slug: r.tr.slug, scope: c.scope });
    }
    res.json({ items });
  });

  router.get('/education-programs', requireModule('programs'), async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    const rows = await prisma.educationProgram.findMany({
      where: { status: 'PUBLISHED' },
      include: { translations: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const items: PublicProgram[] = [];
    for (const p of rows) {
      const r = resolveTranslation(p.translations, locale);
      if (!r) continue;
      items.push({
        id: p.id,
        requestedLocale: locale,
        locale: r.tr.locale,
        isFallback: r.isFallback,
        code: p.code,
        title: r.tr.title,
        summary: r.tr.summary,
        description: r.tr.description,
        duration: r.tr.duration,
        qualification: r.tr.qualification,
      });
    }
    res.json({ items });
  });

  router.get('/staff', async (req, res) => {
    const q = parse(localeQuery.extend({ kind: z.enum(STAFF_KINDS).optional() }), req.query);
    const modules = await getModules();
    if (q.kind && !staffKindAllowed(q.kind, modules)) throw notFound('Bu bo‘lim hozircha o‘chirilgan', 'MODULE_DISABLED');
    const kinds = STAFF_KINDS.filter((k) => staffKindAllowed(k, modules));
    const rows = await prisma.staff.findMany({
      where: { status: 'PUBLISHED', kind: q.kind ?? { in: kinds } },
      include: { translations: true, photoMedia: { include: { translations: true } } },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const items: PublicStaffMember[] = [];
    for (const s of rows) {
      const r = resolveTranslation(s.translations, q.locale);
      if (!r) continue;
      items.push({
        id: s.id,
        requestedLocale: q.locale,
        locale: r.tr.locale,
        isFallback: r.isFallback,
        kind: s.kind,
        fullName: r.tr.fullName,
        position: r.tr.position,
        bio: r.tr.bio,
        email: s.email,
        phone: s.phone,
        photo: toImageRef(s.photoMedia, q.locale),
      });
    }
    res.json({ items });
  });

  router.get('/videos', requireModule('videoGallery'), async (req, res) => {
    const q = parse(paginationQuery.extend({ locale: localeSchema.default('uz') }), req.query);
    const where: Prisma.GalleryVideoWhereInput = { status: 'PUBLISHED' };
    const [total, rows] = await Promise.all([
      prisma.galleryVideo.count({ where }),
      prisma.galleryVideo.findMany({ where, include: videoInclude, orderBy: [{ sortOrder: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }], ...pageArgs(q.page, q.pageSize) }),
    ]);
    const items = rows.map((r) => toPublicVideo(r, q.locale)).filter((i): i is PublicVideo => i !== null);
    const body: Paginated<PublicVideo> = { items, meta: makeMeta(q.page, q.pageSize, total) };
    res.json(body);
  });

  router.get('/alumni', requireModule('alumni'), async (req, res) => {
    const q = parse(paginationQuery.extend({ locale: localeSchema.default('uz') }), req.query);
    const where: Prisma.AlumnusWhereInput = { status: 'PUBLISHED' };
    const [total, rows] = await Promise.all([
      prisma.alumnus.count({ where }),
      prisma.alumnus.findMany({ where, include: alumnusInclude, orderBy: [{ sortOrder: 'asc' }, { graduationYear: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }], ...pageArgs(q.page, q.pageSize) }),
    ]);
    const items = rows.map((r) => toPublicAlumnus(r, q.locale)).filter((i): i is PublicAlumnus => i !== null);
    const body: Paginated<PublicAlumnus> = { items, meta: makeMeta(q.page, q.pageSize, total) };
    res.json(body);
  });

  router.get('/partners', requireModule('partners'), async (req, res) => {
    const { locale } = parse(localeQuery, req.query);
    const rows = await prisma.partner.findMany({ where: { status: 'PUBLISHED' }, include: partnerInclude, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    const items = rows.map((r) => toPublicPartner(r, locale)).filter((i): i is PublicPartner => i !== null);
    res.json({ items });
  });

  // Ko'rishlar hisoblagichi (cookie va IP saqlanmaydi)
  router.post('/track', trackHandler);

  router.get('/gallery', requireModule('photoGallery'), async (req, res) => {
    const q = parse(paginationQuery.extend({ locale: localeSchema.default('uz') }), req.query);
    const where: Prisma.MediaWhereInput = { kind: 'IMAGE', showInGallery: true };
    const [total, rows] = await Promise.all([
      prisma.media.count({ where }),
      prisma.media.findMany({ where, include: { translations: true }, orderBy: { createdAt: 'desc' }, ...pageArgs(q.page, q.pageSize) }),
    ]);
    const items: PublicGalleryItem[] = [];
    for (const m of rows) {
      const image = toImageRef(m, q.locale);
      if (!image) continue;
      items.push({
        id: m.id,
        image,
        caption: resolveTranslation(m.translations, q.locale)?.tr.caption ?? '',
        createdAt: m.createdAt.toISOString(),
      });
    }
    const body: Paginated<PublicGalleryItem> = { items, meta: makeMeta(q.page, q.pageSize, total) };
    res.json(body);
  });

  // ───────────── Qidiruv ─────────────

  router.get('/search', requireModule('search'), async (req, res) => {
    const q = parse(publicSearchQuery, req.query);
    const modules = await getModules();
    const pageModules = (Object.keys(modules) as (keyof typeof modules)[]).filter((k) => modules[k]);
    const newsTypes = enabledNewsTypes(modules);
    const docTypes = enabledDocumentTypes(modules) as (typeof DOCUMENT_TYPES)[number][];
    const like = { contains: q.q, mode: 'insensitive' as const };
    const locale: Locale = q.locale;
    const LIMIT = 80;

    const [pages, news, docs, programs] = await Promise.all([
      prisma.pageTranslation.findMany({
        where: { locale, page: { status: 'PUBLISHED', OR: [{ module: null }, { module: { in: pageModules } }] }, OR: [{ title: like }, { content: like }, { seoDescription: like }] },
        select: { pageId: true, title: true, slug: true, content: true, page: { select: { publishedAt: true, updatedAt: true } } },
        take: LIMIT,
      }),
      prisma.newsTranslation.findMany({
        where: { locale, news: { ...publicNewsWhere(), type: { in: newsTypes } }, OR: [{ title: like }, { excerpt: like }, { content: like }] },
        select: { newsId: true, title: true, slug: true, excerpt: true, content: true, news: { select: { type: true, publishedAt: true } } },
        take: LIMIT,
      }),
      prisma.documentTranslation.findMany({
        where: { locale, document: { status: 'PUBLISHED', type: { in: docTypes } }, OR: [{ title: like }, { description: like }] },
        select: { documentId: true, title: true, description: true, document: { select: { docDate: true, publishedAt: true } } },
        take: LIMIT,
      }),
      prisma.educationProgramTranslation.findMany({
        where: { locale, program: { status: 'PUBLISHED' }, OR: modules.programs ? [{ title: like }, { summary: like }, { description: like }] : [{ id: 'none' }] },
        select: { programId: true, title: true, summary: true, description: true, program: { select: { publishedAt: true } } },
        take: LIMIT,
      }),
    ]);

    const results: SearchResult[] = [
      ...pages.map((p): SearchResult => ({
        type: 'page',
        id: p.pageId,
        title: p.title,
        snippet: snippet(stripHtml(p.content), q.q),
        href: `/${locale}/${p.slug}`,
        date: iso(p.page.publishedAt ?? p.page.updatedAt),
        isFallback: false,
        locale,
      })),
      ...news.map((n): SearchResult => ({
        type: 'news',
        id: n.newsId,
        title: n.title,
        snippet: snippet(n.excerpt || stripHtml(n.content), q.q),
        href: `/${locale}/${NEWS_TYPE_ROUTES[n.news.type]}/${n.slug}`,
        date: iso(n.news.publishedAt),
        isFallback: false,
        locale,
      })),
      ...docs.map((d): SearchResult => ({
        type: 'document',
        id: d.documentId,
        title: d.title,
        snippet: snippet(d.description, q.q),
        href: `/${locale}/documents?q=${encodeURIComponent(d.title)}`,
        date: iso(d.document.docDate ?? d.document.publishedAt),
        isFallback: false,
        locale,
      })),
      ...programs.map((p): SearchResult => ({
        type: 'program',
        id: p.programId,
        title: p.title,
        snippet: snippet(p.summary || stripHtml(p.description), q.q),
        href: `/${locale}/programs#${p.programId}`,
        date: iso(p.program.publishedAt),
        isFallback: false,
        locale,
      })),
    ];

    const needle = q.q.toLowerCase();
    results.sort((a, b) => {
      const at = a.title.toLowerCase().includes(needle) ? 0 : 1;
      const bt = b.title.toLowerCase().includes(needle) ? 0 : 1;
      if (at !== bt) return at - bt;
      return (b.date ?? '').localeCompare(a.date ?? '');
    });

    const start = (q.page - 1) * q.pageSize;
    const body: Paginated<SearchResult> = {
      items: results.slice(start, start + q.pageSize),
      meta: makeMeta(q.page, q.pageSize, results.length),
    };
    res.json(body);
  });

  return router;
}

