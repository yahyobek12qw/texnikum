import fs from 'node:fs';
import path from 'node:path';
import type { Request, RequestHandler, Response } from 'express';
import {
  LOCALES,
  NEWS_TYPE_ROUTES,
  isLocale,
  isReservedSlug,
  isRouteEnabled,
  type Locale,
  type NewsType,
} from '@uchkoprik/shared';
import type { Config } from '../../config/env.js';
import { getModules, pageModuleEnabled, NEWS_TYPE_MODULE } from '../../lib/modules.js';
import { prisma } from '../../lib/prisma.js';
import { resolveTranslation } from '../../lib/translations.js';
import { findPublishedNewsBySlug, publicNewsWhere } from '../news/news.service.js';
import { findPublishedPageBySlug } from '../pages/pages.public.js';
import { getPublicSettings } from '../settings/settings.service.js';

const FIXED_TITLES: Record<string, Record<Locale, string>> = {
  news: { uz: 'Yangiliklar', ru: 'Новости', en: 'News' },
  announcements: { uz: 'E’lonlar', ru: 'Объявления', en: 'Announcements' },
  events: { uz: 'Tadbirlar', ru: 'Мероприятия', en: 'Events' },
  gallery: { uz: 'Fotogalereya', ru: 'Фотогалерея', en: 'Photo gallery' },
  'useful-links': { uz: 'Foydali havolalar', ru: 'Полезные ссылки', en: 'Useful links' },
  contacts: { uz: 'Aloqa', ru: 'Контакты', en: 'Contacts' },
  search: { uz: 'Qidiruv', ru: 'Поиск', en: 'Search' },
  alumni: { uz: 'Bitiruvchilar', ru: 'Выпускники', en: 'Alumni' },
  partners: { uz: 'Hamkor korxonalar', ru: 'Предприятия-партнёры', en: 'Partner companies' },
};

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ───────────── robots.txt va sitemap.xml ─────────────

export function robotsHandler(config: Config): RequestHandler {
  return (_req, res) => {
    res.type('text/plain').send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /api/',
        '',
        `Sitemap: ${config.publicUrl}/sitemap.xml`,
        '',
      ].join('\n'),
    );
  };
}

interface SitemapEntry {
  /** Tilga bog'liq bo'lmagan yo'l, masalan "/news/slug" yoki har til uchun alohida */
  urls: Partial<Record<Locale, string>>;
  lastmod?: Date | null;
}

export function sitemapHandler(config: Config): RequestHandler {
  return async (_req, res) => {
    const entries: SitemapEntry[] = [];
    const modules = await getModules();

    entries.push({ urls: Object.fromEntries(LOCALES.map((l) => [l, `/${l}`])) });
    for (const fixed of ['news', 'announcements', 'events', 'gallery', 'useful-links', 'contacts', 'alumni', 'partners']) {
      if (!isRouteEnabled(`/${fixed}`, modules)) continue;
      entries.push({ urls: Object.fromEntries(LOCALES.map((l) => [l, `/${l}/${fixed}`])) });
    }

    const pages = await prisma.page.findMany({
      where: { status: 'PUBLISHED' },
      select: { updatedAt: true, module: true, translations: { select: { locale: true, slug: true } } },
    });
    for (const p of pages.filter((x) => pageModuleEnabled(x.module, modules))) {
      entries.push({
        urls: Object.fromEntries(p.translations.map((t) => [t.locale, `/${t.locale}/${t.slug}`])),
        lastmod: p.updatedAt,
      });
    }

    const news = await prisma.news.findMany({
      where: publicNewsWhere(),
      select: { type: true, updatedAt: true, translations: { select: { locale: true, slug: true } } },
    });
    for (const n of news.filter((x) => modules[NEWS_TYPE_MODULE[x.type as NewsType]])) {
      entries.push({
        urls: Object.fromEntries(
          n.translations.map((t) => [t.locale, `/${t.locale}/${NEWS_TYPE_ROUTES[n.type as NewsType]}/${t.slug}`]),
        ),
        lastmod: n.updatedAt,
      });
    }

    const xml: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ];
    for (const e of entries) {
      const langs = Object.keys(e.urls) as Locale[];
      for (const l of langs) {
        xml.push('<url>');
        xml.push(`<loc>${esc(config.publicUrl + e.urls[l])}</loc>`);
        if (e.lastmod) xml.push(`<lastmod>${e.lastmod.toISOString()}</lastmod>`);
        for (const alt of langs) {
          xml.push(`<xhtml:link rel="alternate" hreflang="${alt}" href="${esc(config.publicUrl + e.urls[alt])}"/>`);
        }
        xml.push('</url>');
      }
    }
    xml.push('</urlset>');
    res.type('application/xml').send(xml.join('\n'));
  };
}

