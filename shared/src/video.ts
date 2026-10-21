import type { ExternalVideoProvider } from './enums.js';

export interface ParsedVideo {
  provider: ExternalVideoProvider;
  externalId: string;
}

/**
 * Faqat YouTube va Vimeo havolalari qabul qilinadi (boshqa saytlarni iframe'ga joylamaslik uchun).
 * Qo'llab-quvvatlanadigan shakllar: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, /shorts/ID, vimeo.com/ID.
 */
export function parseVideoUrl(input: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');

  if (host === 'youtu.be') {
    const id = url.pathname.split('/')[1] ?? '';
    return /^[\w-]{11}$/.test(id) ? { provider: 'YOUTUBE', externalId: id } : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const fromQuery = url.searchParams.get('v');
    const parts = url.pathname.split('/').filter(Boolean);
    const id = fromQuery ?? (['embed', 'shorts', 'v', 'live'].includes(parts[0] ?? '') ? parts[1] : undefined) ?? '';
    return /^[\w-]{11}$/.test(id) ? { provider: 'YOUTUBE', externalId: id } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts.find((p) => /^\d{5,12}$/.test(p));
    return id ? { provider: 'VIMEO', externalId: id } : null;
  }
  return null;
}

export const videoEmbedUrl = (provider: ExternalVideoProvider, externalId: string): string =>
  provider === 'YOUTUBE'
    ? `https://www.youtube-nocookie.com/embed/${externalId}?rel=0&autoplay=1`
    : `https://player.vimeo.com/video/${externalId}?autoplay=1`;

export const videoThumbUrl = (provider: ExternalVideoProvider, externalId: string): string | null =>
  provider === 'YOUTUBE' ? `https://i.ytimg.com/vi/${externalId}/hqdefault.jpg` : null;

export const videoWatchUrl = (provider: ExternalVideoProvider, externalId: string): string =>
  provider === 'YOUTUBE' ? `https://www.youtube.com/watch?v=${externalId}` : `https://vimeo.com/${externalId}`;
