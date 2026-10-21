import { Clock, ExternalLink, Mail, MapPin, Phone, Search } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePublicSearch, useSettings } from '../api/public';
import { PageHeading } from '../components/PageHeading';
import { QueryBoundary } from '../components/QueryBoundary';
import { SmartLink } from '../components/SmartLink';
import { Button, buttonClass } from '../components/ui/Button';
import { Badge, EmptyState } from '../components/ui/Feedback';
import { Input } from '../components/ui/Form';
import { Pagination } from '../components/ui/Pagination';
import { useSeo } from '../hooks/useSeo';
import { formatDate, useLocale, useT } from '../i18n/locale';
import { Link } from 'react-router-dom';
import type { DictKey } from '../i18n/dictionary';

function usePageSeo(titleKey: DictKey, path: string, noindex = false) {
  const locale = useLocale();
  const t = useT();
  const settings = useSettings(locale).data;
  const title = t(titleKey);
  useSeo({
    title: settings?.shortName ? `${title} | ${settings.shortName}` : title,
    description: settings?.seo.defaultDescription,
    locale,
    noindex,
    canonicalPath: `/${locale}/${path}`,
    alternates: (['uz', 'ru', 'en'] as const).map((l) => ({ locale: l, path: `/${l}/${path}` })),
  });
  return title;
}

// ───────────── Foydali havolalar ─────────────

export function UsefulLinksPage() {
  const locale = useLocale();
  const t = useT();
  const title = usePageSeo('usefulLinksTitle', 'useful-links');
  const settings = useSettings(locale);
  return (
    <>
      <PageHeading title={title} trail={[]} />
      <div className="container-page py-8">
        <QueryBoundary query={settings}>
          {(s) =>
            s.usefulLinks.length === 0 ? (
              <EmptyState title={t('noLinks')} />
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {s.usefulLinks.map((l) => (
                  <li key={l.id}>
                    <SmartLink href={l.url} newTab showExternalIcon className="flex h-full min-h-20 items-center justify-between gap-3 rounded-lg border border-line bg-white p-5 text-lg font-medium text-primary-800 no-underline shadow-card hover:border-primary-500 hover:bg-primary-50">
                      <span>{l.label}</span>
                      <ExternalLink className="h-5 w-5 shrink-0 text-muted" aria-hidden />
                    </SmartLink>
                  </li>
                ))}
              </ul>
            )
          }
        </QueryBoundary>
      </div>
    </>
  );
}

// ───────────── Aloqa ─────────────

