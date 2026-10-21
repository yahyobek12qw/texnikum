import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { LOCALES, LOCALE_LABELS, changePasswordSchema, isLocale, type Locale, type TranslationOverviewRow } from '@uchkoprik/shared';
import { ApiError } from '../../api/client';
import { AlternatesProvider, LocaleOverrideProvider } from '../../i18n/locale';
import { PageView } from '../../pages/PageView';
import { NewsView } from '../../pages/NewsView';
import { Button } from '../../components/ui/Button';
import { Alert, ErrorState, Loading } from '../../components/ui/Feedback';
import { Field, Input, Select } from '../../components/ui/Form';
import { useToast } from '../../components/ui/Toast';
import { authApi, useAuditLogs, useNewsPreview, usePagePreview, useTranslationOverview } from '../api';
import { Card, ListResult, PageTitle, SearchBox, StatusBadge, Toolbar, TranslationBadges, fmtDate, useListParams, type Column } from '../components/common';

// ───────────── Tarjimalar holati ─────────────

const ENTITY_LABELS: Record<TranslationOverviewRow['entity'], string> = {
  page: 'Sahifalar', news: 'Yangiliklar va e’lonlar', document: 'Hujjatlar', program: 'Ta’lim yo‘nalishlari', staff: 'Xodimlar',
};
const ENTITY_LINK: Record<TranslationOverviewRow['entity'], (id: string) => string> = {
  page: (id) => `/admin/pages/${id}`, news: (id) => `/admin/news/${id}`, document: (id) => `/admin/documents?edit=${id}`,
  program: () => '/admin/programs', staff: () => '/admin/staff',
};

export function TranslationsPage() {
  const p = useListParams({ entity: 'page' });
  const entity = p.get('entity') as TranslationOverviewRow['entity'];
  const query = useTranslationOverview({ entity, missing: p.get('missing') || undefined, page: p.page, pageSize: 25 });

  const columns: Column<TranslationOverviewRow>[] = [
    { header: 'Material', cell: (r) => <Link to={ENTITY_LINK[r.entity](r.id)} className="font-medium">{r.title}</Link> },
    { header: 'Holat', cell: (r) => <StatusBadge status={r.status} /> },
    ...LOCALES.map((l): Column<TranslationOverviewRow> => ({
      header: LOCALE_LABELS[l],
      cell: (r) => (r.translations[l] ? <span className="font-medium text-accent-700">✓ Bor</span> : <span className="text-danger-600">✗ Yo‘q</span>),
    })),
    { header: 'Tillar', cell: (r) => <TranslationBadges status={r.translations} /> },
  ];

  return (
    <>
      <PageTitle title="Uch tilli tarjimalar" />
      <Alert tone="info" className="mb-4">Bu yerda qaysi material qaysi tilda mavjudligi ko‘rinadi. Tarjima bo‘lmagan tilda sayt foydalanuvchiga o‘zbekcha (asl) matnni ko‘rsatadi va bu haqda ogohlantiradi. Tarjimalar avtomatik yaratilmaydi — ularni tegishli material sahifasida kiriting.</Alert>
      <Toolbar>
        <div>
          <label htmlFor="tr-entity" className="sr-only">Bo‘lim</label>
          <Select id="tr-entity" value={entity} onChange={(e) => p.set({ entity: e.target.value })} className="min-w-52">
            {(Object.keys(ENTITY_LABELS) as TranslationOverviewRow['entity'][]).map((k) => <option key={k} value={k}>{ENTITY_LABELS[k]}</option>)}
          </Select>
        </div>
        <div>
          <label htmlFor="tr-missing" className="sr-only">Yetishmayotgan til</label>
          <Select id="tr-missing" value={p.get('missing')} onChange={(e) => p.set({ missing: e.target.value || null })} className="min-w-52">
            <option value="">Barcha materiallar</option>
            {LOCALES.map((l: Locale) => <option key={l} value={l}>{LOCALE_LABELS[l]} tarjimasi yo‘q</option>)}
          </Select>
        </div>
      </Toolbar>
      <ListResult query={query} columns={columns} rowKey={(r) => `${r.entity}-${r.id}`} emptyTitle="Materiallar topilmadi" emptyText="Tanlangan shart bo‘yicha material yo‘q." onPage={(n) => p.set({ page: n > 1 ? String(n) : null }, false)} />
    </>
  );
}

// ───────────── Audit jurnali ─────────────

const ENTITIES = ['page', 'news', 'document', 'media', 'category', 'program', 'staff', 'navigation', 'settings', 'auth', 'user'];

