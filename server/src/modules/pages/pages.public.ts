import type { PageTranslation } from '@prisma/client';
import type {
  Breadcrumb,
  Locale,
  PageSection,
  PublicPage,
  PublicPageChild,
} from '@uchkoprik/shared';
import { notFound } from '../../lib/errors.js';
import { getModules, pageModuleEnabled } from '../../lib/modules.js';
import { iso } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { buildAlternates, resolveTranslation } from '../../lib/translations.js';
import { pageInclude, parseOptions, type PageRow } from './pages.service.js';

/**
 * Slug bo'yicha nashr qilingan sahifani topadi.
 * 1) so'ralgan tilda aynan shu slug; 2) bo'lmasa istalgan tildagi shu slug (til almashtirishda mos sahifaga o'tish uchun).
 */
export async function findPublishedPageBySlug(slug: string, locale: Locale): Promise<PageRow | null> {
  const exact = await prisma.pageTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    select: { page: { select: { id: true, status: true } } },
  });
  let id = exact && exact.page.status === 'PUBLISHED' ? exact.page.id : null;
  if (!id) {
    const any = await prisma.pageTranslation.findFirst({
      where: { slug, page: { status: 'PUBLISHED' } },
      select: { pageId: true },
    });
    id = any?.pageId ?? null;
  }
  if (!id) return null;
  return prisma.page.findUnique({ where: { id }, include: pageInclude });
}

export const pageHref = (locale: Locale, slug: string) => `/${locale}/${slug}`;

async function breadcrumbsFor(page: PageRow, locale: Locale): Promise<Breadcrumb[]> {
  const trail: Breadcrumb[] = [];
  let parentId = page.parentId;
  for (let depth = 0; parentId && depth < 8; depth++) {
    const parent = await prisma.page.findUnique({
      where: { id: parentId },
      include: { translations: true },
    });
    if (!parent) break;
    if (parent.status === 'PUBLISHED') {
      const r = resolveTranslation(parent.translations, locale);
      if (r) trail.unshift({ title: r.tr.title, href: pageHref(locale, r.tr.slug) });
    }
    parentId = parent.parentId;
  }
  return trail;
}

async function childrenOf(parentId: string, locale: Locale): Promise<PublicPageChild[]> {
  const modules = await getModules();
  const rows = (await prisma.page.findMany({
    where: { parentId, status: 'PUBLISHED' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { translations: true },
  })).filter((r) => pageModuleEnabled(r.module, modules));
  const out: PublicPageChild[] = [];
  for (const row of rows) {
    const r = resolveTranslation(row.translations as PageTranslation[], locale);
    if (r) out.push({ id: row.id, title: r.tr.title, slug: r.tr.slug, href: pageHref(locale, r.tr.slug) });
  }
  return out;
}

async function sectionFor(page: PageRow, locale: Locale, children: PublicPageChild[]): Promise<PageSection | null> {
  // Ichki sahifasi bor sahifa — o'zi bo'lim; ichki sahifa — ota-onasi bo'limi (qo'shni sahifalar bilan)
  if (children.length > 0) {
    const r = resolveTranslation(page.translations, locale);
    return r ? { title: r.tr.title, href: pageHref(locale, r.tr.slug), items: children } : null;
  }
  if (!page.parentId) return null;
  const parent = await prisma.page.findFirst({ where: { id: page.parentId, status: 'PUBLISHED' }, include: { translations: true } });
  const r = parent ? resolveTranslation(parent.translations, locale) : null;
  if (!parent || !r) return null;
  return { title: r.tr.title, href: pageHref(locale, r.tr.slug), items: await childrenOf(parent.id, locale) };
}

export async function buildPublicPage(
  page: PageRow,
  locale: Locale,
  opts: { preview?: boolean } = {},
): Promise<PublicPage> {
  const resolved = resolveTranslation(page.translations, locale);
  if (!resolved) throw notFound('Sahifa topilmadi');
  const { tr, isFallback } = resolved;
  const children = opts.preview ? [] : await childrenOf(page.id, locale);
  return {
    id: page.id,
    requestedLocale: locale,
    locale: tr.locale,
    isFallback,
    template: page.template,
    options: parseOptions(page.options),
    title: tr.title,
    slug: tr.slug,
    content: tr.content,
    seoTitle: tr.seoTitle,
    seoDescription: tr.seoDescription,
    publishedAt: iso(page.publishedAt),
    updatedAt: page.updatedAt.toISOString(),
    alternates: buildAlternates(page.translations),
    breadcrumbs: opts.preview ? [] : await breadcrumbsFor(page, locale),
    children,
    section: opts.preview ? null : await sectionFor(page, locale, children),
  };
}

export async function getPublicPage(slug: string, locale: Locale): Promise<PublicPage> {
  const page = await findPublishedPageBySlug(slug, locale);
  if (!page || !pageModuleEnabled(page.module, await getModules())) throw notFound('Sahifa topilmadi', 'PAGE_NOT_FOUND');
  return buildPublicPage(page, locale);
}
