import fs from 'node:fs';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import type { Prisma } from '@prisma/client';
import {
  parseVideoUrl,
  videoCreateSchema,
  videoUpdateSchema,
  videoWatchUrl,
  videoEmbedUrl,
  videoThumbUrl,
  type AdminVideo,
  type Locale,
  type PublicVideo,
  type VideoTranslationInput,
} from '@uchkoprik/shared';
import { audit } from '../../lib/audit.js';
import type { Config } from '../../config/env.js';
import { badRequest, conflict, notFound, payloadTooLarge } from '../../lib/errors.js';
import { param, parse } from '../../lib/http.js';
import { toAdminMediaRef, toImageRef, videoFileUrl } from '../../lib/media-urls.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import { addStatusRoutes } from '../../lib/status-routes.js';
import { adminTitle, applyTranslationPatch, resolveTranslation, toTranslationMap, translationStatus } from '../../lib/translations.js';
import { assertCan, assertEditable } from '../../middleware/auth.js';
import { assertMediaOfKind, deleteVideoMedia, ingestVideo, mediaDirs, toAdminMedia } from '../media/media.service.js';

export const videoInclude = {
  translations: true,
  thumbMedia: { include: { translations: true } },
  fileMedia: true,
} satisfies Prisma.GalleryVideoInclude;
export type VideoRow = Prisma.GalleryVideoGetPayload<{ include: typeof videoInclude }>;

const toAdmin = (v: VideoRow): AdminVideo => ({
  id: v.id,
  sourceUrl: v.sourceUrl,
  provider: v.provider,
  externalId: v.externalId,
  file: v.fileMedia
    ? { id: v.fileMedia.id, originalName: v.fileMedia.originalName, mimeType: v.fileMedia.mimeType, size: v.fileMedia.size, url: videoFileUrl(v.fileMedia.storedName) }
    : null,
  thumb: toAdminMediaRef(v.thumbMedia),
  status: v.status,
  sortOrder: v.sortOrder,
  updatedAt: v.updatedAt.toISOString(),
  title: adminTitle(v.translations, (t) => t.title),
  translationStatus: translationStatus(v.translations),
  translations: toTranslationMap(v.translations, (t) => ({ title: t.title, description: t.description })),
});

export function toPublicVideo(v: VideoRow, locale: Locale): PublicVideo | null {
  const r = resolveTranslation(v.translations, locale);
  if (!r) return null;
  const external = v.provider === 'UPLOAD' ? null : v.provider;
  if (v.provider === 'UPLOAD' && !v.fileMedia) return null;
  return {
    id: v.id,
    requestedLocale: locale,
    locale: r.tr.locale,
    isFallback: r.isFallback,
    title: r.tr.title,
    description: r.tr.description,
    provider: v.provider,
    embedUrl: external ? videoEmbedUrl(external, v.externalId) : null,
    watchUrl: external ? videoWatchUrl(external, v.externalId) : null,
    fileUrl: v.fileMedia ? videoFileUrl(v.fileMedia.storedName) : null,
    thumbnail: toImageRef(v.thumbMedia, locale),
    thumbnailUrl: external ? videoThumbUrl(external, v.externalId) : null,
  };
}

async function load(id: string): Promise<VideoRow> {
  const row = await prisma.galleryVideo.findUnique({ where: { id }, include: videoInclude });
  if (!row) throw notFound('Video topilmadi');
  return row;
}

async function applyTranslations(tx: Tx, videoId: string, patch: Partial<Record<Locale, VideoTranslationInput | null | undefined>> | undefined) {
  const existing = (await tx.galleryVideoTranslation.findMany({ where: { videoId }, select: { locale: true } })).map((t) => t.locale);
  await applyTranslationPatch({
    patch,
    existing,
    upsert: (locale, d) =>
      tx.galleryVideoTranslation.upsert({
        where: { videoId_locale: { videoId, locale } },
        create: { videoId, locale, title: d.title, description: d.description },
        update: { title: d.title, description: d.description },
      }),
    remove: (locale) => tx.galleryVideoTranslation.delete({ where: { videoId_locale: { videoId, locale } } }),
  });
}

function parsedOrThrow(url: string) {
  const p = parseVideoUrl(url);
  if (!p) throw badRequest('Faqat YouTube yoki Vimeo havolasi qabul qilinadi', 'INVALID_VIDEO_URL');
  return p;
}

async function assertFileFree(mediaId: string, exceptVideoId?: string) {
  await assertMediaOfKind(mediaId, 'VIDEO');
  const used = await prisma.galleryVideo.findFirst({ where: { fileMediaId: mediaId, ...(exceptVideoId ? { id: { not: exceptVideoId } } : {}) }, select: { id: true } });
  if (used) throw conflict('Bu video fayl boshqa videoga biriktirilgan', 'VIDEO_FILE_IN_USE');
}

