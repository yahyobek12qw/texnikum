import path from 'node:path';
import type { RequestHandler } from 'express';
import type { Config } from '../../config/env.js';
import { notFound } from '../../lib/errors.js';
import { getModules } from '../../lib/modules.js';
import { prisma } from '../../lib/prisma.js';
import { hashToken, sessionCookieName } from '../auth/session.js';
import { mediaDirs } from './media.service.js';

const NAME = /^[0-9a-f-]{36}\.(mp4|m4v|mov|webm)$/;

/**
 * Yuklangan video fayllarni beradi (HTTP Range bilan — brauzer oldinga o'tkaza oladi).
 * - Nashr qilingan videoga biriktirilgan va "Videogalereya" moduli yoqilgan bo'lsa: hamma uchun.
 * - Aks holda (qoralama, arxiv, modul o'chiq): faqat kirgan faol xodim uchun, aks holda 404.
 */
export function videoFileHandler(config: Config): RequestHandler {
  const cookieName = sessionCookieName(config);
  const dir = mediaDirs(config).videos;
  return async (req, res) => {
    const name = String(req.params.name ?? '');
    if (!NAME.test(name)) throw notFound();
    const media = await prisma.media.findFirst({ where: { kind: 'VIDEO', storedName: name }, select: { id: true } });
    if (!media) throw notFound();

    const published = await prisma.galleryVideo.findFirst({ where: { fileMediaId: media.id, status: 'PUBLISHED' }, select: { id: true } });
    let isPublic = Boolean(published);
    if (isPublic) isPublic = (await getModules()).videoGallery;

    if (!isPublic) {
      const token = (req.cookies as Record<string, string> | undefined)?.[cookieName];
      const session = token
        ? await prisma.session.findUnique({ where: { id: hashToken(token) }, include: { user: { select: { isActive: true } } } })
        : null;
      if (!session || !session.user.isActive || session.expiresAt.getTime() <= Date.now()) throw notFound();
      res.setHeader('Cache-Control', 'private, no-store');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }

    // .mov/.m4v tarkibi MP4 bilan bir xil; brauzerlar ko'pincha video/mp4 turini kutadi
    const ext = path.extname(name).slice(1);
    res.sendFile(path.join(dir, name), {
      dotfiles: 'deny',
      acceptRanges: true,
      cacheControl: false,
      headers: { 'Content-Type': ext === 'webm' ? 'video/webm' : 'video/mp4' },
    });
  };
}
