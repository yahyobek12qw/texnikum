import { Router, type Request, type RequestHandler } from 'express';
import { LOCALES, isLocale, statsQuery, trackSchema, type AdminStats } from '@uchkoprik/shared';
import { audit } from '../../lib/audit.js';
import { parse } from '../../lib/http.js';
import { getModules } from '../../lib/modules.js';
import { prisma } from '../../lib/prisma.js';
import { assertCan } from '../../middleware/auth.js';
import { adminTitle } from '../../lib/translations.js';

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python-requests|facebookexternalhit/i;
const FIXED = new Set(['news', 'announcements', 'events', 'gallery', 'useful-links', 'contacts', 'search', 'alumni', 'partners']);
const NEWS_ROUTES = new Set(['news', 'announcements', 'events']);

const utcDay = (d = new Date()) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/**
 * Ko'rishni qayd etadi. Faqat HAQIQIY (mavjud va nashr qilingan) sahifa yo'llari hisoblanadi, shuning uchun
 * tasodifiy yo'llar bilan jadvalni to'ldirib bo'lmaydi. Cookie, IP va foydalanuvchi ma'lumotlari saqlanmaydi.
 */
async function resolveTrackablePath(raw: string): Promise<string | null> {
  const clean = raw.split(/[?#]/)[0]!.replace(/\/+$/, '') || '/';
  const parts = clean.split('/').filter(Boolean);
  const [locale, a, b] = parts;
  if (!locale || !isLocale(locale) || parts.length > 3 || !parts.every((p) => /^[\w.-]{1,120}$/.test(p))) return null;
  if (parts.length === 1) return `/${locale}`;
  if (parts.length === 2 && a) {
    if (FIXED.has(a)) return `/${locale}/${a}`;
    const t = await prisma.pageTranslation.findUnique({ where: { locale_slug: { locale, slug: a } }, select: { page: { select: { status: true } } } });
    return t?.page.status === 'PUBLISHED' ? `/${locale}/${a}` : null;
  }
  if (parts.length === 3 && a && b && NEWS_ROUTES.has(a)) {
    const t = await prisma.newsTranslation.findUnique({ where: { locale_slug: { locale, slug: b } }, select: { news: { select: { status: true } } } });
    return t?.news.status === 'PUBLISHED' ? `/${locale}/${a}/${b}` : null;
  }
  return null;
}

export const trackHandler: RequestHandler = async (req, res) => {
  const { path } = parse(trackSchema, req.body);
  if (BOT.test(req.get('user-agent') ?? '') || req.get('dnt') === '1' || !(await getModules()).statistics) {
    res.status(204).end();
    return;
  }
  const resolved = await resolveTrackablePath(path);
  if (resolved) {
    await prisma.$executeRaw`INSERT INTO "page_views" ("day", "path", "count") VALUES (${utcDay()}::date, ${resolved}, 1)
      ON CONFLICT ("day", "path") DO UPDATE SET "count" = "page_views"."count" + 1`;
  }
  res.status(204).end();
};

async function buildStats(days: number): Promise<AdminStats> {
  const since = utcDay(new Date(Date.now() - (days - 1) * 86_400_000));
  const rows = await prisma.pageView.groupBy({ by: ['day'], where: { day: { gte: since } }, _sum: { count: true }, orderBy: { day: 'asc' } });
  const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r._sum.count ?? 0]));
  const daily: AdminStats['daily'] = [];
  for (let i = 0; i < days; i++) {
    const d = utcDay(new Date(since.getTime() + i * 86_400_000)).toISOString().slice(0, 10);
    daily.push({ day: d, count: byDay.get(d) ?? 0 });
  }
  const total = daily.reduce((s, d) => s + d.count, 0);
  const top = await prisma.pageView.groupBy({ by: ['path'], where: { day: { gte: since } }, _sum: { count: true }, orderBy: { _sum: { count: 'desc' } }, take: 15 });

  const [pages, news, announcements, events, documents, videos, photos, programs, staff, alumni, partners, media, users] = await Promise.all([
    prisma.page.count({ where: { status: 'PUBLISHED' } }),
    prisma.news.count({ where: { status: 'PUBLISHED', type: 'NEWS' } }),
    prisma.news.count({ where: { status: 'PUBLISHED', type: 'ANNOUNCEMENT' } }),
    prisma.news.count({ where: { status: 'PUBLISHED', type: 'EVENT' } }),
    prisma.document.count({ where: { status: 'PUBLISHED' } }),
    prisma.galleryVideo.count({ where: { status: 'PUBLISHED' } }),
    prisma.media.count({ where: { kind: 'IMAGE', showInGallery: true } }),
    prisma.educationProgram.count({ where: { status: 'PUBLISHED' } }),
    prisma.staff.count({ where: { status: 'PUBLISHED' } }),
    prisma.alumnus.count({ where: { status: 'PUBLISHED' } }),
    prisma.partner.count({ where: { status: 'PUBLISHED' } }),
    prisma.media.count(),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  return {
    days,
    totals: { views: total, activeDays: daily.filter((d) => d.count > 0).length, averagePerDay: Math.round((total / days) * 10) / 10 },
    daily,
    topPaths: top.map((t) => ({ path: t.path, count: t._sum.count ?? 0 })),
    content: { pages, news, announcements, events, documents, videos, photos, programs, staff, alumni, partners, media, users },
    note: 'Ko‘rishlar taxminiy: cookie va IP saqlanmaydi, takroriy tashrif ajratilmaydi; botlar va “Do Not Track” yoqilgan brauzerlar hisobga olinmaydi.',
  };
}

/** CSV: Excel uchun UTF-8 BOM; formulaga o'xshash katakchalar (=,+,-,@) apostrof bilan zararsizlantiriladi (CSV injection). */
function csv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    let s = v === null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

function sendCsv(req: Request, res: Parameters<RequestHandler>[1], name: string, rows: (string | number | null)[][]) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(csv(rows));
  void req;
}

