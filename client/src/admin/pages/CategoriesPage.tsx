import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  CATEGORY_SCOPES, CATEGORY_SCOPE_LABELS, LOCALES, categoryCreateSchema, categoryUpdateSchema, slugify,
  type AdminCategory, type CategoryTranslationInput, type Locale,
} from '@uchkoprik/shared';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, Loading } from '../../components/ui/Feedback';
import { Field, Input, Select } from '../../components/ui/Form';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { categoriesApi } from '../api';
import { useCan } from '../auth';
import { DataTable, PageTitle, TranslationBadges, type Column } from '../components/common';
import { applyIssues, LocaleTabs, serverIssues } from '../components/form-utils';
import { IconButton, errorMessage } from '../components/row-actions';

interface TrForm { name: string; slug: string }
interface FormValues { scope: 'NEWS' | 'DOCUMENT'; sortOrder: number; translations: Record<Locale, TrForm> }

const toValues = (c: AdminCategory | null): FormValues => ({
  scope: c?.scope ?? 'NEWS',
  sortOrder: c?.sortOrder ?? 0,
  translations: Object.fromEntries(LOCALES.map((l) => [l, { name: c?.translations[l]?.name ?? '', slug: c?.translations[l]?.slug ?? '' }])) as Record<Locale, TrForm>,
});
const isFilled = (t: TrForm) => Boolean(t.name.trim() || t.slug.trim());

