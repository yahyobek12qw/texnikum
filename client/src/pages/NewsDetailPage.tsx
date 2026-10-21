import { Navigate, useLocation, useParams } from 'react-router-dom';
import { NEWS_TYPE_ROUTES, type PublicNewsDetail } from '@uchkoprik/shared';
import { usePublicNewsItem, useSettings } from '../api/public';
import { QueryBoundary } from '../components/QueryBoundary';
import { useSeo } from '../hooks/useSeo';
import { useLocale, useRegisterAlternates } from '../i18n/locale';
import NotFoundPage from './NotFoundPage';
import { NewsView } from './NewsView';

function Loaded({ item, urlSlug }: { item: PublicNewsDetail; urlSlug: string }) {
  const locale = useLocale();
  const { pathname } = useLocation();
  const settings = useSettings(locale).data;
  const route = NEWS_TYPE_ROUTES[item.type];
  const siteName = settings?.shortName || settings?.officialName || '';
  const title = item.seoTitle || item.title;

  useRegisterAlternates(item.alternates, `${route}/`);
  useSeo({
    title: siteName ? `${title} | ${siteName}` : title,
    description: item.seoDescription || item.excerpt || settings?.seo.defaultDescription,
    locale,
    noindex: item.isFallback,
    canonicalPath: `/${item.locale}/${route}/${item.slug}`,
    alternates: item.alternates.filter((a) => a.available && a.slug).map((a) => ({ locale: a.locale, path: `/${a.locale}/${route}/${a.slug}` })),
  });

  if (!item.isFallback && (item.slug !== urlSlug || pathname.split('/')[2] !== route)) {
    return <Navigate to={`/${locale}/${route}/${item.slug}`} replace />;
  }
  return <NewsView item={item} showRelated />;
}

export default function NewsDetailPage() {
  const { slug = '' } = useParams();
  const locale = useLocale();
  const query = usePublicNewsItem(slug, locale);
  return (
    <QueryBoundary query={query} notFound={<NotFoundPage />}>
      {(item) => <Loaded item={item} urlSlug={slug} />}
    </QueryBoundary>
  );
}