// ───────────── SPA qobig'i + meta teglar ─────────────

interface Meta {
  status: number;
  lang: Locale;
  title: string;
  description: string;
  canonical: string | null;
  alternates: { locale: Locale; href: string }[];
  noindex: boolean;
  image: string | null;
}

async function resolveMeta(req: Request, config: Config): Promise<Meta> {
  const segs = req.path.split('/').filter(Boolean);
  const base: Meta = {
    status: 200,
    lang: 'uz',
    title: '',
    description: '',
    canonical: null,
    alternates: [],
    noindex: false,
    image: null,
  };

  if (segs[0] === 'admin') return { ...base, noindex: true, title: 'Boshqaruv paneli' };
  const first = segs[0];
  if (!first || !isLocale(first)) return { ...base, status: segs.length === 0 ? 200 : 404, noindex: true };

  const locale = first;
  const settings = await getPublicSettings(locale);
  const siteName = settings.shortName || settings.officialName;
  const defaultDescription = settings.seo.defaultDescription;
  const withSite = (t: string) => (siteName && t ? `${t} | ${siteName}` : t || siteName);
  const abs = (p: string) => config.publicUrl + p;
  const ogImage = settings.seo.ogImage ? abs(settings.seo.ogImage.url) : null;

  const out: Meta = { ...base, lang: locale, image: ogImage, description: defaultDescription };
  const rest = segs.slice(1);

  // Bosh sahifa
  if (rest.length === 0) {
    out.title = settings.seo.defaultTitle || settings.officialName || siteName;
    out.canonical = abs(`/${locale}`);
    out.alternates = LOCALES.map((l) => ({ locale: l, href: abs(`/${l}`) }));
    return out;
  }

  const [seg, second] = rest;

  // Qat'iy marshrutlar
  if (seg && FIXED_TITLES[seg] && !second) {
    if (!isRouteEnabled(`/${seg}`, await getModules())) return { ...out, status: 404, noindex: true, title: withSite('404') };
    out.title = withSite(FIXED_TITLES[seg][locale]);
    out.canonical = abs(`/${locale}/${seg}`);
    out.alternates = LOCALES.map((l) => ({ locale: l, href: abs(`/${l}/${seg}`) }));
    out.noindex = seg === 'search';
    return out;
  }

  // Yangilik / e'lon / tadbir sahifasi
  const newsType = (Object.entries(NEWS_TYPE_ROUTES) as [NewsType, string][]).find(([, r]) => r === seg)?.[0];
  if (newsType && second && rest.length === 2) {
    const row = await findPublishedNewsBySlug(second, locale);
    if (!row || row.type !== newsType) return { ...out, status: 404, noindex: true, title: withSite('404') };
    const r = resolveTranslation(row.translations, locale);
    if (!r) return { ...out, status: 404, noindex: true };
    const routeSeg = NEWS_TYPE_ROUTES[row.type as NewsType];
    out.title = withSite(r.tr.seoTitle || r.tr.title);
    out.description = r.tr.seoDescription || r.tr.excerpt || defaultDescription;
    out.canonical = abs(`/${r.tr.locale}/${routeSeg}/${r.tr.slug}`);
    out.alternates = row.translations.map((t) => ({ locale: t.locale, href: abs(`/${t.locale}/${routeSeg}/${t.slug}`) }));
    out.noindex = r.isFallback || r.tr.locale !== locale;
    if (row.coverMedia?.kind === 'IMAGE') out.image = abs(`/uploads/images/${row.coverMedia.storedName}`);
    return out;
  }

  // CMS sahifasi
  if (rest.length === 1 && seg && !isReservedSlug(seg)) {
    const page = await findPublishedPageBySlug(seg, locale);
    if (!page || !pageModuleEnabled(page.module, await getModules())) return { ...out, status: 404, noindex: true, title: withSite('404') };
    const r = resolveTranslation(page.translations, locale);
    if (!r) return { ...out, status: 404, noindex: true };
    out.title = withSite(r.tr.seoTitle || r.tr.title);
    out.description = r.tr.seoDescription || defaultDescription;
    out.canonical = abs(`/${r.tr.locale}/${r.tr.slug}`);
    out.alternates = page.translations.map((t) => ({ locale: t.locale, href: abs(`/${t.locale}/${t.slug}`) }));
    out.noindex = r.isFallback || r.tr.locale !== locale;
    return out;
  }

  return { ...out, status: 404, noindex: true, title: withSite('404') };
}