function CategoryModal({ cat, open, onClose }: { cat: AdminCategory | null; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const create = categoriesApi.useCreate();
  const update = categoriesApi.useUpdate();
  const [locale, setLocale] = useState<Locale>('uz');
  const [errLocales, setErrLocales] = useState<Partial<Record<Locale, boolean>>>({});
  const form = useForm<FormValues>({ defaultValues: toValues(cat) });
  const existing = useMemo(() => new Set(LOCALES.filter((l) => cat?.translations[l])), [cat]);
  const tr = form.watch('translations');

  useEffect(() => {
    if (open) { form.reset(toValues(cat)); setLocale('uz'); setErrLocales({}); }
  }, [open, cat, form]);

  const submit = async () => {
    const v = form.getValues();
    const trs: Record<string, CategoryTranslationInput | null> = { uz: { name: v.translations.uz.name.trim(), slug: v.translations.uz.slug.trim() } };
    for (const l of ['ru', 'en'] as const) {
      if (isFilled(v.translations[l])) trs[l] = { name: v.translations[l].name.trim(), slug: v.translations[l].slug.trim() };
      else if (existing.has(l)) trs[l] = null;
    }
    const sortOrder = Number(v.sortOrder) || 0;
    form.clearErrors();
    const parsed = cat ? categoryUpdateSchema.safeParse({ sortOrder, translations: trs }) : categoryCreateSchema.safeParse({ scope: v.scope, sortOrder, translations: trs });
    if (!parsed.success) {
      const locs = applyIssues(form, parsed.error.issues);
      setErrLocales(Object.fromEntries([...locs].map((l) => [l, true])));
      if (locs.size && !locs.has(locale)) setLocale([...locs][0]!);
      return;
    }
    try {
      if (cat) await update.mutateAsync({ id: cat.id, body: { sortOrder, translations: trs } });
      else await create.mutateAsync({ scope: v.scope, sortOrder, translations: trs });
      toast.success('Kategoriya saqlandi');
      onClose();
    } catch (err) {
      const issues = serverIssues(err);
      if (issues) applyIssues(form, issues);
      else if (/slug/i.test(errorMessage(err))) form.setError(`translations.${locale}.slug`, { message: errorMessage(err) });
      toast.error(errorMessage(err));
    }
  };

  const e = form.formState.errors;
  return (
    <Modal open={open} onClose={onClose} title={cat ? 'Kategoriyani tahrirlash' : 'Yangi kategoriya'}
      footer={<><Button variant="secondary" onClick={onClose}>Bekor qilish</Button><Button loading={create.isPending || update.isPending} onClick={() => void submit()}>Saqlash</Button></>}>
      <form onSubmit={(ev) => { ev.preventDefault(); void submit(); }} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Qaysi bo‘lim uchun">
            <Select disabled={Boolean(cat)} {...form.register('scope')}>{CATEGORY_SCOPES.map((s) => <option key={s} value={s}>{CATEGORY_SCOPE_LABELS[s]}</option>)}</Select>
          </Field>
          <Field label="Tartib raqami"><Input type="number" min={0} {...form.register('sortOrder', { valueAsNumber: true })} /></Field>
        </div>
        <LocaleTabs active={locale} onChange={setLocale} filled={{ uz: true, ru: isFilled(tr.ru), en: isFilled(tr.en) }} errors={errLocales}>
          {(l) => (
            <div className="space-y-4">
              <Field label="Nomi" required={l === 'uz'} error={e.translations?.[l]?.name?.message}>
                <Input {...form.register(`translations.${l}.name`, { onChange: (ev) => { if (!cat && !form.getFieldState(`translations.${l}.slug`).isDirty) form.setValue(`translations.${l}.slug`, slugify(ev.target.value)); } })} />
              </Field>
              <Field label="Slug" required={l === 'uz'} error={e.translations?.[l]?.slug?.message}><Input {...form.register(`translations.${l}.slug`)} /></Field>
            </div>
          )}
        </LocaleTabs>
      </form>
    </Modal>
  );
}

export default function CategoriesPage() {
  const toast = useToast();
  const canDelete = useCan('content.delete');
  const query = categoriesApi.useList<{ items: AdminCategory[] }>({});
  const remove = categoriesApi.useRemove();
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<AdminCategory | null>(null);

  const columns: Column<AdminCategory>[] = [
    { header: 'Nomi', cell: (r) => <button type="button" className="font-medium text-primary-600 hover:underline" onClick={() => setEditing(r)}>{r.name}</button> },
    { header: 'Bo‘lim', cell: (r) => <span className="text-muted">{CATEGORY_SCOPE_LABELS[r.scope]}</span> },
    { header: 'Tillar', cell: (r) => <TranslationBadges status={r.translationStatus} /> },
    { header: 'Ishlatilgan', cell: (r) => <span className="text-muted">{r.usageCount} ta</span> },
    { header: 'Tartib', cell: (r) => <span className="text-muted">{r.sortOrder}</span> },
    { header: 'Amallar', cell: (r) => (
      <div className="flex gap-1.5">
        <IconButton label="Tahrirlash" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" aria-hidden /></IconButton>
        {canDelete && <IconButton label="O‘chirish" danger onClick={() => setDeleting(r)}><Trash2 className="h-4 w-4" aria-hidden /></IconButton>}
      </div>
    ) },
  ];

  return (
    <>
      <PageTitle title="Kategoriyalar" actions={<Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setCreating(true)}>Yangi kategoriya</Button>} />
      {query.isPending ? <Loading /> : query.isError ? <ErrorState title="Kategoriyalarni yuklab bo‘lmadi" text={query.error.message} onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? (
        <EmptyState title="Hozircha kategoriyalar mavjud emas" text="Yangiliklar va hujjatlarni guruhlash uchun kategoriya yarating." action={<Button onClick={() => setCreating(true)}>Yangi kategoriya</Button>} />
      ) : <DataTable columns={columns} rows={query.data.items} rowKey={(r) => r.id} />}
      {(creating || editing) && <CategoryModal key={editing?.id ?? 'new'} cat={editing} open onClose={() => { setCreating(false); setEditing(null); }} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        danger
        title="Kategoriyani o‘chirish"
        message={<>“{deleting?.name}” kategoriyasi o‘chiriladi.{deleting && deleting.usageCount > 0 && ' Kategoriya materiallarda ishlatilmoqda, shuning uchun o‘chirib bo‘lmaydi.'}</>}
        confirmLabel="O‘chirish"
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          try { await remove.mutateAsync(deleting.id); toast.success('Kategoriya o‘chirildi'); } catch (err) { toast.error(errorMessage(err)); } finally { setDeleting(null); }
        }}
      />
    </>
  );
}
