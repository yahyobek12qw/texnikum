import crypto from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';
import sharp from 'sharp';
import type { Media, MediaTranslation } from '@prisma/client';
import { LOCALES, type AdminMedia, type MediaUsage } from '@uchkoprik/shared';
import type { Config } from '../../config/env.js';
import { badRequest, payloadTooLarge, unsupportedMedia } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import { imageUrl, thumbUrl, videoFileUrl } from '../../lib/media-urls.js';

interface AllowedType {
  kind: 'IMAGE' | 'DOCUMENT';
  /** Foydalanuvchi yuborgan fayl kengaytmasi shulardan biri bo'lishi kerak */
  extensions: string[];
  /** Saqlanadigan kengaytma */
  storeExt: string;
}

/** Ruxsat etilgan turlar (haqiqiy tarkibdan aniqlangan MIME bo'yicha). SVG ataylab kiritilmagan (XSS xavfi). */
const ALLOWED: Record<string, AllowedType> = {
  'image/jpeg': { kind: 'IMAGE', extensions: ['jpg', 'jpeg'], storeExt: 'jpg' },
  'image/png': { kind: 'IMAGE', extensions: ['png'], storeExt: 'png' },
  'image/webp': { kind: 'IMAGE', extensions: ['webp'], storeExt: 'webp' },
  'application/pdf': { kind: 'DOCUMENT', extensions: ['pdf'], storeExt: 'pdf' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    kind: 'DOCUMENT',
    extensions: ['docx'],
    storeExt: 'docx',
  },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
    kind: 'DOCUMENT',
    extensions: ['xlsx'],
    storeExt: 'xlsx',
  },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
    kind: 'DOCUMENT',
    extensions: ['pptx'],
    storeExt: 'pptx',
  },
};

export const ALLOWED_EXTENSIONS = Object.values(ALLOWED).flatMap((a) => a.extensions);

export function mediaDirs(config: Config) {
  return {
    images: path.join(config.uploadDir, 'images'),
    thumbs: path.join(config.uploadDir, 'thumbs'),
    documents: path.join(config.uploadDir, 'documents'),
    videos: path.join(config.uploadDir, 'videos'),
    tmp: path.join(config.uploadDir, 'tmp'),
  };
}

export async function ensureUploadDirs(config: Config) {
  const dirs = mediaDirs(config);
  await Promise.all(Object.values(dirs).map((d) => fs.mkdir(d, { recursive: true })));
}

export function mediaFilePath(config: Config, media: Pick<Media, 'kind' | 'storedName'>) {
  const dirs = mediaDirs(config);
  const dir = media.kind === 'IMAGE' ? dirs.images : media.kind === 'VIDEO' ? dirs.videos : dirs.documents;
  return path.join(dir, media.storedName);
}

/** Foydalanuvchi yuborgan nom faqat ko'rsatish uchun saqlanadi; fayl tizimi yo'li sifatida ishlatilmaydi. */
export function cleanOriginalName(name: string): string {
  let n = name;
  // multer fayl nomini latin1 sifatida dekodlaydi; UTF-8 nomlarni tiklaymiz
  if (/[\u0080-ÿ]/.test(n) && !/[^\u0000-ÿ]/.test(n)) {
    const fixed = Buffer.from(n, 'latin1').toString('utf8');
    if (!fixed.includes('�')) n = fixed;
  }
  n = n
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  n = path.basename(n);
  return (n || 'fayl').slice(0, 200);
}

export interface IngestResult {
  media: Media & { translations: MediaTranslation[] };
}

