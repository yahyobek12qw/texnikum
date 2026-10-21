import { Plus } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Controller, useForm, type UseFormReturn } from 'react-hook-form';
import type { z } from 'zod';
import { LOCALES, type ContentStatus, type Locale, type TranslationStatus } from '@uchkoprik/shared';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState, ErrorState, Loading } from '../../components/ui/Feedback';
import { Field, Input, Textarea } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { useCan } from '../auth';
import { DataTable, PageTitle, StatusBadge, TranslationBadges, type Column } from './common';
import { applyIssues, LocaleTabs, serverIssues } from './form-utils';
import { MediaField } from './MediaPicker';
import { RowButtons, errorMessage, useRowActions } from './row-actions';
import type { AdminMediaRef } from '@uchkoprik/shared';

export interface FieldDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'media' | 'custom';
  /** type === 'custom' uchun: maydonni o'zi chizadi (forma qiymatlari "base.<nom>" yo'lida) */
  render?: (ctx: { form: UseFormReturn<any>; item: any; error: string | undefined }) => ReactNode; // eslint-disable-line @typescript-eslint/no-explicit-any
  hint?: string;
  required?: boolean;
  placeholder?: string;
}

export interface EntityItem {
  id: string;
  title: string;
  status: ContentStatus;
  sortOrder: number;
  translationStatus: TranslationStatus;
  translations: Partial<Record<Locale, Record<string, string>>>;
}

type Row = Record<string, unknown>;

interface Resource<T> {
  useList: <R>(params?: Record<string, never>) => { data?: R; isPending: boolean; isError: boolean; error: Error | null; refetch: () => unknown };
  useCreate: () => { mutateAsync: (b: never) => Promise<unknown>; isPending: boolean };
  useUpdate: () => { mutateAsync: (v: { id: string; body: never }) => Promise<unknown>; isPending: boolean };
  useRemove: () => { mutateAsync: (id: string) => Promise<unknown>; isPending: boolean };
  useAction: () => { mutateAsync: (v: { id: string; action: 'publish' | 'unpublish' | 'archive' }) => Promise<unknown>; isPending: boolean };
  _t?: T;
}

export interface EntityConfig<T extends EntityItem> {
  title: string;
  noun: string;
  emptyTitle: string;
  emptyText?: string;
  addLabel: string;
  api: unknown;
  /** Tarjima qilinmaydigan maydonlar */
  base: FieldDef[];
  /** Har bir tilda kiritiladigan maydonlar (birinchisi o'zbekchada majburiy) */
  trFields: FieldDef[];
  createSchema: z.ZodType;
  updateSchema: z.ZodType;
  /** Elementdan forma qiymatlari */
  toBase: (item: T | null) => Row;
  /** Forma qiymatlaridan serverga yuboriladigan asosiy maydonlar */
  fromBase: (v: Row) => Row;
  /** Jadvaldagi qo'shimcha ustunlar (nom va holat ustunlaridan keyin) */
  extraColumns?: { header: string; cell: (item: T) => ReactNode }[];
  /** Nom ostidagi qo'shimcha qator */
  subtitle?: (item: T) => ReactNode;
  mediaInitial?: (item: T | null, field: string) => AdminMediaRef | null | undefined;
  note?: ReactNode;
}

const filled = (t: Record<string, string> | undefined) => Object.values(t ?? {}).some((v) => v.trim() !== '');

