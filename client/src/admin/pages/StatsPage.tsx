import { Download } from 'lucide-react';
import { useState } from 'react';
import { Alert, ErrorState, Loading } from '../../components/ui/Feedback';
import { Select } from '../../components/ui/Form';
import { buttonClass } from '../../components/ui/Button';
import { cn } from '../../components/ui/cn';
import { useAdminStats } from '../api';
import { useCan } from '../auth';
import { Card, PageTitle } from '../components/common';

function Tile({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4 shadow-card sm:p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-primary-800">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted sm:text-sm">{hint}</p>}
    </div>
  );
}

/** Soddalashtirilgan ustunli diagramma (kutubxonasiz). Pastda jadval ko'rinishi ham bor (ekran o'qish dasturlari uchun). */
function Bars({ data }: { data: { day: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div>
      <div role="img" aria-label={`Kunlik ko‘rishlar diagrammasi, eng ko‘pi ${max}`} className="flex h-40 items-end gap-px sm:gap-0.5">
        {data.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end" title={`${d.day}: ${d.count}`}>
            <div className={cn('w-full rounded-t-sm', d.count > 0 ? 'bg-accent-600 group-hover:bg-accent-700' : 'bg-line')} style={{ height: `${Math.max(d.count > 0 ? 4 : 1.5, (d.count / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted"><span>{data[0]?.day}</span><span>{data.at(-1)?.day}</span></div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-primary-700">Jadval ko‘rinishi</summary>
        <div className="mt-2 max-h-56 overflow-auto">
          <table className="w-full text-left"><thead><tr><th className="py-1 pr-4">Sana</th><th className="py-1">Ko‘rishlar</th></tr></thead>
            <tbody>{data.slice().reverse().map((d) => <tr key={d.day} className="border-t border-line"><td className="py-1 pr-4">{d.day}</td><td className="py-1">{d.count}</td></tr>)}</tbody></table>
        </div>
      </details>
    </div>
  );
}

export default function StatsPage() {
  const [days, setDays] = useState(30);
  const q = useAdminStats(days);
  const canExport = useCan('reports.export');

  return (
    <>
      <PageTitle title="Statistika va hisobotlar" />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div>
          <label htmlFor="stats-days" className="sr-only">Davr</label>
          <Select id="stats-days" value={days} onChange={(e) => setDays(Number(e.target.value))} className="min-w-44">
            <option value={7}>So‘nggi 7 kun</option>
            <option value={30}>So‘nggi 30 kun</option>
            <option value={90}>So‘nggi 90 kun</option>
            <option value={365}>So‘nggi 365 kun</option>
          </Select>
        </div>
        {canExport && (
          <div className="flex flex-wrap gap-2">
            <a href={`/api/v1/admin/reports/views.csv?days=${days}`} className={buttonClass('secondary', 'md')}><Download className="h-4 w-4" aria-hidden />Ko‘rishlar hisoboti (CSV)</a>
            <a href="/api/v1/admin/reports/content.csv" className={buttonClass('secondary', 'md')}><Download className="h-4 w-4" aria-hidden />Kontent ro‘yxati (CSV)</a>
          </div>
        )}
      </div>

      {q.isPending ? <Loading label="Statistika yuklanmoqda…" /> : q.isError ? <ErrorState title="Statistikani yuklab bo‘lmadi" text={q.error.message} onRetry={() => void q.refetch()} /> : (
        <div className="space-y-6">
          <section aria-label="Ko‘rishlar" className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <Tile label="Jami ko‘rishlar" value={q.data.totals.views} hint={`So‘nggi ${q.data.days} kun`} />
            <Tile label="Faol kunlar" value={q.data.totals.activeDays} hint={`${q.data.days} kundan`} />
            <Tile label="Kuniga o‘rtacha" value={q.data.totals.averagePerDay} />
          </section>
          <Alert tone="info">{q.data.note}</Alert>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <Card title="Kunlik ko‘rishlar"><Bars data={q.data.daily} /></Card>
            <Card title="Eng ko‘p ko‘rilgan sahifalar">
              {q.data.topPaths.length === 0 ? <p className="text-sm text-muted">Hozircha ma’lumot yo‘q: ko‘rishlar sayt ochilganda to‘planadi.</p> : (
                <ol className="space-y-2 text-sm">
                  {q.data.topPaths.map((p, i) => (
                    <li key={p.path} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate"><span className="mr-2 text-muted">{i + 1}.</span><a href={p.path} target="_blank" rel="noopener noreferrer">{p.path}</a></span>
                      <span className="font-semibold tabular-nums">{p.count}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </div>

          <Card title="Saytdagi kontent (nashr qilingan)">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
              {([
                ['Sahifalar', q.data.content.pages], ['Yangiliklar', q.data.content.news], ['E’lonlar', q.data.content.announcements], ['Tadbirlar', q.data.content.events],
                ['Hujjatlar', q.data.content.documents], ['Videolar', q.data.content.videos], ['Galereya rasmlari', q.data.content.photos], ['Yo‘nalishlar', q.data.content.programs],
                ['Xodimlar', q.data.content.staff], ['Bitiruvchilar', q.data.content.alumni], ['Hamkorlar', q.data.content.partners], ['Media fayllar (hammasi)', q.data.content.media],
                ['Faol foydalanuvchilar', q.data.content.users],
              ] as [string, number][]).map(([label, value]) => (
                <div key={label}><dt className="text-muted">{label}</dt><dd className="text-xl font-semibold text-primary-800">{value}</dd></div>
              ))}
            </dl>
          </Card>
        </div>
      )}
    </>
  );
}
