import { ExternalLink, Play } from 'lucide-react';
import { useState } from 'react';
import { LOCALE_SHORT, type PublicVideo } from '@uchkoprik/shared';
import { Badge } from '../../components/ui/Feedback';
import { useT } from '../../i18n/locale';

/**
 * Click-to-load: sahifa ochilganda YouTube/Vimeo iframe yuklanmaydi (tezlik va maxfiylik), faqat "ijro" bosilganda.
 * Ko'rsatkich rasm: yuklangan rasm bo'lsa o'sha, bo'lmasa YouTube'ning ochiq rasmi.
 */
export function VideoCard({ video }: { video: PublicVideo }) {
  const t = useT();
  const [playing, setPlaying] = useState(false);
  const thumb = video.thumbnail?.thumbUrl ?? video.thumbnail?.url ?? video.thumbnailUrl ?? undefined;
  const lang = video.isFallback ? video.locale : undefined;

  return (
    <article className="card overflow-hidden">
      <div className="relative aspect-video bg-primary-900">
        {playing && video.fileUrl ? (
          <video
            src={video.fileUrl}
            poster={video.thumbnail?.url ?? undefined}
            className="absolute inset-0 h-full w-full bg-black"
            controls
            autoPlay
            playsInline
            preload="metadata"
            aria-label={video.title}
          />
        ) : playing && video.embedUrl ? (
          <iframe
            src={video.embedUrl}
            title={video.title}
            className="absolute inset-0 h-full w-full"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
          />
        ) : (
          <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 flex items-center justify-center" aria-label={`${t('playVideo')}: ${video.title}`}>
            {thumb && <img src={thumb} alt="" loading="lazy" referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-cover" />}
            <span className="absolute inset-0 bg-primary-900/30 transition-colors group-hover:bg-primary-900/10" aria-hidden />
            <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-primary-700 shadow-lg transition-transform group-hover:scale-110">
              <Play className="ml-1 h-7 w-7" aria-hidden />
            </span>
          </button>
        )}
      </div>
      <div className="space-y-1.5 p-4" lang={lang}>
        <h3 className="text-base leading-snug sm:text-lg">{video.title}</h3>
        {video.description && <p className="line-clamp-3 text-sm text-ink">{video.description}</p>}
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted">
          {video.isFallback && <Badge>{LOCALE_SHORT[video.locale]}</Badge>}
          {video.watchUrl && (
            <a href={video.watchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-muted">
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              {t('watchOn')}
              <span className="sr-only"> ({t('openInNewTab')})</span>
            </a>
          )}
        </p>
      </div>
    </article>
  );
}