function renderHead(meta: Meta): string {
  const tags: string[] = [];
  if (meta.title) tags.push(`<title>${esc(meta.title)}</title>`);
  if (meta.description) tags.push(`<meta name="description" content="${esc(meta.description)}">`);
  if (meta.noindex) tags.push('<meta name="robots" content="noindex, nofollow">');
  if (meta.canonical) tags.push(`<link rel="canonical" href="${esc(meta.canonical)}">`);
  for (const a of meta.alternates) tags.push(`<link rel="alternate" hreflang="${a.locale}" href="${esc(a.href)}">`);
  if (meta.alternates.length > 0) {
    const uz = meta.alternates.find((a) => a.locale === 'uz');
    if (uz) tags.push(`<link rel="alternate" hreflang="x-default" href="${esc(uz.href)}">`);
  }
  if (meta.title) tags.push(`<meta property="og:title" content="${esc(meta.title)}">`);
  if (meta.description) tags.push(`<meta property="og:description" content="${esc(meta.description)}">`);
  if (meta.canonical) tags.push(`<meta property="og:url" content="${esc(meta.canonical)}">`);
  tags.push('<meta property="og:type" content="website">');
  if (meta.image) tags.push(`<meta property="og:image" content="${esc(meta.image)}">`);
  return tags.join('\n    ');
}

function negotiateLocale(req: Request): Locale {
  const header = req.get('accept-language') ?? '';
  for (const part of header.split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return 'uz';
}

/** Productionda client/dist ni xizmat qiladi va ommaviy sahifalarga SEO metalarini joylaydi. */
export function spaHandler(config: Config): RequestHandler {
  const indexPath = path.join(config.clientDistDir, 'index.html');
  let template: string | null = null;
  const load = () => {
    template ??= fs.readFileSync(indexPath, 'utf8');
    return template;
  };

  return async (req: Request, res: Response) => {
    if (!fs.existsSync(indexPath)) {
      res.status(503).type('text/plain').send('Frontend build topilmadi. `npm run build` ni ishga tushiring.');
      return;
    }
    if (req.path === '/') {
      res.redirect(302, `/${negotiateLocale(req)}`);
      return;
    }
    const meta = await resolveMeta(req, config);
    const html = load()
      .replace('<html lang="uz">', `<html lang="${meta.lang}">`)
      .replace(/<title>[\s\S]*?<\/title>/, '')
      .replace('<!--seo-head-->', renderHead(meta));
    res.status(meta.status).type('html').setHeader('Cache-Control', 'no-cache').send(html);
  };
}