export function AuditPage() {
  const p = useListParams();
  const query = useAuditLogs({ page: p.page, pageSize: 30, entity: p.get('entity') || undefined, action: p.get('action') || undefined, q: p.get('q') || undefined });
  const columns: Column<import('@uchkoprik/shared').AuditLogEntry>[] = [
    { header: 'Vaqt', cell: (r) => <span className="whitespace-nowrap">{fmtDate(r.createdAt, true)}</span> },
    { header: 'Foydalanuvchi', cell: (r) => <span className="text-muted">{r.userEmail ?? 'Tizim'}</span> },
    { header: 'Amal', cell: (r) => <code className="rounded bg-surface px-1.5 py-0.5 text-xs">{r.action}</code> },
    { header: 'Obyekt', cell: (r) => <span className="text-muted">{r.entity}</span> },
    { header: 'Tavsif', cell: (r) => r.summary },
    { header: 'IP', cell: (r) => <span className="text-xs text-muted">{r.ip ?? '—'}</span> },
  ];
  return (
    <>
      <PageTitle title="Audit jurnali" />
      <Toolbar>
        <SearchBox value={p.get('q')} onChange={(v) => p.set({ q: v || null })} placeholder="Tavsif yoki foydalanuvchi bo‘yicha…" />
        <div>
          <label htmlFor="audit-entity" className="sr-only">Obyekt</label>
          <Select id="audit-entity" value={p.get('entity')} onChange={(e) => p.set({ entity: e.target.value || null })} className="min-w-44">
            <option value="">Barcha obyektlar</option>
            {ENTITIES.map((e) => <option key={e} value={e}>{e}</option>)}
          </Select>
        </div>
      </Toolbar>
      <ListResult query={query} columns={columns} rowKey={(r) => r.id} emptyTitle="Jurnal yozuvlari topilmadi" onPage={(n) => p.set({ page: n > 1 ? String(n) : null }, false)} />
    </>
  );
}

// ───────────── Hisob va parol ─────────────

const formSchema = changePasswordSchema.extend({ confirm: z.string() }).refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'Parollar mos kelmadi' });
type PasswordForm = z.infer<typeof formSchema>;

export function AccountPage() {
  const toast = useToast();
  const form = useForm<PasswordForm>({ resolver: zodResolver(formSchema), defaultValues: { currentPassword: '', newPassword: '', confirm: '' } });
  const e = form.formState.errors;

  const onSubmit = form.handleSubmit(async (v) => {
    try {
      await authApi.changePassword(v.currentPassword, v.newPassword);
      toast.success('Parol o‘zgartirildi. Boshqa qurilmalardagi sessiyalar yopildi.');
      form.reset();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'WRONG_PASSWORD') form.setError('currentPassword', { message: err.message });
      else if (err instanceof ApiError && err.code === 'SAME_PASSWORD') form.setError('newPassword', { message: err.message });
      else toast.error(err instanceof ApiError ? err.message : 'Parolni o‘zgartirib bo‘lmadi');
    }
  });

  return (
    <>
      <PageTitle title="Hisob va parol" />
      <div className="max-w-xl">
        <Card title="Parolni almashtirish">
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <Field label="Joriy parol" error={e.currentPassword?.message} required><Input type="password" autoComplete="current-password" {...form.register('currentPassword')} /></Field>
            <Field label="Yangi parol" error={e.newPassword?.message} hint="Kamida 12 belgi, harf va raqam bo‘lishi shart" required><Input type="password" autoComplete="new-password" {...form.register('newPassword')} /></Field>
            <Field label="Yangi parolni takrorlang" error={e.confirm?.message} required><Input type="password" autoComplete="new-password" {...form.register('confirm')} /></Field>
            <Button type="submit" loading={form.formState.isSubmitting}>Parolni o‘zgartirish</Button>
          </form>
        </Card>
      </div>
    </>
  );
}

// ───────────── Oldindan ko'rish ─────────────

function PreviewShell({ children, backTo, locale }: { children: React.ReactNode; backTo: string; locale: Locale }) {
  const [, setParams] = useSearchParams();
  return (
    <div>
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-warn-700 px-4 py-2 text-sm text-white">
        <span>Oldindan ko‘rish rejimi — bu material hali ommaga ko‘rsatilmasligi mumkin.</span>
        <span className="flex items-center gap-2">
          {LOCALES.map((l) => (
            <button key={l} type="button" onClick={() => setParams({ locale: l })} aria-pressed={l === locale} className={`rounded px-2 py-1 font-semibold ${l === locale ? 'bg-white text-warn-700' : 'bg-white/20 text-white'}`}>{l.toUpperCase()}</button>
          ))}
          <Link to={backTo} className="ml-2 rounded bg-white px-2 py-1 font-semibold text-warn-700 no-underline">Tahrirlashga qaytish</Link>
        </span>
      </div>
      {children}
    </div>
  );
}

export function PreviewPage({ kind }: { kind: 'page' | 'news' }) {
  const { id } = useParams();
  const [params] = useSearchParams();
  const raw = params.get('locale');
  const locale: Locale = isLocale(raw) ? raw : 'uz';
  const pageQ = usePagePreview(kind === 'page' ? id : undefined, locale);
  const newsQ = useNewsPreview(kind === 'news' ? id : undefined, locale);
  const q = kind === 'page' ? pageQ : newsQ;

  return (
    <AlternatesProvider>
      <PreviewShell backTo={kind === 'page' ? `/admin/pages/${id}` : `/admin/news/${id}`} locale={locale}>
        <LocaleOverrideProvider value={locale}>
          {q.isPending ? <Loading /> : q.isError ? (
            <div className="container-page py-10"><ErrorState title="Oldindan ko‘rib bo‘lmadi" text={q.error instanceof ApiError && q.error.code === 'NO_TRANSLATION' ? 'Bu tilda matn mavjud emas.' : q.error.message} /></div>
          ) : kind === 'page' && pageQ.data ? <PageView page={pageQ.data} /> : newsQ.data ? <NewsView item={newsQ.data} /> : null}
        </LocaleOverrideProvider>
      </PreviewShell>
    </AlternatesProvider>
  );
}
