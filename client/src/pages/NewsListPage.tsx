import { Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { NewsType } from '@uchkoprik/shared';
import { useNewsList, usePublicCategories, useSettings } from '../api/public';
import { PageHeading } from '../components/PageHeading';
import { QueryBoundary } from '../components/QueryBoundary';
import { EmptyState } from '../components/ui/Feedback';
import { Input, Select } from '../components/ui/Form';
import { Pagination } from '../components/ui/Pagination';
import { NewsCard } from '../features/news/NewsCard';
import { useDebounced } from '../hooks/useDebounced';
import { useSeo } from '../hooks/useSeo';
import { useLocale, useT } from '../i18n/locale';
import type { DictKey } from '../i18n/dictionary';

const TITLES: Record<NewsType, { title: DictKey; empty: DictKey }> = {
  NEWS: { title: 'newsTitle', empty: 'noNews' },
  ANNOUNCEMENT: { title: 'announcementsTitle', empty: 'noAnnouncements' },
  EVENT: { title: 'eventsTitle', empty: 'noEvents' },
};
const ROUTES: Record<NewsType, string> = { NEWS: 'news', ANNOUNCEMENT: 'announcements', EVENT: 'events' };

export default function NewsListPage({ type }: { type: NewsType }) {
  const locale = useLocale();
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q, 350);
  const category = params.get('category') ?? '';
  const page = Number(params.get('page') ?? 1) || 1;
  const settings = useSettings(locale).data;

  const categories = usePublicCategories(locale, 'NEWS');
  const query = useNewsList({ locale, type, page, pageSize: 9, category: category || undefined, q: debouncedQ || undefined });

  const title = t(TITLES[type].title);
  useSeo({
    title: settings?.shortName ? `${title} | ${settings.shortName}` : title,
    description: settings?.seo.defaultDescription,
    locale,
    canonicalPath: `/${locale}/${ROUTES[type]}`,
    alternates: (['uz', 'ru', 'en'] as const).map((l) => ({ locale: l, path: `/${l}/${ROUTES[type]}` })),
  });

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeading title={title} trail={[]} />
      <div className="container-page py-8">
        <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_16rem]">
          <div className="relative">
            <label htmlFor="news-search" className="sr-only">{t('searchNews')}</label>
            <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted" aria-hidden />
            <Input
              id="news-search"
              type="search"
              className="pl-10"
              placeholder={t('searchNews')}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                update({ q: e.target.value.trim() || null, page: null });
              }}
            />
          </div>
          {(categories.data?.items.length ?? 0) > 0 && (
            <div>
              <label htmlFor="news-category" className="sr-only">{t('category')}</label>
              <Select id="news-category" value={category} onChange={(e) => update({ category: e.target.value || null, page: null })}>
                <option value="">{t('allCategories')}</option>
                {categories.data?.items.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
              </Select>
            </div>
          )}
        </div>

        <QueryBoundary query={query}>
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState title={debouncedQ || category ? t('noResults') : t(TITLES[type].empty)} />
            ) : (
              <>
                <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {data.items.map((n) => <li key={n.id} className="flex"><NewsCard item={n} className="w-full" /></li>)}
                </ul>
                <Pagination
                  className="mt-8"
                  meta={data.meta}
                  onPage={(p) => update({ page: p > 1 ? String(p) : null })}
                  labels={{ prev: t('prev'), next: t('next'), nav: title, pageOf: (p, total) => t('pageOf', { page: p, total }) }}
                />
              </>
            )
          }
        </QueryBoundary>
      </div>
    </>
  );
}
