import path from 'node:path';
import { Prisma, type DocumentTranslation } from '@prisma/client';
import type {
  AdminDocument,
  DocumentTranslationInput,
  Locale,
  PublicDocument,
} from '@uchkoprik/shared';
import { notFound } from '../../lib/errors.js';
import { iso } from '../../lib/http.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import {
  adminTitle,
  applyTranslationPatch,
  resolveTranslation,
  toTranslationMap,
  translationStatus,
} from '../../lib/translations.js';

export const documentInclude = {
  translations: true,
  category: { include: { translations: true } },
  fileMedia: true,
} satisfies Prisma.DocumentInclude;
export type DocumentRow = Prisma.DocumentGetPayload<{ include: typeof documentInclude }>;

const trToInput = (t: DocumentTranslation): DocumentTranslationInput => ({
  title: t.title,
  description: t.description,
});

export function toAdminDocument(d: DocumentRow): AdminDocument {
  return {
    id: d.id,
    type: d.type,
    status: d.status,
    categoryId: d.categoryId,
    categoryName: d.category ? adminTitle(d.category.translations, (t) => t.name) : null,
    number: d.number,
    docDate: iso(d.docDate),
    publishedAt: iso(d.publishedAt),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
    title: adminTitle(d.translations, (t) => t.title),
    file: {
      id: d.fileMedia.id,
      originalName: d.fileMedia.originalName,
      mimeType: d.fileMedia.mimeType,
      size: d.fileMedia.size,
    },
    translationStatus: translationStatus(d.translations),
    translations: toTranslationMap(d.translations, trToInput),
  };
}

export async function getDocumentOrThrow(id: string): Promise<DocumentRow> {
  const row = await prisma.document.findUnique({ where: { id }, include: documentInclude });
  if (!row) throw notFound('Hujjat topilmadi');
  return row;
}

export function upsertDocumentTranslation(tx: Tx, documentId: string, locale: Locale, data: DocumentTranslationInput) {
  return tx.documentTranslation.upsert({
    where: { documentId_locale: { documentId, locale } },
    create: { documentId, locale, title: data.title, description: data.description },
    update: { title: data.title, description: data.description },
  });
}

export async function applyDocumentTranslations(
  tx: Tx,
  documentId: string,
  patch: Partial<Record<Locale, DocumentTranslationInput | null | undefined>> | undefined,
) {
  const existing = (await tx.documentTranslation.findMany({ where: { documentId }, select: { locale: true } })).map(
    (t) => t.locale,
  );
  await applyTranslationPatch({
    patch,
    existing,
    upsert: (locale, data) => upsertDocumentTranslation(tx, documentId, locale, data),
    remove: (locale) => tx.documentTranslation.delete({ where: { documentId_locale: { documentId, locale } } }),
  });
}

export function toPublicDocument(d: DocumentRow, locale: Locale): PublicDocument | null {
  const resolved = resolveTranslation(d.translations, locale);
  if (!resolved) return null;
  const cat = d.category ? resolveTranslation(d.category.translations, locale) : null;
  return {
    id: d.id,
    requestedLocale: locale,
    locale: resolved.tr.locale,
    isFallback: resolved.isFallback,
    type: d.type,
    title: resolved.tr.title,
    description: resolved.tr.description,
    number: d.number,
    docDate: iso(d.docDate),
    category: cat ? { id: d.category!.id, name: cat.tr.name } : null,
    file: {
      name: d.fileMedia.originalName,
      mimeType: d.fileMedia.mimeType,
      size: d.fileMedia.size,
      extension: path.extname(d.fileMedia.storedName).slice(1),
    },
    downloadUrl: `/api/v1/public/documents/${d.id}/download`,
  };
}
