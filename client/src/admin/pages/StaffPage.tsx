import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  LOCALES, STAFF_KINDS, STAFF_KIND_LABELS, staffCreateSchema, staffUpdateSchema,
  type AdminStaff, type Locale, type StaffKind, type StaffTranslationInput,
} from '@uchkoprik/shared';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState, ErrorState, Loading } from '../../components/ui/Feedback';
import { Field, Input, Select, Textarea } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { staffApi } from '../api';
import { DataTable, PageTitle, StatusBadge, Toolbar, TranslationBadges, type Column } from '../components/common';
import { applyIssues, LocaleTabs, serverIssues } from '../components/form-utils';
import { MediaField } from '../components/MediaPicker';
import { RowButtons, errorMessage, useRowActions } from '../components/row-actions';

interface TrForm { fullName: string; position: string; bio: string }
interface FormValues { kind: StaffKind; photoMediaId: string | null; email: string; phone: string; sortOrder: number; translations: Record<Locale, TrForm> }

const toValues = (s: AdminStaff | null): FormValues => ({
  kind: s?.kind ?? 'LEADERSHIP',
  photoMediaId: s?.photo?.id ?? null,
  email: s?.email ?? '',
  phone: s?.phone ?? '',
  sortOrder: s?.sortOrder ?? 0,
  translations: Object.fromEntries(LOCALES.map((l) => [l, { fullName: s?.translations[l]?.fullName ?? '', position: s?.translations[l]?.position ?? '', bio: s?.translations[l]?.bio ?? '' }])) as Record<Locale, TrForm>,
});
const isFilled = (t: TrForm) => Boolean(t.fullName.trim() || t.position.trim() || t.bio.trim());
const toTr = (t: TrForm): StaffTranslationInput => ({ fullName: t.fullName.trim(), position: t.position.trim(), bio: t.bio.trim() });

function StaffModal({ member, defaultKind, onClose }: { member: AdminStaff | null; defaultKind: StaffKind; onClose: () => void }) {
  const toast = useToast();
  const create = staffApi.useCreate();
  const update = staffApi.useUpdate();
  const [locale, setLocale] = useState<Locale>('uz');
  const [errLocales, setErrLocales] = useState<Partial<Record<Locale, boolean>>>({});
  const form = useForm<FormValues>({ defaultValues: member ? toValues(member) : { ...toValues(null), kind: defaultKind } });
  const existing = useMemo(() => new Set(LOCALES.filter((l) => member?.translations[l])), [member]);
  const tr = form.watch('translations');
  useEffect(() => { setLocale('uz'); }, [member]);

  const submit = async () => {
    const v = form.getValues();
    const trs: Record<string, StaffTranslationInput | null> = { uz: toTr(v.translations.uz) };
    for (const l of ['ru', 'en'] as const) {
      if (isFilled(v.translations[l])) trs[l] = toTr(v.translations[l]);
      else if (existing.has(l)) trs[l] = null;
    }
    const base = { kind: v.kind, photoMediaId: v.photoMediaId, email: v.email.trim() || null, phone: v.phone.trim() || null, sortOrder: Number(v.sortOrder) || 0, translations: trs };
    form.clearErrors();
    const parsed = member ? staffUpdateSchema.safeParse(base) : staffCreateSchema.safeParse(base);
    if (!parsed.success) {
      const locs = applyIssues(form, parsed.error.issues);
      setErrLocales(Object.fromEntries([...locs].map((l) => [l, true])));
      if (locs.size && !locs.has(locale)) setLocale([...locs][0]!);
      return;
    }
    try {
      if (member) await update.mutateAsync({ id: member.id, body: base });
      else await create.mutateAsync(base);
      toast.success(member ? 'Xodim ma’lumotlari saqlandi' : 'Xodim qoralama sifatida saqlandi');
      onClose();
    } catch (err) {
      const issues = serverIssues(err);
      if (issues) applyIssues(form, issues);
      toast.error(errorMessage(err));
    }
  };

  const e = form.formState.errors;
  return (
    <Modal open onClose={onClose} size="lg" title={member ? 'Xodimni tahrirlash' : 'Yangi xodim'}
      footer={<><Button variant="secondary" onClick={onClose}>Bekor qilish</Button><Button loading={create.isPending || update.isPending} onClick={() => void submit()}>Saqlash</Button></>}>
      <form onSubmit={(ev) => { ev.preventDefault(); void submit(); }} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Turi"><Select {...form.register('kind')}>{STAFF_KINDS.map((k) => <option key={k} value={k}>{STAFF_KIND_LABELS[k]}</option>)}</Select></Field>
          <Field label="Tartib raqami"><Input type="number" min={0} {...form.register('sortOrder', { valueAsNumber: true })} /></Field>
          <Field label="Elektron pochta" error={e.email?.message}><Input type="email" {...form.register('email')} /></Field>
          <Field label="Telefon" error={e.phone?.message}><Input type="tel" {...form.register('phone')} /></Field>
        </div>
        <Controller control={form.control} name="photoMediaId" render={({ field }) => <MediaField label="Fotosurat" kind="IMAGE" value={field.value} initial={member?.photo} onChange={field.onChange} />} />
        <LocaleTabs active={locale} onChange={setLocale} filled={{ uz: true, ru: isFilled(tr.ru), en: isFilled(tr.en) }} errors={errLocales}>
          {(l) => (
            <div className="space-y-4">
              {l !== 'uz' && !isFilled(tr[l]) && <Alert tone="info">Bu tilda ma’lumot kiritilmagan. Avtomatik tarjima ishlatilmaydi.</Alert>}
              <Field label="F.I.Sh." required={l === 'uz'} error={e.translations?.[l]?.fullName?.message}><Input {...form.register(`translations.${l}.fullName`)} /></Field>
              <Field label="Lavozimi" error={e.translations?.[l]?.position?.message}><Input {...form.register(`translations.${l}.position`)} /></Field>
              <Field label="Qisqa ma’lumot" error={e.translations?.[l]?.bio?.message}><Textarea rows={4} {...form.register(`translations.${l}.bio`)} /></Field>
            </div>
          )}
        </LocaleTabs>
      </form>
    </Modal>
  );
}