export function ContactsPage() {
  const locale = useLocale();
  const t = useT();
  const title = usePageSeo('contactsTitle', 'contacts');
  const settings = useSettings(locale);
  return (
    <>
      <PageHeading title={title} trail={[]} />
      <div className="container-page py-8">
        <QueryBoundary query={settings}>
          {(s) => {
            const social = Object.entries(s.social).filter(([, v]) => v);
            const empty = !s.address && s.phones.length === 0 && !s.email && !s.workingHours && !s.mapUrl && social.length === 0;
            if (empty) return <EmptyState title={t('noContacts')} />;
            return (
              <div className="grid gap-6 lg:grid-cols-2">
                <dl className="space-y-5 rounded-lg border border-line bg-white p-6 shadow-card">
                  {s.address && (
                    <div className="flex gap-3"><MapPin className="mt-1 h-5 w-5 shrink-0 text-accent-600" aria-hidden />
                      <div><dt className="text-sm text-muted">{t('address')}</dt><dd className="text-lg">{s.address}</dd></div></div>
                  )}
                  {s.phones.length > 0 && (
                    <div className="flex gap-3"><Phone className="mt-1 h-5 w-5 shrink-0 text-accent-600" aria-hidden />
                      <div><dt className="text-sm text-muted">{t('phones')}</dt>{s.phones.map((p) => <dd key={p} className="text-lg"><a href={`tel:${p.replace(/[^\d+]/g, '')}`}>{p}</a></dd>)}</div></div>
                  )}
                  {s.email && (
                    <div className="flex gap-3"><Mail className="mt-1 h-5 w-5 shrink-0 text-accent-600" aria-hidden />
                      <div><dt className="text-sm text-muted">{t('email')}</dt><dd className="text-lg"><a href={`mailto:${s.email}`}>{s.email}</a></dd></div></div>
                  )}
                  {s.workingHours && (
                    <div className="flex gap-3"><Clock className="mt-1 h-5 w-5 shrink-0 text-accent-600" aria-hidden />
                      <div><dt className="text-sm text-muted">{t('workingHours')}</dt><dd className="whitespace-pre-line text-lg">{s.workingHours}</dd></div></div>
                  )}
                </dl>
                <div className="space-y-4">
                  {s.mapUrl && (
                    <a href={s.mapUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('primary', 'lg')}>
                      <MapPin className="h-5 w-5" aria-hidden />{t('openMap')}
                      <span className="sr-only"> ({t('openInNewTab')})</span>
                    </a>
                  )}
                  {social.length > 0 && (
                    <div>
                      <h2 className="mb-2 text-lg">{t('followUs')}</h2>
                      <ul className="flex flex-wrap gap-2">
                        {social.map(([k, url]) => (
                          <li key={k}><a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'md')}>{k.charAt(0).toUpperCase() + k.slice(1)}</a></li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          }}
        </QueryBoundary>
      </div>
    </>
  );
}

// ───────────── Qidiruv ─────────────

export function SearchPage() {
  const locale = useLocale();
  const t = useT();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const page = Number(params.get('page') ?? 1) || 1;
  const [input, setInput] = useState(q);
  const title = usePageSeo('searchTitle', 'search', true);
  const query = usePublicSearch({ locale, q, page });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(`/${locale}/search?q=${encodeURIComponent(input.trim())}`);
  };
  const typeLabel = (type: string) => ({ page: t('typePage'), news: t('typeNews'), document: t('typeDocument'), program: t('typeProgram') })[type] ?? type;

  return (
    <>
      <PageHeading title={title} trail={[]} />
      <div className="container-page py-8">
        <form role="search" onSubmit={submit} className="mb-3 flex max-w-2xl gap-2">
          <label htmlFor="search-page-input" className="sr-only">{t('search')}</label>
          <Input id="search-page-input" type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t('searchPlaceholder')} />
          <Button type="submit" icon={<Search className="h-5 w-5" aria-hidden />}>{t('search')}</Button>
        </form>
        <p className="mb-6 text-sm text-muted">{t('searchOnlyLanguage')}</p>

        {q.trim().length < 2 ? (
          <EmptyState title={t('searchHint')} />
        ) : (
          <QueryBoundary query={query}>
            {(data) =>
              data.items.length === 0 ? (
                <EmptyState title={t('noResults')} />
              ) : (
                <>
                  <h2 className="mb-1 text-xl">{t('searchResultsFor', { q })}</h2>
                  <p className="mb-4 text-sm text-muted">{t('resultsCount', { count: data.meta.total })}</p>
                  <ul className="space-y-3">
                    {data.items.map((r) => (
                      <li key={`${r.type}-${r.id}`} className="rounded-lg border border-line bg-white p-4 shadow-card">
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                          <Badge tone="info">{typeLabel(r.type)}</Badge>
                          {r.date && <time dateTime={r.date}>{formatDate(r.date, locale)}</time>}
                        </div>
                        <h3 className="mt-1 text-lg"><Link to={r.href} className="no-underline hover:underline">{r.title}</Link></h3>
                        {r.snippet && <p className="mt-1 text-base text-ink">{r.snippet}</p>}
                      </li>
                    ))}
                  </ul>
                  <Pagination
                    className="mt-6"
                    meta={data.meta}
                    onPage={(p) => setParams({ q, ...(p > 1 ? { page: String(p) } : {}) })}
                    labels={{ prev: t('prev'), next: t('next'), nav: title, pageOf: (p, total) => t('pageOf', { page: p, total }) }}
                  />
                </>
              )
            }
          </QueryBoundary>
        )}
      </div>
    </>
  );
}
