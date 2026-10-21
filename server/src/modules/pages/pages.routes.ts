import { Router, type Request } from 'express';
import { Prisma } from '@prisma/client';
import {
  pageCreateSchema,
  pageListQuery,
  pageUpdateSchema,
  restoreVersionSchema,
  localeSchema,
  type AdminPageVersion,
  type Paginated,
  type AdminPage,
  type Locale,
  type PageTranslationInput,
} from '@uchkoprik/shared';
import { audit } from '../../lib/audit.js';
import { assertEditable } from '../../middleware/auth.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { makeMeta, pageArgs, param, parse } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import {
  applyPageTranslations,
  assertParentValid,
  assertSlugsAllowed,
  getPageOrThrow,
  normalizeOptions,
  pageInclude,
  parseOptions,
  saveVersion,
  toAdminPage,
  upsertPageTranslation,
  type PageSnapshot,
} from './pages.service.js';
import { buildPublicPage } from './pages.public.js';

export function adminPagesRouter() {
  const router = Router();

  router.get('/', async (req, res) => {
    const q = parse(pageListQuery, req.query);
    const where: Prisma.PageWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.parentId === 'none') where.parentId = null;
    else if (q.parentId) where.parentId = q.parentId;
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
      prisma.page.count({ where }),
      prisma.page.findMany({
        where,
        include: pageInclude,
        orderBy: [{ updatedAt: 'desc' }],
        ...pageArgs(q.page, q.pageSize),
      }),
    ]);
    const body: Paginated<AdminPage> = { items: rows.map(toAdminPage), meta: makeMeta(q.page, q.pageSize, total) };
    res.json(body);
  });

  router.post('/', async (req, res) => {
    const input = parse(pageCreateSchema, req.body);
    assertSlugsAllowed(input.translations);
    await assertParentValid(input.parentId);

    const id = await prisma.$transaction(async (tx) => {
      const page = await tx.page.create({
        data: {
          parentId: input.parentId ?? null,
          template: input.template,
          options: normalizeOptions(input.template, input.options),
          sortOrder: input.sortOrder,
          createdById: req.auth!.userId,
        },
      });
      const entries = Object.entries(input.translations) as [Locale, PageTranslationInput | null | undefined][];
      for (const [locale, data] of entries) {
        if (data) await upsertPageTranslation(tx, page.id, locale, data);
      }
      await saveVersion(tx, page.id, req.auth!.userId, 'Yaratildi');
      return page.id;
    });

    const page = await getPageOrThrow(id);
    await audit(req, {
      action: 'CREATE',
      entity: 'page',
      entityId: id,
      summary: `Sahifa yaratildi: ${page.translations[0]?.title ?? id}`,
    });
    res.status(201).json(toAdminPage(page));
  });

  router.get('/:id', async (req, res) => {
    res.json(toAdminPage(await getPageOrThrow(param(req, 'id'))));
  });

  router.get('/:id/versions', async (req, res) => {
    const id = param(req, 'id');
    await getPageOrThrow(id);
    const versions = await prisma.pageVersion.findMany({
      where: { pageId: id },
      orderBy: { version: 'desc' },
      take: 50,
    });
    const users = await prisma.user.findMany({
      where: { id: { in: versions.map((v) => v.createdById).filter((v): v is string => Boolean(v)) } },
      select: { id: true, email: true },
    });
    const email = new Map(users.map((u) => [u.id, u.email]));
    const body: AdminPageVersion[] = versions.map((v) => ({
      id: v.id,
      version: v.version,
      note: v.note,
      createdAt: v.createdAt.toISOString(),
      createdBy: v.createdById ? (email.get(v.createdById) ?? null) : null,
    }));
    res.json({ items: body });
  });

  /** Qoralama yoki nashr qilingan sahifani admin uchun oldindan ko'rish (ommaviy javob formatida). */
  router.get('/:id/preview', async (req, res) => {
    const locale = parse(localeSchema, req.query.locale ?? 'uz');
    const page = await getPageOrThrow(param(req, 'id'));
    res.json(await buildPublicPage(page, locale, { preview: true }));
  });

  router.patch('/:id', async (req, res) => {
    const id = param(req, 'id');
    const input = parse(pageUpdateSchema, req.body);
    const current = await getPageOrThrow(id);
    assertEditable(req, current.status);
    assertSlugsAllowed(input.translations ?? {});
    if (input.parentId !== undefined) await assertParentValid(input.parentId, id);

    await prisma.$transaction(async (tx) => {
      const template = input.template ?? current.template;
      const optionsInput = input.options !== undefined ? input.options : undefined;
      await tx.page.update({
        where: { id },
        data: {
          ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
          ...(input.template !== undefined ? { template } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
          ...(optionsInput !== undefined || input.template !== undefined
            ? {
                options: normalizeOptions(
                  template,
                  optionsInput !== undefined ? optionsInput : parseOptions(current.options),
                ),
              }
            : {}),
        },
      });
      await applyPageTranslations(tx, id, input.translations);
      await saveVersion(tx, id, req.auth!.userId, input.note || 'Tahrirlandi');
    });

    const page = await getPageOrThrow(id);
    await audit(req, { action: 'UPDATE', entity: 'page', entityId: id, summary: `Sahifa tahrirlandi: ${page.translations.find((t) => t.locale === 'uz')?.title ?? id}` });
    res.json(toAdminPage(page));
  });

  async function setStatus(
    req: Request,
    status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED',
    action: string,
    label: string,
  ) {
    const id = param(req, 'id');
    const current = await getPageOrThrow(id);
    if (status === 'PUBLISHED' && !current.translations.some((t) => t.locale === 'uz')) {
      throw badRequest('Nashr qilish uchun o‘zbekcha versiya mavjud bo‘lishi kerak', 'MISSING_DEFAULT_TRANSLATION');
    }
    await prisma.page.update({
      where: { id },
      data: {
        status,
        ...(status === 'PUBLISHED' && !current.publishedAt ? { publishedAt: new Date() } : {}),
      },
    });
    const page = await getPageOrThrow(id);
    await audit(req, { action, entity: 'page', entityId: id, summary: `${label}: ${page.translations.find((t) => t.locale === 'uz')?.title ?? id}` });
    return toAdminPage(page);
  }

  router.post('/:id/publish', async (req, res) => res.json(await setStatus(req, 'PUBLISHED', 'PUBLISH', 'Sahifa nashr qilindi')));
  router.post('/:id/unpublish', async (req, res) => res.json(await setStatus(req, 'DRAFT', 'UNPUBLISH', 'Sahifa nashrdan qaytarildi')));
  router.post('/:id/archive', async (req, res) => res.json(await setStatus(req, 'ARCHIVED', 'ARCHIVE', 'Sahifa arxivlandi')));

  router.post('/:id/restore-version', async (req, res) => {
    const id = param(req, 'id');
    const { version } = parse(restoreVersionSchema, req.body);
    await getPageOrThrow(id);
    const row = await prisma.pageVersion.findUnique({ where: { pageId_version: { pageId: id, version } } });
    if (!row) throw notFound('Versiya topilmadi');
    const snap = row.snapshot as unknown as PageSnapshot;

    await prisma.$transaction(async (tx) => {
      const parentOk = snap.parentId ? await tx.page.findUnique({ where: { id: snap.parentId }, select: { id: true } }) : null;
      await tx.page.update({
        where: { id },
        data: {
          template: snap.template,
          options: normalizeOptions(snap.template, snap.options),
          sortOrder: snap.sortOrder,
          parentId: parentOk && snap.parentId !== id ? snap.parentId : null,
        },
      });
      // Snapshotda bo'lmagan tillar o'chiriladi, bor tillar tiklanadi
      const patch: Partial<Record<Locale, PageTranslationInput | null>> = {};
      for (const l of ['uz', 'ru', 'en'] as const) patch[l] = snap.translations[l] ?? null;
      if (!patch.uz) throw conflict('Versiyada o‘zbekcha matn yo‘q', 'INVALID_SNAPSHOT');
      await applyPageTranslations(tx, id, patch);
      await saveVersion(tx, id, req.auth!.userId, `Versiya ${version} tiklandi`);
    });

    const page = await getPageOrThrow(id);
    await audit(req, { action: 'RESTORE_VERSION', entity: 'page', entityId: id, summary: `Sahifa versiyasi tiklandi: v${version}`, meta: { version } });
    res.json(toAdminPage(page));
  });

  router.delete('/:id', async (req, res) => {
    const id = param(req, 'id');
    const page = await getPageOrThrow(id);
    const children = await prisma.page.count({ where: { parentId: id } });
    if (children > 0) {
      throw conflict('Avval ichki sahifalarni o‘chiring yoki boshqa bo‘limga o‘tkazing', 'HAS_CHILDREN');
    }
    await prisma.page.delete({ where: { id } });
    await audit(req, { action: 'DELETE', entity: 'page', entityId: id, summary: `Sahifa o‘chirildi: ${page.translations.find((t) => t.locale === 'uz')?.title ?? id}` });
    res.status(204).end();
  });

  return router;
}