function EntityModal<T extends EntityItem>({ cfg, item, onClose }: { cfg: EntityConfig<T>; item: T | null; onClose: () => void }) {
  const toast = useToast();
  const api = cfg.api as Resource<T>;
  const create = api.useCreate();
  const update = api.useUpdate();
  const [locale, setLocale] = useState<Locale>('uz');
  const [errLocales, setErrLocales] = useState<Partial<Record<Locale, boolean>>>({});

  const defaults = useMemo(() => {
    const tr = Object.fromEntries(LOCALES.map((l) => [l, Object.fromEntries(cfg.trFields.map((f) => [f.name, item?.translations[l]?.[f.name] ?? '']))]));
    return { base: cfg.toBase(item), translations: tr } as { base: Row; translations: Record<Locale, Record<string, string>> };
  }, [cfg, item]);
  const form = useForm<typeof defaults>({ defaultValues: defaults });
  const existing = useMemo(() => new Set(LOCALES.filter((l) => item?.translations[l])), [item]);
  const tr = form.watch('translations');
  const e = form.formState.errors as { base?: Record<string, { message?: string }>; translations?: Partial<Record<Locale, Record<string, { message?: string }>>> };
  useEffect(() => {
    setLocale('uz');
  }, [item]);

  const submit = async () => {
    const v = form.getValues();
    const translations: Record<string, Record<string, string> | null> = { uz: trim(v.translations.uz) };
    for (const l of ['ru', 'en'] as const) {
      if (filled(v.translations[l])) translations[l] = trim(v.translations[l]);
      else if (existing.has(l)) translations[l] = null;
    }
    const body: Record<string, unknown> = { ...cfg.fromBase(v.base), translations };
    form.clearErrors();
    setErrLocales({});
    const parsed = (item ? cfg.updateSchema : cfg.createSchema).safeParse(item ? body : { ...body, sortOrder: body.sortOrder ?? 0 });
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({ ...i, path: mapPath(i.path as (string | number)[], cfg) }));
      const locs = applyIssues(form as never, issues);
      setErrLocales(Object.fromEntries([...locs].map((l) => [l, true])));
      if (locs.size && !locs.has(locale)) setLocale([...locs][0]!);
      return;
    }
    try {
      if (item) await update.mutateAsync({ id: item.id, body: body as never });
      else await create.mutateAsync(body as never);
      toast.success(item ? `${cfg.noun} saqlandi` : `${cfg.noun} qoralama sifatida saqlandi`);
      onClose();
    } catch (err) {
      const issues = serverIssues(err);
      if (issues) {
        const locs = applyIssues(form as never, issues.map((i) => ({ ...i, path: mapPath(String(i.path).split('.'), cfg) })));
        setErrLocales(Object.fromEntries([...locs].map((l) => [l, true])));
      }
      toast.error(errorMessage(err));
    }
  };

  const renderField = (f: FieldDef, name: string, error: string | undefined) => {
    if (f.type === 'custom' && f.render) {
      return <div key={name}>{f.render({ form: form as UseFormReturn<any>, item, error })}</div>; // eslint-disable-line @typescript-eslint/no-explicit-any
    }
    if (f.type === 'media') {
      return (
        <Controller key={name} control={form.control} name={name as never} render={({ field }) => (
          <MediaField label={f.label} kind="IMAGE" value={(field.value as string | null) ?? null} initial={cfg.mediaInitial?.(item, f.name)} onChange={field.onChange} error={error} {...(f.hint ? { hint: f.hint } : {})} />
        )} />
      );
    }
    return (
      <Field key={name} label={f.label} required={f.required} error={error} {...(f.hint ? { hint: f.hint } : {})}>
        {f.type === 'textarea' ? <Textarea rows={3} {...form.register(name as never)} /> : <Input type={f.type === 'number' ? 'number' : 'text'} placeholder={f.placeholder} {...form.register(name as never, f.type === 'number' ? { setValueAs: (x: unknown) => (x === '' || x === null || x === undefined ? '' : Number(x)) } : {})} />}
      </Field>
    );
  };

  return (
    <Modal open onClose={onClose} size="lg" title={item ? `${cfg.noun}ni tahrirlash` : cfg.addLabel}
      footer={<><Button variant="secondary" onClick={onClose}>Bekor qilish</Button><Button loading={create.isPending || update.isPending} onClick={() => void submit()}>Saqlash</Button></>}>
      <form onSubmit={(ev) => { ev.preventDefault(); void submit(); }} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {cfg.base.map((f) => <div key={f.name} className={f.type === 'media' || f.type === 'textarea' || f.type === 'custom' ? 'sm:col-span-2' : ''}>{renderField(f, `base.${f.name}`, e.base?.[f.name]?.message)}</div>)}
        </div>
        <LocaleTabs active={locale} onChange={setLocale} filled={{ uz: true, ru: filled(tr.ru), en: filled(tr.en) }} errors={errLocales}>
          {(l) => (
            <div className="space-y-4">
              {l !== 'uz' && !filled(tr[l]) && <Alert tone="info">Bu tilda ma’lumot kiritilmagan. Avtomatik tarjima ishlatilmaydi.</Alert>}
              {cfg.trFields.map((f, i) => renderField({ ...f, required: i === 0 && l === 'uz' }, `translations.${l}.${f.name}`, e.translations?.[l]?.[f.name]?.message))}
            </div>
          )}
        </LocaleTabs>
      </form>
    </Modal>
  );
}

const trim = (o: Record<string, string>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.trim()]));

/** Zod yo'li ("sourceUrl") forma yo'liga ("base.sourceUrl") o'giriladi; tarjimalar o'z holicha qoladi. */
function mapPath(path: (string | number)[], cfg: { base: FieldDef[] }): string[] {
  const first = String(path[0] ?? '');
  if (first === 'translations') return path.map(String);
  return cfg.base.some((f) => f.name === first) ? ['base', ...path.map(String)] : path.map(String);
}

export function EntityManager<T extends EntityItem>({ cfg }: { cfg: EntityConfig<T> }) {
  const api = cfg.api as Resource<T>;
  const query = api.useList<{ items: T[] }>({});
  const actions = useRowActions<T>({ action: api.useAction(), remove: api.useRemove(), noun: cfg.noun, title: (r) => r.title });
  const canWrite = useCan('content.write');
  const [editing, setEditing] = useState<T | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: Column<T>[] = [
    {
      header: cfg.noun,
      cell: (r) => (
        <div>
          <button type="button" className="text-left font-medium text-primary-600 hover:underline" onClick={() => setEditing(r)}>{r.title}</button>
          {cfg.subtitle?.(r)}
        </div>
      ),
    },
    ...(cfg.extraColumns ?? []).map((c): Column<T> => ({ header: c.header, cell: c.cell })),
    { header: 'Tillar', cell: (r) => <TranslationBadges status={r.translationStatus} /> },
    { header: 'Holat', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Tartib', cell: (r) => <span className="text-muted">{r.sortOrder}</span> },
    { header: 'Amallar', cell: (r) => <RowButtons row={r} status={r.status} onEdit={() => setEditing(r)} actions={actions} /> },
  ];

  return (
    <>
      <PageTitle title={cfg.title} actions={canWrite && <Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setCreating(true)}>{cfg.addLabel}</Button>} />
      {cfg.note && <div className="mb-4">{cfg.note}</div>}
      {query.isPending ? <Loading /> : query.isError ? <ErrorState title="Ma’lumotlarni yuklab bo‘lmadi" text={query.error?.message} onRetry={() => void query.refetch()} /> : (query.data?.items.length ?? 0) === 0 ? (
        <EmptyState title={cfg.emptyTitle} text={cfg.emptyText} action={canWrite ? <Button onClick={() => setCreating(true)}>{cfg.addLabel}</Button> : undefined} />
      ) : <DataTable columns={columns} rows={query.data!.items} rowKey={(r) => r.id} />}
      {(creating || editing) && <EntityModal key={editing?.id ?? 'new'} cfg={cfg} item={editing} onClose={() => { setCreating(false); setEditing(null); }} />}
      {actions.dialog}
    </>
  );
}
