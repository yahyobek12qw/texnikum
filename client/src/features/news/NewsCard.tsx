import { Calendar, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LOCALE_SHORT, NEWS_TYPE_ROUTES, type PublicNewsItem } from '@uchkoprik/shared';
import { Badge } from '../../components/ui/Feedback';
import { cn } from '../../components/ui/cn';
import { formatDate, useLocale, useT } from '../../i18n/locale';

export function newsHref(locale: string, item: Pick<PublicNewsItem, 'type' | 'slug'>) {
  return `/${locale}/${NEWS_TYPE_ROUTES[item.type]}/${item.slug}`;
}

interface Props {
  item: PublicNewsItem;
  className?: string;
  /** Katta (asosiy) kartochka: keng ekranda rasm chapda, matn o'ngda */
  featured?: boolean;
}

/**
 * Mobil (<sm): ixcham qator (kichik rasm chapda) — sahifa uzayib ketmasligi uchun.
 * sm+: vertikal kartochka; `featured` — lg da gorizontal katta kartochka.
 */
export function NewsCard({ item, className, featured }: Props) {
  const locale = useLocale();
  const t = useT();
  const typeLabel = { NEWS: t('typeNews'), ANNOUNCEMENT: t('announcementsTitle'), EVENT: t('eventsTitle') }[item.type];
  const href = newsHref(locale, item);
  const lang = item.isFallback ? item.locale : undefined;

  return (
    <article className={cn('card group flex overflow-hidden transition hover:border-primary-500 hover:shadow-md', featured ? 'sm:flex-col lg:flex-row' : 'sm:flex-col', className)}>
      <Link
        to={href}
        tabIndex={-1}
        aria-hidden
        className={cn('block shrink-0 overflow-hidden bg-surface', featured ? 'w-28 sm:w-full lg:w-[55%]' : 'w-28 sm:w-full')}
      >
        {item.cover ? (
          <img
            src={item.cover.thumbUrl ?? item.cover.url}
            alt=""
            loading="lazy"
            width={item.cover.width ?? 480}
            height={item.cover.height ?? 270}
            className={cn('h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]', featured ? 'aspect-square sm:aspect-[16/9] lg:aspect-auto lg:min-h-64' : 'aspect-square sm:aspect-[16/9]')}
          />
        ) : (
          <div className={cn('h-full w-full bg-gradient-to-br from-primary-50 to-primary-100', featured ? 'aspect-square sm:aspect-[16/9] lg:min-h-64' : 'aspect-square sm:aspect-[16/9]')} />
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-4 lg:p-5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted sm:text-sm">
          <Badge tone="info">{typeLabel}</Badge>
          {item.isImportant && (
            <Badge tone="warn"><Star className="mr-1 h-3 w-3" aria-hidden />{t('important')}</Badge>
          )}
          {item.category && <span className="hidden sm:inline">{item.category.name}</span>}
          {item.isFallback && <Badge tone="neutral"><span lang={item.locale}>{LOCALE_SHORT[item.locale]}</span></Badge>}
        </div>
        <h3 className={cn('leading-snug', featured ? 'text-lg sm:text-xl lg:text-2xl' : 'text-base sm:text-lg')}>
          <Link to={href} className="text-primary-800 no-underline group-hover:underline" lang={lang}>
            {item.title}
          </Link>
        </h3>
        {item.excerpt && (
          <p className={cn('hidden text-ink sm:block', featured ? 'line-clamp-4 text-base lg:text-lg' : 'line-clamp-3 text-base')} lang={lang}>
            {item.excerpt}
          </p>
        )}
        <p className="mt-auto flex items-center gap-1.5 pt-1 text-xs text-muted sm:pt-2 sm:text-sm">
          <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
          <time dateTime={item.publishedAt}>{formatDate(item.publishedAt, locale)}</time>
        </p>
      </div>
    </article>
  );
}

/** Yon ustun uchun ixcham qator: sana + sarlavha. */
export function NewsLine({ item }: { item: PublicNewsItem }) {
  const locale = useLocale();
  const t = useT();
  return (
    <li className="py-3">
      <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <time dateTime={item.publishedAt}>{formatDate(item.publishedAt, locale)}</time>
        {item.isImportant && <Badge tone="warn">{t('important')}</Badge>}
      </p>
      <Link to={newsHref(locale, item)} className="mt-0.5 block font-medium leading-snug text-primary-800 no-underline hover:underline" lang={item.isFallback ? item.locale : undefined}>
        {item.title}
      </Link>
    </li>
  );
}
