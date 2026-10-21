import type { AdminMediaRef, ImageRef, Locale } from '@uchkoprik/shared';
import { resolveTranslation } from './translations.js';

export const videoFileUrl = (storedName: string) => `/uploads/videos/${storedName}`;
export const imageUrl = (storedName: string) => `/uploads/images/${storedName}`;
export const thumbUrl = (storedName: string) =>
  `/uploads/thumbs/${storedName.replace(/\.[^.]+$/, '')}.webp`;

export interface MediaLike {
  id: string;
  kind: 'IMAGE' | 'DOCUMENT' | 'VIDEO';
  storedName: string;
  originalName?: string;
  hasThumb: boolean;
  width: number | null;
  height: number | null;
  translations?: { locale: Locale; alt: string }[];
}

/** Ommaviy API uchun rasm havolasi. Hujjat fayllari ommaviy URL'ga ega emas. */
export function toImageRef(media: MediaLike | null | undefined, locale: Locale): ImageRef | null {
  if (!media || media.kind !== 'IMAGE') return null;
  const alt = media.translations ? (resolveTranslation(media.translations, locale)?.tr.alt ?? '') : '';
  return {
    id: media.id,
    url: imageUrl(media.storedName),
    thumbUrl: media.hasThumb ? thumbUrl(media.storedName) : null,
    alt,
    width: media.width,
    height: media.height,
  };
}

export function toAdminMediaRef(media: MediaLike | null | undefined): AdminMediaRef | null {
  if (!media) return null;
  const isImage = media.kind === 'IMAGE';
  return {
    id: media.id,
    kind: media.kind,
    originalName: media.originalName ?? media.storedName,
    url: isImage ? imageUrl(media.storedName) : media.kind === 'VIDEO' ? videoFileUrl(media.storedName) : null,
    thumbUrl: isImage && media.hasThumb ? thumbUrl(media.storedName) : null,
  };
}
