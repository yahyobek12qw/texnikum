import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@uchkoprik/shared';
import { cn } from './cn';

interface Props {
  meta: PaginationMeta;
  onPage: (page: number) => void;
  labels?: { prev: string; next: string; nav: string; pageOf: (page: number, total: number) => string };
  className?: string;
}

const defaultLabels = {
  prev: 'Oldingi',
  next: 'Keyingi',
  nav: 'Sahifalash',
  pageOf: (page: number, total: number) => `${page}-sahifa, jami ${total}`,
};

function pageList(page: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, 2, total - 1, total, page - 1, page, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  nums.forEach((n, i) => {
    const prev = nums[i - 1];
    if (i > 0 && prev !== undefined && n - prev > 1) out.push('…');
    out.push(n);
  });
  return out;
}

export function Pagination({ meta, onPage, labels = defaultLabels, className }: Props) {
  if (meta.totalPages <= 1) return null;
  const item = 'inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border px-3 text-sm font-medium';
  return (
    <nav aria-label={labels.nav} className={cn('flex flex-wrap items-center justify-center gap-1.5', className)}>
      <button type="button" className={cn(item, 'border-line bg-white hover:bg-surface disabled:opacity-50')} disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        <ChevronLeft className="h-4 w-4" aria-hidden />
        <span className="ml-1 hidden sm:inline">{labels.prev}</span>
        <span className="sr-only sm:hidden">{labels.prev}</span>
      </button>
      {pageList(meta.page, meta.totalPages).map((p, i) =>
        p === '…' ? (
          <span key={`gap-${i}`} className="px-1 text-muted" aria-hidden>…</span>
        ) : (
          <button
            key={p}
            type="button"
            aria-current={p === meta.page ? 'page' : undefined}
            aria-label={labels.pageOf(p, meta.totalPages)}
            onClick={() => onPage(p)}
            className={cn(item, p === meta.page ? 'border-primary-700 bg-primary-700 text-white' : 'border-line bg-white hover:bg-surface')}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className={cn(item, 'border-line bg-white hover:bg-surface disabled:opacity-50')} disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)}>
        <span className="mr-1 hidden sm:inline">{labels.next}</span>
        <span className="sr-only sm:hidden">{labels.next}</span>
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </nav>
  );
}
