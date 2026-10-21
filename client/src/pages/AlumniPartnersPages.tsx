import { Briefcase, ExternalLink, GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { LOCALE_SHORT, type PublicAlumnus, type PublicPartner } from '@uchkoprik/shared';
import { useAlumni, usePartners, useSettings } from '../api/public';
import { PageHeading } from '../components/PageHeading';
import { QueryBoundary } from '../components/QueryBoundary';
import { Badge, EmptyState } from '../components/ui/Feedback';
import { Pagination } from '../components/ui/Pagination';
import { useSeo } from '../hooks/useSeo';
import { useLocale, useT } from '../i18n/locale';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export function AlumnusCard({ a }: { a: PublicAlumnus }) {
  const t = useT();
  return (
    <article className="card flex gap-4 p-4 sm:p-5" lang={a.isFallback ? a.locale : undefined}>
      {a.photo ? (
        <img src={a.photo.thumbUrl ?? a.photo.url} alt={a.photo.alt || a.fullName} loading="lazy" width={96} height={96} className="h-20 w-20 shrink-0 rounded-full object-cover sm:h-24 sm:w-24" />
      ) : (
        <div aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-primary-50 text-xl font-semibold text-primary-600 sm:h-24 sm:w-24 sm:text-2xl">{initials(a.fullName)}</div>
      )}
      <div className="min-w-0">
        <h3 className="text-lg leading-snug">{a.fullName}</h3>
        <dl className="mt-1 space-y-0.5 text-sm text-muted">
          {a.graduationYear && <div className="flex items-center gap-1.5"><GraduationCap className="h-4 w-4 shrink-0" aria-hidden /><dt className="sr-only">{t('graduatedIn')}</dt><dd>{a.graduationYear}{a.program ? ` · ${a.program}` : ''}</dd></div>}
          {!a.graduationYear && a.program && <div><dt className="sr-only">{t('specialty')}</dt><dd>{a.program}</dd></div>}
          {a.workplace && <div className="flex items-center gap-1.5"><Briefcase className="h-4 w-4 shrink-0" aria-hidden /><dt className="sr-only">{t('workplace')}</dt><dd>{a.workplace}</dd></div>}
        </dl>
        {a.story && <p className="mt-2 text-base text-ink">{a.story}</p>}
        {a.isFallback && <Badge className="mt-2">{LOCALE_SHORT[a.locale]}</Badge>}
      </div>
    </article>
  );
}

export function PartnerCard({ p }: { p: PublicPartner }) {
  const t = useT();
  const body = (
    <>
      <div className="flex h-24 items-center justify-center rounded-md bg-surface p-3">
        {p.logo ? (
          <img src={p.logo.thumbUrl ?? p.logo.url} alt={p.logo.alt || p.name} loading="lazy" className="max-h-full max-w-full object-contain" />
        ) : (
          <span aria-hidden className="text-2xl font-semibold text-primary-300">{initials(p.name)}</span>
        )}
      </div>
      <h3 className="mt-3 text-base leading-snug">{p.name}</h3>
      {p.description && <p className="mt-1 line-clamp-3 text-sm text-ink">{p.description}</p>}
      {p.websiteUrl && <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary-700"><ExternalLink className="h-3.5 w-3.5" aria-hidden />{t('visitSite')}<span className="sr-only"> ({t('openInNewTab')})</span></p>}
    </>
  );
  return p.websiteUrl ? (
    <a href={p.websiteUrl} target="_blank" rel="noopener noreferrer" className="card-link flex h-full flex-col p-4" lang={p.isFallback ? p.locale : undefined}>{body}</a>
  ) : (
    <div className="card flex h-full flex-col p-4" lang={p.isFallback ? p.locale : undefined}>{body}</div>
  );
}

function useListSeo(title: string, path: string) {
  const locale = useLocale();
  const settings = useSettings(locale).data;
  useSeo({
    title: settings?.shortName ? `${title} | ${settings.shortName}` : title,
    description: settings?.seo.defaultDescription,
    locale,
    canonicalPath: `/${locale}/${path}`,
    alternates: (['uz', 'ru', 'en'] as const).map((l) => ({ locale: l, path: `/${l}/${path}` })),
  });
}

export function AlumniPage() {
  const locale = useLocale();
  const t = useT();
  const [page, setPage] = useState(1);
  const title = t('alumniTitle');
  useListSeo(title, 'alumni');
  const query = useAlumni({ locale, page, pageSize: 12 });
  return (
    <>
      <PageHeading title={title} trail={[]} />
      <div className="container-page section-y">
        <QueryBoundary query={query}>
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState title={t('noAlumni')} />
            ) : (
              <>
                <ul className="grid gap-4 lg:grid-cols-2 sm:gap-5">
                  {data.items.map((a) => <li key={a.id}><AlumnusCard a={a} /></li>)}
                </ul>
                <Pagination className="mt-8" meta={data.meta} onPage={setPage} labels={{ prev: t('prev'), next: t('next'), nav: title, pageOf: (p, total) => t('pageOf', { page: p, total }) }} />
              </>
            )
          }
        </QueryBoundary>
      </div>
    </>
  );
}

export function PartnersPage() {
  const locale = useLocale();
  const t = useT();
  const title = t('partnersTitle');
  useListSeo(title, 'partners');
  const query = usePartners(locale);
  return (
    <>
      <PageHeading title={title} trail={[]} />
      <div className="container-page section-y">
        <QueryBoundary query={query}>
          {(data) =>
            data.items.length === 0 ? (
              <EmptyState title={t('noPartners')} />
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                {data.items.map((p) => <li key={p.id}><PartnerCard p={p} /></li>)}
              </ul>
            )
          }
        </QueryBoundary>
      </div>
    </>
  );
}
