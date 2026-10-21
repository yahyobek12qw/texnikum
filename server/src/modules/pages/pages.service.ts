import { Prisma, type PageTranslation } from '@prisma/client';
import {
  LOCALES,
  isReservedSlug,
  pageOptionsSchema,
  type AdminPage,
  type Locale,
  type PageOptions,
  type PageTemplate,
  type PageTranslationInput,
} from '@uchkoprik/shared';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { iso } from '../../lib/http.js';
import { sanitizeRichText } from '../../lib/html.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import {
  adminTitle,
  applyTranslationPatch,
  resolveTranslation,
  toTranslationMap,
  translationStatus,
} from '../../lib/translations.js';

export const pageInclude = {
  translations: true,
  parent: { include: { translations: true } },
} satisfies Prisma.PageInclude;
export type PageRow = Prisma.PageGetPayload<{ include: typeof pageInclude }>;

const trToInput = (t: PageTranslation): PageTranslationInput => ({
  title: t.title,
  slug: t.slug,
  content: t.content,
  seoTitle: t.seoTitle,
  seoDescription: t.seoDescription,
});

export function parseOptions(raw: Prisma.JsonValue | null): PageOptions | null {
  if (!raw) return null;
  const r = pageOptionsSchema.safeParse(raw);
  return r.success ? r.data : null;
}

/** Shablonga tegishli bo'lmagan opsiyalarni tashlab yuboradi. */
export function normalizeOptions(template: PageTemplate, options: PageOptions | null | undefined) {
  if (!options) return Prisma.DbNull;
  if (template === 'DOCUMENTS') {
    return options.documentTypes?.length ? { documentTypes: options.documentTypes } : Prisma.DbNull;
  }
  if (template === 'STAFF') {
    return options.staffKind ? { staffKind: options.staffKind } : Prisma.DbNull;
  }
  return Prisma.DbNull;
}

export function toAdminPage(p: PageRow): AdminPage {
  return {
    id: p.id,
    parentId: p.parentId,
    module: p.module,
    parentTitle: p.parent ? adminTitle(p.parent.translations, (t) => t.title) : null,
    template: p.template,
    options: parseOptions(p.options),
    status: p.status,
    sortOrder: p.sortOrder,
    publishedAt: iso(p.publishedAt),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    title: adminTitle(p.translations, (t) => t.title),
    translationStatus: translationStatus(p.translations),
    translations: toTranslationMap(p.translations, trToInput),
  };
}

export function assertSlugsAllowed(translations: Partial<Record<Locale, { slug: string } | null | undefined>>) {
  for (const l of LOCALES) {
    const slug = translations[l]?.slug;
    if (slug && isReservedSlug(slug)) {
      throw conflict(`"${slug}" slugi tizim uchun band qilingan`, 'SLUG_RESERVED');
    }
  }
}

export async function assertParentValid(parentId: string | null | undefined, selfId?: string) {
  if (!parentId) return;
  if (parentId === selfId) throw badRequest('Sahifa o‘zining ota sahifasi bo‘la olmaydi', 'INVALID_PARENT');
  let cursor: string | null = parentId;
  for (let depth = 0; cursor && depth < 20; depth++) {
    if (cursor === selfId) throw badRequest('Ota sahifa tanlovi sikl hosil qiladi', 'INVALID_PARENT');
    const row: { parentId: string | null } | null = await prisma.page.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    if (!row) throw badRequest('Ota sahifa topilmadi', 'INVALID_PARENT');
    cursor = row.parentId;
  }
}

export interface PageSnapshot {
  template: PageTemplate;
  options: PageOptions | null;
  parentId: string | null;
  sortOrder: number;
  translations: Partial<Record<Locale, PageTranslationInput>>;
}

export function buildSnapshot(p: PageRow): PageSnapshot {
  return {
    template: p.template,
    options: parseOptions(p.options),
    parentId: p.parentId,
    sortOrder: p.sortOrder,
    translations: toTranslationMap(p.translations, trToInput),
  };
}

export async function saveVersion(tx: Tx, pageId: string, userId: string | undefined, note?: string | null) {
  const page = await tx.page.findUniqueOrThrow({ where: { id: pageId }, include: pageInclude });
  const last = await tx.pageVersion.findFirst({
    where: { pageId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });
  const version = (last?.version ?? 0) + 1;
  await tx.pageVersion.create({
    data: {
      pageId,
      version,
      note: note ?? null,
      createdById: userId,
      snapshot: buildSnapshot(page) as unknown as Prisma.InputJsonValue,
    },
  });
  return version;
}

export function upsertPageTranslation(tx: Tx, pageId: string, locale: Locale, data: PageTranslationInput) {
  const values = {
    title: data.title,
    slug: data.slug,
    content: sanitizeRichText(data.content),
    seoTitle: data.seoTitle || null,
    seoDescription: data.seoDescription || null,
  };
  return tx.pageTranslation.upsert({
    where: { pageId_locale: { pageId, locale } },
    create: { pageId, locale, ...values },
    update: values,
  });
}

export async function applyPageTranslations(
  tx: Tx,
  pageId: string,
  patch: Partial<Record<Locale, PageTranslationInput | null | undefined>> | undefined,
) {
  const existing = (await tx.pageTranslation.findMany({ where: { pageId }, select: { locale: true } })).map(
    (t) => t.locale,
  );
  await applyTranslationPatch({
    patch,
    existing,
    upsert: (locale, data) => upsertPageTranslation(tx, pageId, locale, data),
    remove: (locale) => tx.pageTranslation.delete({ where: { pageId_locale: { pageId, locale } } }),
  });
}

export async function getPageOrThrow(id: string): Promise<PageRow> {
  const page = await prisma.page.findUnique({ where: { id }, include: pageInclude });
  if (!page) throw notFound('Sahifa topilmadi');
  return page;
}

/** Sahifaning so'ralgan tildagi sarlavhasi (fallback bilan). */
export function pageTitle(p: { translations: PageTranslation[] }, locale: Locale): string {
  return resolveTranslation(p.translations, locale)?.tr.title ?? '—';
}
