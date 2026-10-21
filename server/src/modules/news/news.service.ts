import { Prisma, type NewsTranslation } from '@prisma/client';
import type {
  AdminNews,
  Locale,
  NewsTranslationInput,
  PublicNewsDetail,
  PublicNewsItem,
} from '@uchkoprik/shared';
import { badRequest, notFound } from '../../lib/errors.js';
import { iso } from '../../lib/http.js';
import { sanitizeRichText } from '../../lib/html.js';
import { toAdminMediaRef, toImageRef } from '../../lib/media-urls.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import {
  adminTitle,
  applyTranslationPatch,
  buildAlternates,
  resolveTranslation,
  toTranslationMap,
  translationStatus,
} from '../../lib/translations.js';

export const newsInclude = {
  translations: true,
  coverMedia: { include: { translations: true } },
  category: { include: { translations: true } },
} satisfies Prisma.NewsInclude;
export type NewsRow = Prisma.NewsGetPayload<{ include: typeof newsInclude }>;

/** Ro'yxatlar uchun: katta "content" maydoni yuklanmaydi. */
export const newsListInclude = {
  translations: { select: { locale: true, title: true, slug: true, excerpt: true } },
  coverMedia: { include: { translations: true } },
  category: { include: { translations: true } },
} satisfies Prisma.NewsInclude;
export type NewsListRow = Prisma.NewsGetPayload<{ include: typeof newsListInclude }>;

const trToInput = (t: NewsTranslation): NewsTranslationInput => ({
  title: t.title,
  slug: t.slug,
  excerpt: t.excerpt,
  content: t.content,
  seoTitle: t.seoTitle,
  seoDescription: t.seoDescription,
});

export function toAdminNews(n: NewsRow): AdminNews {
  return {
    id: n.id,
    type: n.type,
    status: n.status,
    categoryId: n.categoryId,
    categoryName: n.category ? adminTitle(n.category.translations, (t) => t.name) : null,
    cover: toAdminMediaRef(n.coverMedia),
    isImportant: n.isImportant,
    publishedAt: iso(n.publishedAt),
    scheduledAt: iso(n.scheduledAt),
    eventAt: iso(n.eventAt),
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    title: adminTitle(n.translations, (t) => t.title),
    translationStatus: translationStatus(n.translations),
    translations: toTranslationMap(n.translations, trToInput),
  };
}

export async function getNewsOrThrow(id: string): Promise<NewsRow> {
  const row = await prisma.news.findUnique({ where: { id }, include: newsInclude });
  if (!row) throw notFound('Yangilik topilmadi');
  return row;
}

export async function assertCategoryScope(categoryId: string | null | undefined, scope: 'NEWS' | 'DOCUMENT') {
  if (!categoryId) return;
  const c = await prisma.category.findUnique({ where: { id: categoryId }, select: { scope: true } });
  if (!c) throw badRequest('Kategoriya topilmadi', 'CATEGORY_NOT_FOUND');
  if (c.scope !== scope) throw badRequest('Kategoriya bu bo‘lim uchun mos emas', 'CATEGORY_SCOPE_MISMATCH');
}

export function upsertNewsTranslation(tx: Tx, newsId: string, locale: Locale, data: NewsTranslationInput) {
  const values = {
    title: data.title,
    slug: data.slug,
    excerpt: data.excerpt,
    content: sanitizeRichText(data.content),
    seoTitle: data.seoTitle || null,
    seoDescription: data.seoDescription || null,
  };
  return tx.newsTranslation.upsert({
    where: { newsId_locale: { newsId, locale } },
    create: { newsId, locale, ...values },
    update: values,
  });
}

export async function applyNewsTranslations(
  tx: Tx,
  newsId: string,
  patch: Partial<Record<Locale, NewsTranslationInput | null | undefined>> | undefined,
) {
  const existing = (await tx.newsTranslation.findMany({ where: { newsId }, select: { locale: true } })).map(
    (t) => t.locale,
  );
  await applyTranslationPatch({
    patch,
    existing,
    upsert: (locale, data) => upsertNewsTranslation(tx, newsId, locale, data),
    remove: (locale) => tx.newsTranslation.delete({ where: { newsId_locale: { newsId, locale } } }),
  });
}

// ───────────── Ommaviy ko'rinish ─────────────

export function toPublicNewsItem(n: NewsListRow, locale: Locale): PublicNewsItem | null {
  const resolved = resolveTranslation(n.translations, locale);
  if (!resolved) return null;
  const { tr, isFallback } = resolved;
  const cat = n.category ? resolveTranslation(n.category.translations, locale) : null;
  return {
    id: n.id,
    type: n.type,
    requestedLocale: locale,
    locale: tr.locale,
    isFallback,
    title: tr.title,
    slug: tr.slug,
    excerpt: tr.excerpt,
    cover: toImageRef(n.coverMedia, locale),
    category: cat ? { id: n.category!.id, name: cat.tr.name, slug: cat.tr.slug } : null,
    publishedAt: (n.publishedAt ?? n.createdAt).toISOString(),
    eventAt: iso(n.eventAt),
    isImportant: n.isImportant,
  };
}

export function toPublicNewsDetail(n: NewsRow, locale: Locale): PublicNewsDetail | null {
  const item = toPublicNewsItem(n, locale);
  const resolved = resolveTranslation(n.translations, locale);
  if (!item || !resolved) return null;
  return {
    ...item,
    content: resolved.tr.content,
    seoTitle: resolved.tr.seoTitle,
    seoDescription: resolved.tr.seoDescription,
    updatedAt: n.updatedAt.toISOString(),
    alternates: buildAlternates(n.translations),
  };
}

/** Ommaviy sayt ko'ra oladigan yangiliklar sharti. */
export function publicNewsWhere(): Prisma.NewsWhereInput {
  return { status: 'PUBLISHED', publishedAt: { lte: new Date() } };
}

export async function findPublishedNewsBySlug(slug: string, locale: Locale): Promise<NewsRow | null> {
  const where = publicNewsWhere();
  const exact = await prisma.newsTranslation.findUnique({
    where: { locale_slug: { locale, slug } },
    select: { newsId: true },
  });
  let row = exact
    ? await prisma.news.findFirst({ where: { ...where, id: exact.newsId }, include: newsInclude })
    : null;
  if (!row) {
    row = await prisma.news.findFirst({
      where: { ...where, translations: { some: { slug } } },
      include: newsInclude,
    });
  }
  return row;
}
