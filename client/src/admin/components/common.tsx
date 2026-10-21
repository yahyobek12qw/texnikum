import { Search } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CONTENT_STATUSES, LOCALES, LOCALE_SHORT, STATUS_LABELS, type ContentStatus, type Locale, type PaginationMeta, type TranslationStatus } from '@uchkoprik/shared';
import { ErrorState, Badge, EmptyState, Loading } from '../../components/ui/Feedback';
import { Input, Select } from '../../components/ui/Form';
import { Pagination } from '../../components/ui/Pagination';
import { cn } from '../../components/ui/cn';
import { useDebounced } from '../../hooks/useDebounced';
import { formatAdminDate } from '../../utils/date';
import type { UseQueryResult } from '@tanstack/react-query';

// ───────────── Sarlavha + breadcrumbs ─────────────

export function PageTitle({ title, crumbs = [], actions }: { title: string; crumbs?: { label: string; to?: string }[]; actions?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} — Boshqaruv paneli`;
  }, [title]);
  return (
    <div className="mb-6">
      <nav aria-label="Sahifa yo‘li" className="mb-1 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li><Link to="/admin" className="text-muted hover:underline">Boshqaruv</Link></li>
          {crumbs.map((c) => (
            <li key={c.label} className="flex items-center gap-1">
              <span aria-hidden>/</span>
              {c.to ? <Link to={c.to} className="text-muted hover:underline">{c.label}</Link> : <span>{c.label}</span>}
            </li>
          ))}
          <li className="flex items-center gap-1" aria-current="page"><span aria-hidden>/</span><span className="text-ink">{title}</span></li>
        </ol>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl sm:text-3xl">{title}</h1>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ title, children, className, actions }: { title?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <section className={cn('min-w-0 rounded-lg border border-line bg-white shadow-card', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          {title && <h2 className="text-lg">{title}</h2>}
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

// ───────────── Belgilar ─────────────

export function StatusBadge({ status, scheduledAt }: { status: ContentStatus; scheduledAt?: string | null }) {
  if (status === 'DRAFT' && scheduledAt) {
    return <Badge tone="info">Rejalashtirilgan: {formatAdminDate(scheduledAt, true)}</Badge>;
  }
  const tone = status === 'PUBLISHED' ? 'success' : status === 'DRAFT' ? 'warn' : 'neutral';
  return <Badge tone={tone}>{STATUS_LABELS[status]}</Badge>;
}

export function TranslationBadges({ status }: { status: TranslationStatus }) {
  return (
    <span className="inline-flex flex-nowrap gap-1" aria-label={LOCALES.map((l) => `${LOCALE_SHORT[l]}: ${status[l] ? 'bor' : 'yo‘q'}`).join(', ')}>
      {LOCALES.map((l) => (
        <span
          key={l}
          aria-hidden
          className={cn('whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-semibold', status[l] ? 'bg-accent-100 text-accent-700' : 'bg-surface text-muted line-through')}
        >
          {LOCALE_SHORT[l]}
        </span>
      ))}
    </span>
  );
}

// ───────────── Jadval ─────────────

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({ columns, rows, rowKey }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string }) {
  const first = columns[0]!;
  const actions = columns.find((c) => c.header === 'Amallar');
  const middle = columns.slice(1).filter((c) => c !== actions);
  return (
    <>
      {/* Keng ekran: jadval */}
      <div className="hidden overflow-x-auto rounded-lg border border-line bg-white shadow-card md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
            <tr>{columns.map((c) => <th key={c.header} scope="col" className={cn('whitespace-nowrap px-4 py-3 font-semibold', c.className)}>{c.header}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={rowKey(r)} className="hover:bg-surface/60">
                {columns.map((c) => <td key={c.header} className={cn('px-4 py-3 align-middle', c.header === 'Amallar' && 'whitespace-nowrap', c.className)}>{c.cell(r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Tor ekran: kartochkalar (jadval o'qib bo'lmaydigan darajada siqilmasligi uchun) */}
      <ul className="space-y-3 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)} className="rounded-lg border border-line bg-white p-4 shadow-card">
            <div className="font-medium">{first.cell(r)}</div>
            <dl className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
              {middle.map((c) => (
                <div key={c.header} className="contents">
                  <dt className="text-muted">{c.header}</dt>
                  <dd>{c.cell(r)}</dd>
                </div>
              ))}
            </dl>
            {actions && <div className="mt-4 overflow-x-auto border-t border-line pt-3">{actions.cell(r)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Ro'yxat so'rovi holatlari (yuklanmoqda / xatolik / bo'sh) va sahifalash bilan jadval. */
export function ListResult<T>({
  query, columns, rowKey, emptyTitle, emptyText, onPage, emptyAction,
}: {
  query: UseQueryResult<{ items: T[]; meta: PaginationMeta }>;
  columns: Column<T>[];
  rowKey: (row: T) => string;
  emptyTitle: string;
  emptyText?: string;
  emptyAction?: ReactNode;
  onPage: (p: number) => void;
}) {
  if (query.isPending) return <Loading label="Ma’lumotlar yuklanmoqda…" />;
  if (query.isError) return <ErrorState title="Ma’lumotlarni yuklab bo‘lmadi" text={query.error.message} retryLabel="Qayta urinish" onRetry={() => void query.refetch()} />;
  const { items, meta } = query.data;
  if (items.length === 0) return <EmptyState title={emptyTitle} text={emptyText} action={emptyAction} />;
  return (
    <div className={cn(query.isPlaceholderData && 'opacity-60 transition-opacity')} aria-busy={query.isPlaceholderData}>
      <DataTable columns={columns} rows={items} rowKey={rowKey} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <p>Jami: <strong className="text-ink">{meta.total}</strong></p>
        <Pagination meta={meta} onPage={onPage} />
      </div>
    </div>
  );
}

// ───────────── URL holati bilan filtrlar ─────────────

export function useListParams(defaults: Record<string, string> = {}) {
  const [params, setParams] = useSearchParams();
  const get = (k: string) => params.get(k) ?? defaults[k] ?? '';
  const set = (patch: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    if (resetPage && !('page' in patch)) next.delete('page');
    setParams(next, { replace: true });
  };
  return { get, set, page: Number(params.get('page') ?? 1) || 1 };
}

export function SearchBox({ value, onChange, placeholder = 'Qidirish…' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [local, setLocal] = useState(value);
  const debounced = useDebounced(local, 350);
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
  }, [debounced]);
  return (
    <div className="relative min-w-0 flex-1 sm:min-w-52">
      <label htmlFor="admin-search" className="sr-only">{placeholder}</label>
      <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-muted" aria-hidden />
      <Input id="admin-search" type="search" className="pl-10" value={local} placeholder={placeholder} onChange={(e) => setLocal(e.target.value)} />
    </div>
  );
}

export function StatusFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor="status-filter" className="sr-only">Holat</label>
      <Select id="status-filter" value={value} onChange={(e) => onChange(e.target.value)} className="min-w-44">
        <option value="">Barcha holatlar</option>
        {CONTENT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
      </Select>
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid gap-3 sm:flex sm:flex-wrap sm:items-center">{children}</div>;
}

export const fmtDate = formatAdminDate;

export function localeLabel(l: Locale) {
  return LOCALE_SHORT[l];
}

/** Tor ekranda saqlash tugmalari doim ko'rinib turishi uchun pastki panel (xl dan keyin yon ustundagi blok ishlatiladi). */
export function MobileSaveBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-white/95 p-3 shadow-[0_-4px_12px_rgb(16_24_40/0.08)] backdrop-blur xl:hidden">{children}</div>
  );
}