export async function ingestUpload(
  config: Config,
  file: { buffer: Buffer; originalname: string; size: number },
  uploadedById: string,
  only?: 'IMAGE' | 'DOCUMENT',
): Promise<IngestResult> {
  if (file.size === 0) throw badRequest('Fayl bo‘sh', 'EMPTY_FILE');
  if (file.size > config.maxUploadBytes) {
    throw payloadTooLarge(`Fayl hajmi ${Math.round(config.maxUploadBytes / 1024 / 1024)} MB dan oshmasligi kerak`);
  }

  const detected = await fileTypeFromBuffer(file.buffer);
  const allowed = detected ? ALLOWED[detected.mime] : undefined;
  if (!detected || !allowed) {
    throw unsupportedMedia(
      `Bu fayl turi qabul qilinmaydi. Ruxsat etilgan formatlar: ${ALLOWED_EXTENSIONS.join(', ')}`,
    );
  }
  if (only && allowed.kind !== only) {
    throw unsupportedMedia(only === 'IMAGE' ? 'Faqat rasm yuklash mumkin' : 'Faqat hujjat yuklash mumkin');
  }

  const originalName = cleanOriginalName(file.originalname);
  const declaredExt = path.extname(originalName).slice(1).toLowerCase();
  if (!allowed.extensions.includes(declaredExt)) {
    throw unsupportedMedia('Fayl kengaytmasi uning haqiqiy tarkibiga mos kelmaydi');
  }

  const dirs = mediaDirs(config);
  await ensureUploadDirs(config);
  const baseName = crypto.randomUUID();
  const storedName = `${baseName}.${allowed.storeExt}`;

  let data = file.buffer;
  let width: number | null = null;
  let height: number | null = null;
  let hasThumb = false;
  let thumbData: Buffer | null = null;

  if (allowed.kind === 'IMAGE') {
    try {
      // Qayta kodlash EXIF/metama'lumotlarni olib tashlaydi va ortiqcha kattalikni cheklaydi
      const base = sharp(file.buffer, { limitInputPixels: 60_000_000 }).rotate();
      const resized = base.clone().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true });
      const encoded =
        detected.mime === 'image/jpeg'
          ? resized.jpeg({ quality: 85, mozjpeg: true })
          : detected.mime === 'image/png'
            ? resized.png({ compressionLevel: 9 })
            : resized.webp({ quality: 85 });
      const { data: out, info } = await encoded.toBuffer({ resolveWithObject: true });
      data = out;
      width = info.width;
      height = info.height;
      thumbData = await sharp(file.buffer, { limitInputPixels: 60_000_000 })
        .rotate()
        .resize({ width: 480, withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer();
      hasThumb = true;
    } catch {
      throw unsupportedMedia('Rasm buzilgan yoki o‘qib bo‘lmadi');
    }
  }

  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  const target = path.join(allowed.kind === 'IMAGE' ? dirs.images : dirs.documents, storedName);
  const thumbTarget = path.join(dirs.thumbs, `${baseName}.webp`);

  await fs.writeFile(target, data, { flag: 'wx', mode: 0o640 });
  if (thumbData) await fs.writeFile(thumbTarget, thumbData, { flag: 'wx', mode: 0o640 });

  try {
    const media = await prisma.media.create({
      data: {
        kind: allowed.kind,
        originalName,
        storedName,
        mimeType: detected.mime,
        size: data.length,
        width,
        height,
        sha256,
        hasThumb,
        uploadedById,
      },
      include: { translations: true },
    });
    return { media };
  } catch (err) {
    await fs.rm(target, { force: true });
    await fs.rm(thumbTarget, { force: true });
    throw err;
  }
}

export async function removeMediaFiles(config: Config, media: Pick<Media, 'kind' | 'storedName' | 'hasThumb'>) {
  const dirs = mediaDirs(config);
  await fs.rm(mediaFilePath(config, media), { force: true });
  if (media.hasThumb) {
    await fs.rm(path.join(dirs.thumbs, `${media.storedName.replace(/\.[^.]+$/, '')}.webp`), { force: true });
  }
}

export function toAdminMedia(m: Media & { translations: MediaTranslation[] }): AdminMedia {
  const isImage = m.kind === 'IMAGE';
  const translations = Object.fromEntries(
    LOCALES.map((l) => {
      const t = m.translations.find((x) => x.locale === l);
      return [l, { alt: t?.alt ?? '', caption: t?.caption ?? '' }];
    }),
  ) as AdminMedia['translations'];
  return {
    id: m.id,
    kind: m.kind,
    originalName: m.originalName,
    mimeType: m.mimeType,
    size: m.size,
    width: m.width,
    height: m.height,
    url: isImage ? imageUrl(m.storedName) : m.kind === 'VIDEO' ? videoFileUrl(m.storedName) : null,
    thumbUrl: isImage && m.hasThumb ? thumbUrl(m.storedName) : null,
    downloadUrl: `/api/v1/admin/media/${m.id}/file`,
    showInGallery: m.showInGallery,
    createdAt: m.createdAt.toISOString(),
    translations,
  };
}