export default function StaffPage() {
  const [kind, setKind] = useState<StaffKind | ''>('');
  const query = staffApi.useList<{ items: AdminStaff[] }>({ kind: kind || undefined });
  const actions = useRowActions<AdminStaff>({ action: staffApi.useAction(), remove: staffApi.useRemove(), noun: 'Xodim', title: (r) => r.title });
  const [editing, setEditing] = useState<AdminStaff | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: Column<AdminStaff>[] = [
    {
      header: 'F.I.Sh.',
      cell: (r) => (
        <div className="flex items-center gap-3">
          {r.photo?.thumbUrl ? <img src={r.photo.thumbUrl} alt="" className="h-10 w-10 rounded-full object-cover" /> : <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-600">{r.title.slice(0, 1)}</span>}
          <div>
            <button type="button" className="text-left font-medium text-primary-600 hover:underline" onClick={() => setEditing(r)}>{r.title}</button>
            <p className="text-xs text-muted">{r.translations.uz?.position}</p>
          </div>
        </div>
      ),
    },
    { header: 'Turi', cell: (r) => <span className="text-muted">{STAFF_KIND_LABELS[r.kind]}</span> },
    { header: 'Tillar', cell: (r) => <TranslationBadges status={r.translationStatus} /> },
    { header: 'Holat', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Amallar', cell: (r) => <RowButtons row={r} status={r.status} onEdit={() => setEditing(r)} actions={actions} /> },
  ];

  return (
    <>
      <PageTitle title="Rahbariyat va xodimlar" actions={<Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setCreating(true)}>Yangi xodim</Button>} />
      <Toolbar>
        <div>
          <label htmlFor="staff-kind" className="sr-only">Turi</label>
          <Select id="staff-kind" value={kind} onChange={(e) => setKind(e.target.value as StaffKind | '')} className="min-w-48">
            <option value="">Barcha turlar</option>
            {STAFF_KINDS.map((k) => <option key={k} value={k}>{STAFF_KIND_LABELS[k]}</option>)}
          </Select>
        </div>
      </Toolbar>
      {query.isPending ? <Loading /> : query.isError ? <ErrorState title="Xodimlarni yuklab bo‘lmadi" text={query.error.message} onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? (
        <EmptyState title="Hozircha xodimlar kiritilmagan" text="Rahbariyat va o‘qituvchilar haqida faqat tasdiqlangan ma’lumotlarni kiriting." action={<Button onClick={() => setCreating(true)}>Yangi xodim</Button>} />
      ) : <DataTable columns={columns} rows={query.data.items} rowKey={(r) => r.id} />}
      {(creating || editing) && <StaffModal key={editing?.id ?? 'new'} member={editing} defaultKind={kind || 'LEADERSHIP'} onClose={() => { setCreating(false); setEditing(null); }} />}
      {actions.dialog}
    </>
  );
}
