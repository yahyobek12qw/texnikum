import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { LOCALES, programCreateSchema, programUpdateSchema, type AdminProgram, type Locale, type ProgramTranslationInput } from '@uchkoprik/shared';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState, ErrorState, Loading } from '../../components/ui/Feedback';
import { Field, Input, Textarea } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { programsApi } from '../api';
import { DataTable, PageTitle, StatusBadge, TranslationBadges, type Column } from '../components/common';
import { applyIssues, LocaleTabs, serverIssues } from '../components/form-utils';
import { RichTextEditor } from '../components/RichTextEditor';
import { RowButtons, errorMessage, useRowActions } from '../components/row-actions';

interface TrForm { title: string; summary: string; description: string; duration: string; qualification: string }
interface FormValues { code: string; sortOrder: number; translations: Record<Locale, TrForm> }

const emptyTr = (): TrForm => ({ title: '', summary: '', description: '', duration: '', qualification: '' });
const toValues = (p: AdminProgram | null): FormValues => ({
  code: p?.code ?? '',
  sortOrder: p?.sortOrder ?? 0,
  translations: Object.fromEntries(LOCALES.map((l) => [l, p?.translations[l] ? { ...p.translations[l]! } : emptyTr()])) as Record<Locale, TrForm>,
});
const isFilled = (t: TrForm) => Boolean(t.title.trim() || t.summary.trim() || t.duration.trim() || t.qualification.trim() || t.description.replace(/<[^>]*>/g, '').trim());
const toTr = (t: TrForm): ProgramTranslationInput => ({ title: t.title.trim(), summary: t.summary.trim(), description: t.description, duration: t.duration.trim(), qualification: t.qualification.trim() });