/** Fayl qayerda ishlatilayotganini topadi. `blocking` — fayl majburiy bog'langan, o'chirib bo'lmaydi. */
export async function findMediaUsage(media: Pick<Media, 'id' | 'storedName'>): Promise<MediaUsage[]> {
  const usage: MediaUsage[] = [];
  const { id, storedName } = media;
  const stem = storedName.replace(/\.[^.]+$/, '');

  const [docs, news, staff, pages, newsContent, programs, settings, videos, alumni, partners, videoFiles] = await Promise.all([
    prisma.document.findMany({ where: { fileMediaId: id }, include: { translations: true } }),
    prisma.news.findMany({ where: { coverMediaId: id }, include: { translations: true } }),
    prisma.staff.findMany({ where: { photoMediaId: id }, include: { translations: true } }),
    prisma.pageTranslation.findMany({ where: { content: { contains: stem } }, select: { pageId: true, title: true } }),
    prisma.newsTranslation.findMany({ where: { content: { contains: stem } }, select: { newsId: true, title: true } }),
    prisma.educationProgramTranslation.findMany({
      where: { description: { contains: stem } },
      select: { programId: true, title: true },
    }),
    prisma.siteSetting.findMany(),
    prisma.galleryVideo.findMany({ where: { thumbMediaId: id }, include: { translations: true } }),
    prisma.alumnus.findMany({ where: { photoMediaId: id }, include: { translations: true } }),
    prisma.partner.findMany({ where: { logoMediaId: id }, include: { translations: true } }),
    prisma.galleryVideo.findMany({ where: { fileMediaId: id }, include: { translations: true } }),
  ]);

  for (const d of docs) usage.push({ type: 'document', id: d.id, title: d.translations[0]?.title ?? d.id, blocking: true });
  for (const s of settings) {
    if (JSON.stringify(s.value).includes(`"${id}"`)) {
      usage.push({ type: 'settings', id: s.key, title: `Sayt sozlamalari: ${s.key}`, blocking: true });
    }
  }
  for (const v of videoFiles) usage.push({ type: 'video', id: v.id, title: v.translations[0]?.title ?? v.id, blocking: true });
  for (const n of news) usage.push({ type: 'news', id: n.id, title: n.translations[0]?.title ?? n.id, blocking: false });
  for (const v of videos) usage.push({ type: 'video', id: v.id, title: v.translations[0]?.title ?? v.id, blocking: false });
  for (const a of alumni) usage.push({ type: 'alumnus', id: a.id, title: a.translations[0]?.fullName ?? a.id, blocking: false });
  for (const p of partners) usage.push({ type: 'partner', id: p.id, title: p.translations[0]?.name ?? p.id, blocking: false });
  for (const s of staff) usage.push({ type: 'staff', id: s.id, title: s.translations[0]?.fullName ?? s.id, blocking: false });
  for (const p of pages) usage.push({ type: 'page', id: p.pageId, title: p.title, blocking: false });
  for (const n of newsContent) usage.push({ type: 'news', id: n.newsId, title: n.title, blocking: false });
  for (const p of programs) usage.push({ type: 'program', id: p.programId, title: p.title, blocking: false });
  return usage;
}

export async function assertMediaOfKind(id: string | null | undefined, kind: 'IMAGE' | 'DOCUMENT' | 'VIDEO') {
  if (!id) return;
  const m = await prisma.media.findUnique({ where: { id }, select: { kind: true } });
  if (!m) throw badRequest('Tanlangan fayl topilmadi', 'MEDIA_NOT_FOUND');
  if (m.kind !== kind) throw badRequest(kind === 'IMAGE' ? 'Rasm tanlang' : kind === 'VIDEO' ? 'Video fayl tanlang' : 'Hujjat faylini tanlang', 'MEDIA_KIND_MISMATCH');
}

// ───────────── Video fayllar ─────────────

/** Brauzer ijro eta oladigan konteynerlar (haqiqiy tarkibdan aniqlanadi). Kodek (masalan, HEVC) brauzerga bog'liq — hujjatlarda ko'rsatilgan. */
const VIDEO_TYPES: Record<string, { storeExt: string }> = {
  'video/mp4': { storeExt: 'mp4' },
  'video/x-m4v': { storeExt: 'm4v' },
  'video/quicktime': { storeExt: 'mov' },
  'video/webm': { storeExt: 'webm' },
};
const VIDEO_EXTENSIONS = ['mp4', 'm4v', 'mov', 'webm'];

