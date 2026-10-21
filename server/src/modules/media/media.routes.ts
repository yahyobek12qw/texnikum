import { Router } from 'express';
import multer from 'multer';
import type { Prisma } from '@prisma/client';
import {
  LOCALES,
  mediaListQuery,
  mediaUpdateSchema,
  type AdminMedia,
  type Paginated,
} from '@uchkoprik/shared';
import type { Config } from '../../config/env.js';
import { audit } from '../../lib/audit.js';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { makeMeta, pageArgs, param, parse } from '../../lib/http.js';
import { prisma } from '../../lib/prisma.js';
import { assertCan } from '../../middleware/auth.js';
import {
  findMediaUsage,
  ingestUpload,
  mediaFilePath,
  removeMediaFiles,
  toAdminMedia,
} from './media.service.js';

export function adminMediaRouter(config: Config) {
  const router = Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes, files: 1, fields: 5, parts: 8 },
  });

  router.get('/', async (req, res) => {
    assertCan(req, 'content.read');
    const q = parse(mediaListQuery, req.query);
    // Video fayllar Media kutubxonasida ko'rsatilmaydi: ular "Videogalereya"da boshqariladi
    const where: Prisma.MediaWhereInput = { kind: q.kind ?? { in: ['IMAGE', 'DOCUMENT'] } };
    if (q.q) {
      where.OR = [
        { originalName: { contains: q.q, mode: 'insensitive' } },
        { translations: { some: { alt: { contains: q.q, mode: 'insensitive' } } } },
      ];
    }
    const [total, rows] = await Promise.all([
      prisma.media.count({ where }),
      prisma.media.findMany({
        where,
        include: { translations: true },
        orderBy: { createdAt: 'desc' },
        ...pageArgs(q.page, q.pageSize),
      }),
    ]);
    const body: Paginated<AdminMedia> = { items: rows.map(toAdminMedia), meta: makeMeta(q.page, q.pageSize, total) };
    res.json(body);
  });

  router.post('/', (req, _res, next) => { assertCan(req, 'media.write'); next(); }, upload.single('file'), async (req, res) => {
    if (!req.file) throw badRequest('Fayl tanlanmagan', 'NO_FILE');
    const only = req.query.kind === 'IMAGE' || req.query.kind === 'DOCUMENT' ? req.query.kind : undefined;
    const { media } = await ingestUpload(config, req.file, req.auth!.userId, only);
    await audit(req, {
      action: 'UPLOAD',
      entity: 'media',
      entityId: media.id,
      summary: `Fayl yuklandi: ${media.originalName}`,
      meta: { size: media.size, mimeType: media.mimeType },
    });
    res.status(201).json(toAdminMedia(media));
  });

  router.get('/:id', async (req, res) => {
    assertCan(req, 'content.read');
    const media = await prisma.media.findUnique({ where: { id: param(req, 'id') }, include: { translations: true } });
    if (!media) throw notFound('Fayl topilmadi');
    res.json({ ...toAdminMedia(media), usage: await findMediaUsage(media) });
  });

  router.patch('/:id', async (req, res) => {
    assertCan(req, 'media.write');
    const id = param(req, 'id');
    const input = parse(mediaUpdateSchema, req.body);
    const exists = await prisma.media.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw notFound('Fayl topilmadi');
    await prisma.$transaction(async (tx) => {
      if (input.showInGallery !== undefined) {
        await tx.media.update({ where: { id }, data: { showInGallery: input.showInGallery } });
      }
      if (input.translations) {
        for (const l of LOCALES) {
          const t = input.translations[l];
          if (!t) continue;
          await tx.mediaTranslation.upsert({
            where: { mediaId_locale: { mediaId: id, locale: l } },
            create: { mediaId: id, locale: l, alt: t.alt, caption: t.caption },
            update: { alt: t.alt, caption: t.caption },
          });
        }
      }
    });
    const media = await prisma.media.findUniqueOrThrow({ where: { id }, include: { translations: true } });
    await audit(req, { action: 'UPDATE', entity: 'media', entityId: id, summary: `Fayl ma’lumotlari yangilandi: ${media.originalName}` });
    res.json(toAdminMedia(media));
  });

  /** Fayl kontenti (hujjatlar uchun ham): faqat administratorga. */
  router.get('/:id/file', async (req, res) => {
    assertCan(req, 'content.read');
    const media = await prisma.media.findUnique({ where: { id: param(req, 'id') } });
    if (!media) throw notFound('Fayl topilmadi');
    res.download(mediaFilePath(config, media), media.originalName);
  });

  router.delete('/:id', async (req, res) => {
    assertCan(req, 'media.delete');
    const id = param(req, 'id');
    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) throw notFound('Fayl topilmadi');

    const usage = await findMediaUsage(media);
    const blocking = usage.filter((u) => u.blocking);
    if (blocking.length > 0) {
      throw conflict('Fayl majburiy bog‘langan, avval bog‘lanishni olib tashlang', 'MEDIA_IN_USE_BLOCKING', usage);
    }
    if (usage.length > 0 && req.query.force !== 'true') {
      throw conflict('Fayl kontentda ishlatilmoqda. O‘chirishni tasdiqlang.', 'MEDIA_IN_USE', usage);
    }
    await prisma.media.delete({ where: { id } });
    await removeMediaFiles(config, media);
    await audit(req, {
      action: 'DELETE',
      entity: 'media',
      entityId: id,
      summary: `Fayl o‘chirildi: ${media.originalName}`,
      meta: { forced: usage.length > 0 },
    });
    res.status(204).end();
  });

  return router;
}