function ProgramModal({ program, open, onClose }: { program: AdminProgram | null; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const create = programsApi.useCreate();
  const update = programsApi.useUpdate();
  const [locale, setLocale] = useState<Locale>('uz');
  const [errLocales, setErrLocales] = useState<Partial<Record<Locale, boolean>>>({});
  const form = useForm<FormValues>({ defaultValues: toValues(program) });
  const existing = useMemo(() => new Set(LOCALES.filter((l) => program?.translations[l])), [program]);
  const tr = form.watch('translations');

  useEffect(() => { if (open) { form.reset(toValues(program)); setLocale('uz'); setErrLocales({}); } }, [open, program, form]);

  const submit = async () => {
    const v = form.getValues();
    const trs: Record<string, ProgramTranslationInput | null> = { uz: toTr(v.translations.uz) };
    for (const l of ['ru', 'en'] as const) {
      if (isFilled(v.translations[l])) trs[l] = toTr(v.translations[l]);
      else if (existing.has(l)) trs[l] = null;
    }
    const base = { code: v.code.trim() || null, sortOrder: Number(v.sortOrder) || 0, translations: trs };
    form.clearErrors();
    const parsed = program ? programUpdateSchema.safeParse(base) : programCreateSchema.safeParse(base);
    if (!parsed.success) {
      const locs = applyIssues(form, parsed.error.issues);
      setErrLocales(Object.fromEntries([...locs].map((l) => [l, true])));
      if (locs.size && !locs.has(locale)) setLocale([...locs][0]!);
      return;
    }
    try {
      if (program) await update.mutateAsync({ id: program.id, body: base });
      else await create.mutateAsync(base);
      toast.success(program ? 'Yo‘nalish saqlandi' : 'Yo‘nalish qoralama sifatida saqlandi');
      onClose();
    } catch (err) {
      const issues = serverIssues(err);
      if (issues) applyIssues(form, issues);
      toast.error(errorMessage(err));
    }
  };

  const e = form.formState.errors;
  return (
    <Modal open={open} onClose={onClose} size="xl" title={program ? 'Yo‘nalishni tahrirlash' : 'Yangi ta’lim yo‘nalishi'}
      footer={<><Button variant="secondary" onClick={onClose}>Bekor qilish</Button><Button loading={create.isPending || update.isPending} onClick={() => void submit()}>Saqlash</Button></>}>
      <form onSubmit={(ev) => { ev.preventDefault(); void submit(); }} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mutaxassislik kodi" error={e.code?.message}><Input {...form.register('code')} /></Field>
          <Field label="Tartib raqami"><Input type="number" min={0} {...form.register('sortOrder', { valueAsNumber: true })} /></Field>
        </div>
        <LocaleTabs active={locale} onChange={setLocale} filled={{ uz: true, ru: isFilled(tr.ru), en: isFilled(tr.en) }} errors={errLocales}>
          {(l) => (
            <div className="space-y-4">
              {l !== 'uz' && !isFilled(tr[l]) && <Alert tone="info">Bu tilda ma’lumot kiritilmagan. Avtomatik tarjima ishlatilmaydi.</Alert>}
              <Field label="Nomi" required={l === 'uz'} error={e.translations?.[l]?.title?.message}><Input {...form.register(`translations.${l}.title`)} /></Field>
              <Field label="Qisqa tavsif" error={e.translations?.[l]?.summary?.message}><Textarea rows={2} {...form.register(`translations.${l}.summary`)} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="O‘qish davomiyligi" error={e.translations?.[l]?.duration?.message}><Input {...form.register(`translations.${l}.duration`)} /></Field>
                <Field label="Malaka" error={e.translations?.[l]?.qualification?.message}><Input {...form.register(`translations.${l}.qualification`)} /></Field>
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Batafsil tavsif</p>
                <Controller control={form.control} name={`translations.${l}.description`} render={({ field }) => <RichTextEditor key={l} value={field.value} onChange={field.onChange} label={`Batafsil tavsif (${l})`} />} />
              </div>
            </div>
          )}
        </LocaleTabs>
      </form>
    </Modal>
  );
}

export default function ProgramsPage() {
  const query = programsApi.useList<{ items: AdminProgram[] }>({});
  const actions = useRowActions<AdminProgram>({ action: programsApi.useAction(), remove: programsApi.useRemove(), noun: 'Yo‘nalish', title: (r) => r.title });
  const [editing, setEditing] = useState<AdminProgram | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: Column<AdminProgram>[] = [
    { header: 'Nomi', cell: (r) => <div><button type="button" className="text-left font-medium text-primary-600 hover:underline" onClick={() => setEditing(r)}>{r.title}</button>{r.code && <p className="text-xs text-muted">Kod: {r.code}</p>}</div> },
    { header: 'Tillar', cell: (r) => <TranslationBadges status={r.translationStatus} /> },
    { header: 'Holat', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Tartib', cell: (r) => <span className="text-muted">{r.sortOrder}</span> },
    { header: 'Amallar', cell: (r) => <RowButtons row={r} status={r.status} onEdit={() => setEditing(r)} actions={actions} /> },
  ];

  return (
    <>
      <PageTitle title="Ta’lim yo‘nalishlari" actions={<Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setCreating(true)}>Yangi yo‘nalish</Button>} />
      {query.isPending ? <Loading /> : query.isError ? <ErrorState title="Yo‘nalishlarni yuklab bo‘lmadi" text={query.error.message} onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? (
        <EmptyState title="Hozircha ta’lim yo‘nalishlari kiritilmagan" text="Faqat haqiqiy, tasdiqlangan ma’lumotlarni kiriting." action={<Button onClick={() => setCreating(true)}>Yangi yo‘nalish</Button>} />
      ) : <DataTable columns={columns} rows={query.data.items} rowKey={(r) => r.id} />}
      {(creating || editing) && <ProgramModal key={editing?.id ?? 'new'} program={editing} open onClose={() => { setCreating(false); setEditing(null); }} />}
      {actions.dialog}
    </>
  );
}