/**
 * multer diskka yozgan vaqtinchalik video faylni tekshiradi va `videos/` katalogiga ko'chiradi.
 * Fayl xotiraga to'liq o'qilmaydi (katta hajm uchun). Xato bo'lsa, vaqtinchalik fayl o'chiriladi.
 */
export async function ingestVideo(
  config: Config,
  file: { path: string; originalname: string; size: number },
  uploadedById: string,
): Promise<IngestResult> {
  try {
    if (file.size === 0) throw badRequest('Fayl bo‘sh', 'EMPTY_FILE');
    if (file.size > config.maxVideoBytes) {
      throw payloadTooLarge(`Video hajmi ${Math.round(config.maxVideoBytes / 1024 / 1024)} MB dan oshmasligi kerak`);
    }
    const detected = await fileTypeFromFile(file.path);
    const allowed = detected ? VIDEO_TYPES[detected.mime] : undefined;
    if (!detected || !allowed) {
      throw unsupportedMedia('Bu video formati qabul qilinmaydi. MP4, MOV yoki WebM yuklang.');
    }
    const originalName = cleanOriginalName(file.originalname);
    const declaredExt = path.extname(originalName).slice(1).toLowerCase();
    if (!VIDEO_EXTENSIONS.includes(declaredExt)) {
      throw unsupportedMedia('Fayl kengaytmasi video formatiga mos kelmaydi (mp4, mov, m4v yoki webm)');
    }

    const dirs = mediaDirs(config);
    await ensureUploadDirs(config);
    const storedName = `${crypto.randomUUID()}.${allowed.storeExt}`;
    const target = path.join(dirs.videos, storedName);

    const hash = crypto.createHash('sha256');
    for await (const chunk of createReadStream(file.path)) hash.update(chunk as Buffer);
    await fs.rename(file.path, target);
    await fs.chmod(target, 0o640).catch(() => undefined);

    try {
      const media = await prisma.media.create({
        data: {
          kind: 'VIDEO',
          originalName,
          storedName,
          mimeType: detected.mime === 'video/quicktime' || detected.mime === 'video/x-m4v' ? 'video/mp4' : detected.mime,
          size: file.size,
          sha256: hash.digest('hex'),
          hasThumb: false,
          uploadedById,
        },
        include: { translations: true },
      });
      return { media };
    } catch (err) {
      await fs.rm(target, { force: true });
      throw err;
    }
  } catch (err) {
    await fs.rm(file.path, { force: true });
    throw err;
  }
}

/** Video faylini (media yozuvi va diskdagi fayl) o'chiradi. Yozuv hali ishlatilayotgan bo'lsa, tegmaydi. */
export async function deleteVideoMedia(config: Config, mediaId: string | null | undefined) {
  if (!mediaId) return;
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media || media.kind !== 'VIDEO') return;
  const used = await prisma.galleryVideo.count({ where: { fileMediaId: mediaId } });
  if (used > 0) return;
  await prisma.media.delete({ where: { id: mediaId } }).catch(() => undefined);
  await removeMediaFiles(config, media);
}

/** Hech bir videoga biriktirilmagan (yuklangan, lekin saqlanmagan) video fayllar va eskirgan vaqtinchalik fayllarni tozalaydi. */
export async function purgeStaleUploads(config: Config, now = new Date()) {
  const cutoff = new Date(now.getTime() - 24 * 3600 * 1000);
  const orphans = await prisma.media.findMany({
    where: { kind: 'VIDEO', createdAt: { lt: cutoff }, videoFiles: { none: {} } },
  });
  for (const m of orphans) {
    await prisma.media.delete({ where: { id: m.id } }).catch(() => undefined);
    await removeMediaFiles(config, m);
  }
  const tmp = mediaDirs(config).tmp;
  const entries = await fs.readdir(tmp).catch(() => [] as string[]);
  for (const name of entries) {
    const p = path.join(tmp, name);
    const st = await fs.stat(p).catch(() => null);
    if (st && now.getTime() - st.mtimeMs > 3600 * 1000) await fs.rm(p, { force: true });
  }
}
