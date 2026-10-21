import { Calendar, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NEWS_TYPE_ROUTES, type PublicNewsDetail } from '@uchkoprik/shared';
import { useNewsList } from '../api/public';
import { PageHeading, TranslationNotice } from '../components/PageHeading';
import { RichContent } from '../components/RichContent';
import { buttonClass } from '../components/ui/Button';
import { NewsCard } from '../features/news/NewsCard';
import { formatDate, useLocale, useT } from '../i18n/locale';

function Related({ item }: { item: PublicNewsDetail }) {
  const locale = useLocale();
  const t = useT();
  const query = useNewsList({ locale, type: item.type, pageSize: 4 });
  const others = (query.data?.items ?? []).filter((n) => n.id !== item.id).slice(0, 3);
  if (others.length === 0) return null;
  return (
    <section aria-labelledby="related-news" className="mt-14 border-t border-line pt-10">
      <h2 id="related-news" className="section-title mb-6">{t('relatedNews')}</h2>
      <ul className="grid gap-3 sm:grid-cols-3 sm:gap-5">
        {others.map((n) => <li key={n.id} className="flex"><NewsCard item={n} className="w-full" /></li>)}
      </ul>
    </section>
  );
}

/** Yangilik/e'lon/tadbir ko'rinishi (ommaviy sayt va admin oldindan ko'rish uchun umumiy). */
export function NewsView({ item, showRelated = false }: { item: PublicNewsDetail; showRelated?: boolean }) {
  const locale = useLocale();
  const t = useT();
  const listRoute = NEWS_TYPE_ROUTES[item.type];
  const listTitle = { NEWS: t('newsTitle'), ANNOUNCEMENT: t('announcementsTitle'), EVENT: t('eventsTitle') }[item.type];

  return (
    <>
      <PageHeading title={item.title} trail={[{ title: listTitle, href: `/${locale}/${listRoute}` }]}>
        <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5"><Calendar className="h-4 w-4" aria-hidden /><time dateTime={item.publishedAt}>{formatDate(item.publishedAt, locale)}</time></span>
          {item.eventAt && <span>{t('eventDate')}: <time dateTime={item.eventAt}>{formatDate(item.eventAt, locale, true)}</time></span>}
          {item.category && <span className="inline-flex items-center gap-1.5"><Tag className="h-4 w-4" aria-hidden />{item.category.name}</span>}
        </p>
      </PageHeading>
      <div className="container-page section-y" lang={item.isFallback ? item.locale : undefined}>
        <TranslationNotice info={item} />
        <article className="mx-auto max-w-3xl">
          {item.cover && (
            <figure className="mb-8">
              <img src={item.cover.url} alt={item.cover.alt} width={item.cover.width ?? undefined} height={item.cover.height ?? undefined} className="w-full rounded-lg border border-line" />
            </figure>
          )}
          {item.excerpt && <p className="mb-6 border-l-4 border-accent-600 pl-4 text-lg leading-relaxed text-primary-800 sm:text-xl">{item.excerpt}</p>}
          <RichContent html={item.content} />
          <Link to={`/${locale}/${listRoute}`} className={buttonClass('secondary', 'md', 'mt-10')}>← {t('backToList')}</Link>
        </article>
        {showRelated && <div className="mx-auto max-w-5xl"><Related item={item} /></div>}
      </div>
    </>
  );
}
