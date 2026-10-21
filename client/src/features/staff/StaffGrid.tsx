import { Mail, Phone } from 'lucide-react';
import type { StaffKind } from '@uchkoprik/shared';
import { LOCALE_SHORT } from '@uchkoprik/shared';
import { usePublicStaff } from '../../api/public';
import { QueryBoundary } from '../../components/QueryBoundary';
import { Badge, EmptyState } from '../../components/ui/Feedback';
import { useLocale, useT } from '../../i18n/locale';

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');
}

export function StaffGrid({ kind }: { kind?: StaffKind | undefined }) {
  const locale = useLocale();
  const t = useT();
  const query = usePublicStaff(locale, kind);

  return (
    <section>
      <QueryBoundary query={query}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState title={t('noStaff')} />
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((s) => (
                <li key={s.id} className="flex gap-4 rounded-lg border border-line bg-white p-4 shadow-card" lang={s.isFallback ? s.locale : undefined}>
                  {s.photo ? (
                    <img src={s.photo.thumbUrl ?? s.photo.url} alt={s.photo.alt || s.fullName} loading="lazy" width={96} height={96} className="h-24 w-24 shrink-0 rounded-md object-cover" />
                  ) : (
                    <div aria-hidden className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md bg-primary-50 text-2xl font-semibold text-primary-600">{initials(s.fullName)}</div>
                  )}
                  <div className="min-w-0">
                    <h3 className="text-lg leading-snug">{s.fullName}</h3>
                    {s.position && <p className="text-base text-ink">{s.position}</p>}
                    {s.isFallback && <Badge className="mt-1">{LOCALE_SHORT[s.locale]}</Badge>}
                    <div className="mt-2 space-y-1 text-sm">
                      {s.phone && <p className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted" aria-hidden /><a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}>{s.phone}</a></p>}
                      {s.email && <p className="flex items-center gap-2"><Mail className="h-4 w-4 text-muted" aria-hidden /><a href={`mailto:${s.email}`}>{s.email}</a></p>}
                    </div>
                    {s.bio && <p className="mt-2 text-sm text-muted">{s.bio}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </QueryBoundary>
    </section>
  );
}