export function adminVideosRouter(config: Config) {
  const router = Router();
  const tmpDir = mediaDirs(config).tmp;
  const upload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => {
        fs.mkdirSync(tmpDir, { recursive: true });
        cb(null, tmpDir);
      },
      filename: (_req, _file, cb) => cb(null, crypto.randomUUID() + '.part'),
    }),
    limits: { fileSize: config.maxVideoBytes, files: 1, fields: 5, parts: 8 },
  });

  /** Video faylni kompyuter yoki telefondan yuklash. Natija — video media; keyin videoga `fileMediaId` sifatida biriktiriladi. */
  router.post(
    '/upload',
    (req, _res, next) => {
      assertCan(req, 'media.write');
      const declared = Number(req.headers['content-length'] ?? 0);
      if (declared > config.maxVideoBytes + 1024 * 1024) {
        throw payloadTooLarge(`Video hajmi ${Math.round(config.maxVideoBytes / 1024 / 1024)} MB dan oshmasligi kerak`);
      }
      next();
    },
    upload.single('file'),
    async (req, res) => {
      if (!req.file) throw badRequest('Fayl tanlanmagan', 'NO_FILE');
      const { media } = await ingestVideo(config, { path: req.file.path, originalname: req.file.originalname, size: req.file.size }, req.auth!.userId);
      await audit(req, {
        action: 'UPLOAD',
        entity: 'media',
        entityId: media.id,
        summary: `Video fayl yuklandi: ${media.originalName}`,
        meta: { size: media.size, mimeType: media.mimeType },
      });
      res.status(201).json(toAdminMedia(media));
    },
  );

  router.get('/', async (_req, res) => {
    const rows = await prisma.galleryVideo.findMany({ include: videoInclude, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }] });
    res.json({ items: rows.map(toAdmin) });
  });

  router.post('/', async (req, res) => {
    const input = parse(videoCreateSchema, req.body);
    await assertMediaOfKind(input.thumbMediaId, 'IMAGE');
    let source: { provider: 'YOUTUBE' | 'VIMEO' | 'UPLOAD'; externalId: string; sourceUrl: string; fileMediaId: string | null };
    if (input.sourceUrl) {
      const p = parsedOrThrow(input.sourceUrl);
      source = { provider: p.provider, externalId: p.externalId, sourceUrl: videoWatchUrl(p.provider, p.externalId), fileMediaId: null };
    } else {
      await assertFileFree(input.fileMediaId!);
      source = { provider: 'UPLOAD', externalId: input.fileMediaId!, sourceUrl: '', fileMediaId: input.fileMediaId! };
    }
    const id = await prisma.$transaction(async (tx) => {
      const v = await tx.galleryVideo.create({
        data: { ...source, thumbMediaId: input.thumbMediaId ?? null, sortOrder: input.sortOrder },
      });
      await applyTranslations(tx, v.id, input.translations);
      return v.id;
    });
    const row = await load(id);
    await audit(req, { action: 'CREATE', entity: 'video', entityId: id, summary: `Video qo‘shildi: ${toAdmin(row).title}` });
    res.status(201).json(toAdmin(row));
  });

  router.get('/:id', async (req, res) => res.json(toAdmin(await load(param(req, 'id')))));

  router.patch('/:id', async (req, res) => {
    const id = param(req, 'id');
    const input = parse(videoUpdateSchema, req.body);
    const current = await load(id);
    assertEditable(req, current.status);
    if (input.thumbMediaId !== undefined) await assertMediaOfKind(input.thumbMediaId, 'IMAGE');
    let source: { provider: 'YOUTUBE' | 'VIMEO' | 'UPLOAD'; externalId: string; sourceUrl: string; fileMediaId: string | null } | null = null;
    if (input.sourceUrl) {
      const p = parsedOrThrow(input.sourceUrl);
      source = { provider: p.provider, externalId: p.externalId, sourceUrl: videoWatchUrl(p.provider, p.externalId), fileMediaId: null };
    } else if (input.fileMediaId && input.fileMediaId !== current.fileMediaId) {
      await assertFileFree(input.fileMediaId, id);
      source = { provider: 'UPLOAD', externalId: input.fileMediaId, sourceUrl: '', fileMediaId: input.fileMediaId };
    }
    await prisma.$transaction(async (tx) => {
      await tx.galleryVideo.update({
        where: { id },
        data: {
          ...(source ?? {}),
          ...(input.thumbMediaId !== undefined ? { thumbMediaId: input.thumbMediaId } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });
      await applyTranslations(tx, id, input.translations);
    });
    if (source && current.fileMediaId && current.fileMediaId !== source.fileMediaId) await deleteVideoMedia(config, current.fileMediaId);
    const row = await load(id);
    await audit(req, { action: 'UPDATE', entity: 'video', entityId: id, summary: `Video tahrirlandi: ${toAdmin(row).title}` });
    res.json(toAdmin(row));
  });

  addStatusRoutes(router, {
    entity: 'video',
    label: 'Video',
    load,
    save: (id, data) => prisma.galleryVideo.update({ where: { id }, data }),
    serialize: async (id) => toAdmin(await load(id)),
    title: (row) => toAdmin(row).title,
  });

  router.delete('/:id', async (req, res) => {
    const id = param(req, 'id');
    const row = await load(id);
    await prisma.galleryVideo.delete({ where: { id } });
    await deleteVideoMedia(config, row.fileMediaId);
    await audit(req, { action: 'DELETE', entity: 'video', entityId: id, summary: `Video o‘chirildi: ${toAdmin(row).title}` });
    res.status(204).end();
  });

  return router;
}
