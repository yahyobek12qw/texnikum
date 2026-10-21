import { Navigate, useParams } from 'react-router-dom';
import { usePublicPage } from '../api/public';
import { QueryBoundary } from '../components/QueryBoundary';
import { useSeo } from '../hooks/useSeo';
import { useLocale, useRegisterAlternates } from '../i18n/locale';
import NotFoundPage from './NotFoundPage';
import { PageView } from './PageView';
import { useSettings } from '../api/public';
import type { PublicPage } from '@uchkoprik/shared';

function Loaded({ page, urlSlug }: { page: PublicPage; urlSlug: string }) {
  const locale = useLocale();
  const settings = useSettings(locale).data;
  const siteName = settings?.shortName || settings?.officialName || '';
  const title = page.seoTitle || page.title;

  useRegisterAlternates(page.alternates);
  useSeo({
    title: siteName ? `${title} | ${siteName}` : title,
    description: page.seoDescription ?? settings?.seo.defaultDescription,
    locale,
    noindex: page.isFallback,
    canonicalPath: `/${page.locale}/${page.slug}`,
    alternates: page.alternates.filter((a) => a.available && a.slug).map((a) => ({ locale: a.locale, path: `/${a.locale}/${a.slug}` })),
  });

  // Til almashtirilganda yoki eski slug bilan kirilganda mos (kanonik) manzilga o'tadi
  if (!page.isFallback && page.slug !== urlSlug) return <Navigate to={`/${locale}/${page.slug}`} replace />;
  return <PageView page={page} />;
}

export default function CmsPage() {
  const { slug = '' } = useParams();
  const locale = useLocale();
  const query = usePublicPage(slug, locale);
  return (
    <QueryBoundary query={query} notFound={<NotFoundPage />}>
      {(page) => <Loaded page={page} urlSlug={slug} />}
    </QueryBoundary>
  );
}
