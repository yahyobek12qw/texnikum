import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  documentCreateSchema,
  documentListQuery,
  documentUpdateSchema,
  type AdminDocument,
  type DocumentTranslationInput,
  type Locale,
  type Paginated,
} from '@uchkoprik/shared';
import { audit } from '../../lib/audit.js';
import { assertEditable } from '../../middleware/auth.js';
import { makeMeta, pageArgs, param, parse } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { assertMediaOfKind } from '../media/media.service.js';
import { assertCategoryScope } from '../news/news.service.js';
import {
  applyDocumentTranslations,
  documentInclude,
  getDocumentOrThrow,
  toAdminDocument,
  upsertDocumentTranslation,
} from './documents.service.js';

const date = (v: string | null | undefined) => (v ? new Date(v) : null);

export function adminDocumentsRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = parse(documentListQuery, req.query);
    const where: Prisma.DocumentWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.type) where.type = q.type;
    if (q.categoryId) where.categoryId = q.categoryId;
    if (q.q) {
      where.OR = [
        { number: { contains: q.q, mode: 'insensitive' } },
        { translations: { some: { title: { contains: q.q, mode: 'insensitive' } } } },
      ];
    }
    const [total, rows] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({ where, include: documentInclude, orderBy: { updatedAt: 'desc' }, ...pageArgs(q.page, q.pageSize) }),
    ]);
    const body: Paginated<AdminDocument> = { items: rows.map(toAdminDocument), meta: makeMeta(q.page, q.pageSize, total) };
    res.json(body);
  });

  router.post('/', async (req, res) => {
    const input = parse(documentCreateSchema, req.body);
    await assertMediaOfKind(input.fileMediaId, 'DOCUMENT');
    await assertCategoryScope(input.categoryId, 'DOCUMENT');
    const status = input.status ?? 'DRAFT';

    const id = await prisma.$transaction(async (tx) => {
      const doc = await tx.document.create({
        data: {
          type: input.type,
          status,
          categoryId: input.categoryId ?? null,
          fileMediaId: input.fileMediaId,
          docDate: date(input.docDate),
          number: input.number || null,
          publishedAt: status === 'PUBLISHED' ? new Date() : null,
          createdById: req.auth!.userId,
        },
      });
      const entries = Object.entries(input.translations) as [Locale, DocumentTranslationInput | null | undefined][];
      for (const [locale, data] of entries) if (data) await upsertDocumentTranslation(tx, doc.id, locale, data);
      return doc.id;
    });
    const row = await getDocumentOrThrow(id);
    await audit(req, { action: 'CREATE', entity: 'document', entityId: id, summary: `Hujjat yaratildi: ${row.translations[0]?.title ?? id}` });
    res.status(201).json(toAdminDocument(row));
  });

  router.get('/:id', async (req, res) => {
    res.json(toAdminDocument(await getDocumentOrThrow(param(req, 'id'))));
  });

  router.patch('/:id', async (req, res) => {
    const id = param(req, 'id');
    const input = parse(documentUpdateSchema, req.body);
    const current = await getDocumentOrThrow(id);
    assertEditable(req, current.status);
    if (input.fileMediaId !== undefined) await assertMediaOfKind(input.fileMediaId, 'DOCUMENT');
    if (input.categoryId !== undefined) await assertCategoryScope(input.categoryId, 'DOCUMENT');

    await prisma.$transaction(async (tx) => {
      await tx.document.update({
        where: { id },
        data: {
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
          ...(input.fileMediaId !== undefined ? { fileMediaId: input.fileMediaId } : {}),
          ...(input.docDate !== undefined ? { docDate: date(input.docDate) } : {}),
          ...(input.number !== undefined ? { number: input.number || null } : {}),
          ...(input.status !== undefined
            ? {
                status: input.status,
                ...(input.status === 'PUBLISHED' && !current.publishedAt ? { publishedAt: new Date() } : {}),
              }
            : {}),
        },
      });
      await applyDocumentTranslations(tx, id, input.translations);
    });
    const row = await getDocumentOrThrow(id);
    const statusChanged = input.status !== undefined && input.status !== current.status;
    await audit(req, {
      action: statusChanged ? (input.status === 'PUBLISHED' ? 'PUBLISH' : input.status === 'ARCHIVED' ? 'ARCHIVE' : 'UNPUBLISH') : 'UPDATE',
      entity: 'document',
      entityId: id,
      summary: `Hujjat ${statusChanged ? `holati o‘zgardi (${input.status})` : 'tahrirlandi'}: ${row.translations.find((t) => t.locale === 'uz')?.title ?? id}`,
    });
    res.json(toAdminDocument(row));
  });

  router.delete('/:id', async (req, res) => {
    const id = param(req, 'id');
    const row = await getDocumentOrThrow(id);
    // Biriktirilgan fayl media kutubxonasida qoladi; uni alohida o'chirish mumkin.
    await prisma.document.delete({ where: { id } });
    await audit(req, { action: 'DELETE', entity: 'document', entityId: id, summary: `Hujjat o‘chirildi: ${row.translations.find((t) => t.locale === 'uz')?.title ?? id}` });
    res.status(204).end();
  });

  return router;
}
