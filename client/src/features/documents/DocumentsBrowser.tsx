import { Download, FileText, Search } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DOCUMENT_TYPES, LOCALE_SHORT, type DocumentType, type PublicDocument } from '@uchkoprik/shared';
import { usePublicDocuments } from '../../api/public';
import { QueryBoundary } from '../../components/QueryBoundary';
import { buttonClass } from '../../components/ui/Button';
import { EmptyState, Badge } from '../../components/ui/Feedback';
import { Input, Select } from '../../components/ui/Form';
import { Pagination } from '../../components/ui/Pagination';
import { useDebounced } from '../../hooks/useDebounced';
import { formatDate, formatFileSize, useLocale, useT } from '../../i18n/locale';
import type { DictKey } from '../../i18n/dictionary';

export function DocumentRow({ doc, showType = true, compact = false }: { doc: PublicDocument; showType?: boolean; compact?: boolean }) {
  const locale = useLocale();
  const t = useT();
  return (
    <li className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
      <FileText className="hidden h-10 w-10 shrink-0 text-primary-500 sm:block" aria-hidden />
      <div className="min-w-0 flex-1">
        <h3 className="text-base leading-snug sm:text-lg" lang={doc.isFallback ? doc.locale : undefined}>{doc.title}</h3>
        {doc.description && !compact && <p className="mt-1 text-base text-ink" lang={doc.isFallback ? doc.locale : undefined}>{doc.description}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {showType && <Badge tone="info">{t(`docType_${doc.type}` as DictKey)}</Badge>}
          {doc.number && <span>{t('documentNumber')}: {doc.number}</span>}
          {doc.docDate && <span>{t('documentDate')}: <time dateTime={doc.docDate}>{formatDate(doc.docDate, locale)}</time></span>}
          <span>{doc.file.extension.toUpperCase()}, {formatFileSize(doc.file.size, locale)}</span>
          {doc.isFallback && <Badge>{LOCALE_SHORT[doc.locale]}</Badge>}
        </p>
      </div>
      <a href={doc.downloadUrl} download className={buttonClass(compact ? 'secondary' : 'primary', compact ? 'sm' : 'md', 'shrink-0 max-sm:w-full')}>
        <Download className="h-4 w-4" aria-hidden />
        {t('download')}
        <span className="sr-only">: {doc.title}</span>
      </a>
    </li>
  );
}

interface Props {
  /** Berilsa, faqat shu turdagi hujjatlar ko'rsatiladi va tur filtri yashiriladi */
  fixedTypes?: DocumentType[] | undefined;
}

/** Hujjatlar ro'yxati: qidiruv, tur bo'yicha filtr va sahifalash (holat URLda saqlanadi). */
export function DocumentsBrowser({ fixedTypes }: Props) {
  const locale = useLocale();
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  const debouncedQ = useDebounced(q, 350);
  const type = params.get('type') ?? '';
  const page = Number(params.get('page') ?? 1) || 1;

  const update = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace: true });
  };

  const query = usePublicDocuments({
    locale,
    q: debouncedQ || undefined,
    type: fixedTypes?.length ? fixedTypes.join(',') : type || undefined,
    page,
    pageSize: 10,
  });

  return (
    <section aria-label={t('documentsSection')}>
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <label htmlFor="doc-search" className="sr-only">{t('documentSearch')}</label>
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted" aria-hidden />
          <Input
            id="doc-search"
            type="search"
            value={q}
            placeholder={t('documentSearch')}
            className="pl-10"
            onChange={(e) => {
              setQ(e.target.value);
              update({ page: null, q: e.target.value.trim() || null });
            }}
          />
        </div>
        {!fixedTypes?.length && (
          <div>
            <label htmlFor="doc-type" className="sr-only">{t('allTypes')}</label>
            <Select id="doc-type" value={type} onChange={(e) => update({ type: e.target.value || null, page: null })}>
              <option value="">{t('allTypes')}</option>
              {DOCUMENT_TYPES.map((d) => (
                <option key={d} value={d}>{t(`docType_${d}` as DictKey)}</option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <QueryBoundary query={query}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState title={t('noDocuments')} />
          ) : (
            <>
              <ul className="space-y-3">
                {data.items.map((d) => <DocumentRow key={d.id} doc={d} showType={!fixedTypes?.length || fixedTypes.length > 1} />)}
              </ul>
              <Pagination
                className="mt-6"
                meta={data.meta}
                onPage={(p) => update({ page: p > 1 ? String(p) : null })}
                labels={{ prev: t('prev'), next: t('next'), nav: t('documentsSection'), pageOf: (p, total) => t('pageOf', { page: p, total }) }}
              />
            </>
          )
        }
      </QueryBoundary>
    </section>
  );
}
