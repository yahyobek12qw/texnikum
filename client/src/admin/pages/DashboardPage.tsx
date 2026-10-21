import { FileText, Images, Library, Newspaper, Plus, Upload } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { buttonClass } from '../../components/ui/Button';
import { EmptyState, ErrorState, Loading } from '../../components/ui/Feedback';
import { cn } from '../../components/ui/cn';
import { useDashboard } from '../api';
import { Card, PageTitle, StatusBadge, fmtDate } from '../components/common';

function Stat({ label, value, hint, to, tone = 'default' }: { label: string; value: number; hint?: string; to: string; tone?: 'default' | 'warn' }) {
  return (
    <Link to={to} className="group rounded-lg border border-line bg-white p-4 no-underline shadow-card transition hover:border-primary-500 sm:p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className={cn('mt-1 text-3xl font-semibold', tone === 'warn' && value > 0 ? 'text-warn-700' : 'text-primary-800')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-muted sm:text-sm">{hint}</p>}
    </Link>
  );
}

function QuickAction({ to, icon, children }: { to: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Link to={to} className={buttonClass('secondary', 'md', 'justify-start')}>
      <span className="text-accent-600" aria-hidden>{icon}</span>
      {children}
    </Link>
  );
}

const TYPE_LABEL: Record<string, string> = { page: 'Sahifa', news: 'Yangilik', document: 'Hujjat' };
const TYPE_LINK: Record<string, string> = { page: '/admin/pages/', news: '/admin/news/', document: '/admin/documents?edit=' };

export default function DashboardPage() {
  const q = useDashboard();
  return (
    <>
      <PageTitle title="Dashboard" crumbs={[]} />
      <section aria-label="Tezkor amallar" className="mb-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <QuickAction to="/admin/news/new?type=NEWS" icon={<Newspaper className="h-5 w-5" />}>Yangilik yozish</QuickAction>
        <QuickAction to="/admin/pages/new" icon={<FileText className="h-5 w-5" />}>Yangi sahifa</QuickAction>
        <QuickAction to="/admin/documents" icon={<Library className="h-5 w-5" />}>Hujjat yuklash</QuickAction>
        <QuickAction to="/admin/media" icon={<Upload className="h-5 w-5" />}>Rasm yuklash</QuickAction>
      </section>
      {q.isPending ? <Loading label="Statistika yuklanmoqda…" /> : q.isError ? (
        <ErrorState title="Statistikani yuklab bo‘lmadi" text={q.error.message} onRetry={() => void q.refetch()} />
      ) : (
        <div className="space-y-6">
          <section aria-label="Statistika" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
            <Stat to="/admin/pages" label="Sahifalar" value={q.data.pages.total} hint={`Arxivda: ${q.data.pages.archived}`} />
            <Stat to="/admin/pages?status=PUBLISHED" label="Nashr qilingan sahifalar" value={q.data.pages.published} />
            <Stat to="/admin/pages?status=DRAFT" label="Qoralamadagi sahifalar" value={q.data.pages.draft} tone="warn" />
            <Stat to="/admin/news" label="Yangiliklar" value={q.data.news.total} hint={`Nashr: ${q.data.news.published} · qoralama: ${q.data.news.draft}`} />
            <Stat to="/admin/documents" label="Hujjatlar" value={q.data.documents.total} hint={`Nashr qilingan: ${q.data.documents.published}`} />
            <Stat to="/admin/media" label="Media fayllar" value={q.data.media.total} />
          </section>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card title="Oxirgi tahrirlangan materiallar">
              {q.data.recentContent.length === 0 ? (
                <EmptyState title="Hozircha materiallar mavjud emas" action={<Link to="/admin/pages/new" className={buttonClass('primary')}><Plus className="h-4 w-4" aria-hidden />Birinchi sahifani yaratish</Link>} />
              ) : (
                <ul className="divide-y divide-line">
                  {q.data.recentContent.map((r) => (
                    <li key={`${r.type}-${r.id}`} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <Link to={`${TYPE_LINK[r.type] ?? '/admin/'}${r.id}`} className="block truncate font-medium">{r.title}</Link>
                        <p className="text-xs text-muted sm:text-sm">{TYPE_LABEL[r.type] ?? r.type} · {fmtDate(r.updatedAt, true)}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card title="Oxirgi administrator harakatlari" actions={<Link to="/admin/audit" className="text-sm font-medium">Hammasi →</Link>}>
              {q.data.recentActions.length === 0 ? <EmptyState title="Harakatlar hali qayd etilmagan" /> : (
                <ul className="divide-y divide-line">
                  {q.data.recentActions.map((a) => (
                    <li key={a.id} className="py-2.5">
                      <p className="text-sm font-medium">{a.summary}</p>
                      <p className="text-xs text-muted">{a.userEmail ?? 'Tizim'} · {fmtDate(a.createdAt, true)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
          <p className="flex items-center gap-2 text-sm text-muted"><Images className="h-4 w-4" aria-hidden />Saytdagi bo‘sh bo‘limlar “hali kiritilmagan” deb ko‘rsatiladi: tegishli bo‘limga ma’lumot kiriting.</p>
        </div>
      )}
    </>
  );
}