export function adminStatsRouter() {
  const router = Router();

  router.get('/stats', async (req, res) => {
    assertCan(req, 'stats.view');
    res.json(await buildStats(parse(statsQuery, req.query).days));
  });

  router.get('/reports/views.csv', async (req, res) => {
    assertCan(req, 'reports.export');
    const { days } = parse(statsQuery, req.query);
    const since = utcDay(new Date(Date.now() - (days - 1) * 86_400_000));
    const rows = await prisma.pageView.findMany({ where: { day: { gte: since } }, orderBy: [{ day: 'asc' }, { path: 'asc' }] });
    await audit(req, { action: 'EXPORT', entity: 'report', summary: `Hisobot yuklab olindi: ko‘rishlar (${days} kun)` });
    sendCsv(req, res, 'korishlar', [['Sana', 'Sahifa', 'Ko‘rishlar'], ...rows.map((r) => [r.day.toISOString().slice(0, 10), r.path, r.count])]);
  });

  router.get('/reports/content.csv', async (req, res) => {
    assertCan(req, 'reports.export');
    const lang = (t: { locale: string }[]) => LOCALES.map((l) => (t.some((x) => x.locale === l) ? l.toUpperCase() : '')).filter(Boolean).join('+');
    const out: (string | number | null)[][] = [['Turi', 'Sarlavha (uz)', 'Holat', 'Tillar', 'Nashr sanasi', 'Yangilangan']];
    const d = (x: Date | null | undefined) => (x ? x.toISOString().slice(0, 10) : '');
    const [pages, news, docs, programs, staff, videos, alumni, partners] = await Promise.all([
      prisma.page.findMany({ include: { translations: true } }),
      prisma.news.findMany({ include: { translations: true } }),
      prisma.document.findMany({ include: { translations: true } }),
      prisma.educationProgram.findMany({ include: { translations: true } }),
      prisma.staff.findMany({ include: { translations: true } }),
      prisma.galleryVideo.findMany({ include: { translations: true } }),
      prisma.alumnus.findMany({ include: { translations: true } }),
      prisma.partner.findMany({ include: { translations: true } }),
    ]);
    for (const p of pages) out.push(['Sahifa', adminTitle(p.translations, (t) => t.title), p.status, lang(p.translations), d(p.publishedAt), d(p.updatedAt)]);
    for (const n of news) out.push([{ NEWS: 'Yangilik', ANNOUNCEMENT: 'E’lon', EVENT: 'Tadbir' }[n.type], adminTitle(n.translations, (t) => t.title), n.status, lang(n.translations), d(n.publishedAt), d(n.updatedAt)]);
    for (const x of docs) out.push(['Hujjat', adminTitle(x.translations, (t) => t.title), x.status, lang(x.translations), d(x.publishedAt), d(x.updatedAt)]);
    for (const x of programs) out.push(['Yo‘nalish', adminTitle(x.translations, (t) => t.title), x.status, lang(x.translations), d(x.publishedAt), d(x.updatedAt)]);
    for (const x of staff) out.push(['Xodim', adminTitle(x.translations, (t) => t.fullName), x.status, lang(x.translations), '', d(x.updatedAt)]);
    for (const x of videos) out.push(['Video', adminTitle(x.translations, (t) => t.title), x.status, lang(x.translations), d(x.publishedAt), d(x.updatedAt)]);
    for (const x of alumni) out.push(['Bitiruvchi', adminTitle(x.translations, (t) => t.fullName), x.status, lang(x.translations), '', d(x.updatedAt)]);
    for (const x of partners) out.push(['Hamkor', adminTitle(x.translations, (t) => t.name), x.status, lang(x.translations), '', d(x.updatedAt)]);
    await audit(req, { action: 'EXPORT', entity: 'report', summary: 'Hisobot yuklab olindi: kontent ro‘yxati' });
    sendCsv(req, res, 'kontent', out);
  });

  return router;
}
