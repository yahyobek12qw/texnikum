import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LOCALE_SHORT, type PublicProgram } from '@uchkoprik/shared';
import { usePublicPrograms } from '../../api/public';
import { QueryBoundary } from '../../components/QueryBoundary';
import { RichContent, isEmptyHtml } from '../../components/RichContent';
import { Badge, EmptyState } from '../../components/ui/Feedback';
import { cn } from '../../components/ui/cn';
import { useLocale, useT } from '../../i18n/locale';

function ProgramCard({ program, defaultOpen }: { program: PublicProgram; defaultOpen: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(defaultOpen);
  const hasDetails = !isEmptyHtml(program.description);
  return (
    <li id={program.id} className="scroll-mt-24 rounded-lg border border-line bg-white shadow-card" lang={program.isFallback ? program.locale : undefined}>
      <div className="p-5">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {program.code && <Badge tone="info">{t('specialtyCode')}: {program.code}</Badge>}
          {program.isFallback && <Badge>{LOCALE_SHORT[program.locale]}</Badge>}
        </div>
        <h3 className="mt-2 text-xl">{program.title}</h3>
        {program.summary && <p className="mt-1 text-base text-ink">{program.summary}</p>}
        {(program.duration || program.qualification) && (
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-1 text-sm">
            {program.duration && <div><dt className="inline text-muted">{t('duration')}: </dt><dd className="inline font-medium">{program.duration}</dd></div>}
            {program.qualification && <div><dt className="inline text-muted">{t('qualification')}: </dt><dd className="inline font-medium">{program.qualification}</dd></div>}
          </dl>
        )}
        {hasDetails && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={`${program.id}-details`}
            onClick={() => setOpen((v) => !v)}
            className="mt-3 inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-primary-700"
          >
            {t('readMore')}
            <ChevronDown className={cn('h-4 w-4 transition-transform', open && 'rotate-180')} aria-hidden />
          </button>
        )}
      </div>
      {hasDetails && open && (
        <div id={`${program.id}-details`} className="border-t border-line bg-surface/50 p-5">
          <RichContent html={program.description} />
        </div>
      )}
    </li>
  );
}

export function ProgramsList({ limit }: { limit?: number }) {
  const locale = useLocale();
  const t = useT();
  const query = usePublicPrograms(locale);
  const [hash, setHash] = useState(typeof window === 'undefined' ? '' : window.location.hash.slice(1));
  useEffect(() => {
    const onHash = () => setHash(window.location.hash.slice(1));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <QueryBoundary query={query}>
      {(data) => {
        const items = limit ? data.items.slice(0, limit) : data.items;
        if (items.length === 0) return <EmptyState title={t('noPrograms')} />;
        return (
          <ul className="grid gap-5 lg:grid-cols-2">
            {items.map((p) => <ProgramCard key={p.id} program={p} defaultOpen={hash === p.id} />)}
          </ul>
        );
      }}
    </QueryBoundary>
  );
}
