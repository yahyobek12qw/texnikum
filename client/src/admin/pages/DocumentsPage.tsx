import { Download, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useSearchParams } from 'react-router-dom';
import {
  DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, LOCALES, documentCreateSchema, documentUpdateSchema,
  type AdminDocument, type DocumentTranslationInput, type DocumentType, type Locale,
} from '@uchkoprik/shared';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { Field, Input, Select, Textarea } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { categoriesApi, documentsApi } from '../api';
import { useCan } from '../auth';
import { ListResult, PageTitle, SearchBox, StatusBadge, StatusFilter, Toolbar, TranslationBadges, fmtDate, useListParams, type Column } from '../components/common';
import { applyIssues, LocaleTabs, serverIssues } from '../components/form-utils';
import { MediaField, formatBytes } from '../components/MediaPicker';
import { RowButtons, errorMessage, useRowActions } from '../components/row-actions';

interface TrForm { title: string; description: string }
interface DocFormValues {
  type: DocumentType;
  categoryId: string;
  fileMediaId: string | null;
  docDate: string;
  number: string;
  translations: Record<Locale, TrForm>;
}

function toValues(d: AdminDocument | null): DocFormValues {
  const tr = (l: Locale): TrForm => ({ title: d?.translations[l]?.title ?? '', description: d?.translations[l]?.description ?? '' });
  return {
    type: d?.type ?? 'REGULATION',
    categoryId: d?.categoryId ?? '',
    fileMediaId: d?.file.id ?? null,
    docDate: d?.docDate ? d.docDate.slice(0, 10) : '',
    number: d?.number ?? '',
    translations: { uz: tr('uz'), ru: tr('ru'), en: tr('en') },
  };
}
const isFilled = (t: TrForm) => Boolean(t.title.trim() || t.description.trim());
const toTr = (t: TrForm): DocumentTranslationInput => ({ title: t.title.trim(), description: t.description.trim() });

function DocumentFormModal({ doc, open, onClose }: { doc: AdminDocument | null; open: boolean; onClose: () => void }) {
  const toast = useToast();
  const canPublish = useCan('content.publish');
  const create = documentsApi.useCreate();
  const update = documentsApi.useUpdate();
  const categories = categoriesApi.useList<{ items: { id: string; name: string }[] }>({ scope: 'DOCUMENT' });
  const [locale, setLocale] = useState<Locale>('uz');
  const [errLocales, setErrLocales] = useState<Partial<Record<Locale, boolean>>>({});
  const form = useForm<DocFormValues>({ defaultValues: toValues(doc) });
  const existing = useMemo(() => new Set(LOCALES.filter((l) => doc?.translations[l])), [doc]);
  const tr = form.watch('translations');
  const filled = { uz: true, ru: isFilled(tr.ru), en: isFilled(tr.en) };

  useEffect(() => {
    if (open) {
      form.reset(toValues(doc));
      setLocale('uz');
      setErrLocales({});
    }
  }, [open, doc, form]);

  const submit = async (publish: boolean) => {
    const v = form.getValues();
    const trs: Record<string, DocumentTranslationInput | null> = { uz: toTr(v.translations.uz) };
    for (const l of ['ru', 'en'] as const) {
      if (isFilled(v.translations[l])) trs[l] = toTr(v.translations[l]);
      else if (existing.has(l)) trs[l] = null;
    }
    const base = {
      type: v.type,
      categoryId: v.categoryId || null,
      fileMediaId: v.fileMediaId ?? '',
      docDate: v.docDate || null,
      number: v.number.trim() || null,
      translations: trs,
      ...(publish ? { status: 'PUBLISHED' as const } : {}),
    };
    form.clearErrors();
    setErrLocales({});
    const parsed = doc ? documentUpdateSchema.safeParse(base) : documentCreateSchema.safeParse(base);
    if (!parsed.success || !v.fileMediaId) {
      if (!parsed.success) {
        const locs = applyIssues(form, parsed.error.issues);
        setErrLocales(Object.fromEntries([...locs].map((l) => [l, true])));
        if (locs.size && !locs.has(locale)) setLocale([...locs][0]!);
      }
      if (!v.fileMediaId) form.setError('fileMediaId', { message: 'Hujjat faylini tanlang' });
      toast.error('Formada xatoliklar bor.');
      return;
    }
    try {
      if (doc) await update.mutateAsync({ id: doc.id, body: base });
      else await create.mutateAsync(base);
      toast.success(doc ? 'Hujjat saqlandi' : publish ? 'Hujjat yaratildi va nashr qilindi' : 'Hujjat qoralama sifatida saqlandi');
      onClose();
    } catch (err) {
      const issues = serverIssues(err);
      if (issues) {
        const locs = applyIssues(form, issues);
        setErrLocales(Object.fromEntries([...locs].map((l) => [l, true])));
      }
      toast.error(errorMessage(err));
    }
  };

  const busy = create.isPending || update.isPending;
  const e = form.formState.errors;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={doc ? 'Hujjatni tahrirlash' : 'Yangi hujjat'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Bekor qilish</Button>
          <Button variant="secondary" loading={busy} onClick={() => void submit(false)}>{doc ? 'Saqlash' : 'Qoralama sifatida saqlash'}</Button>
          {!doc && canPublish && <Button variant="accent" loading={busy} onClick={() => void submit(true)}>Saqlash va nashr qilish</Button>}
        </>
      }
    >
      <form onSubmit={(ev) => { ev.preventDefault(); void submit(false); }} noValidate className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Hujjat turi">
            <Select {...form.register('type')}>{DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}</Select>
          </Field>
          <Field label="Kategoriya">
            <Select {...form.register('categoryId')}>
              <option value="">— Kategoriyasiz —</option>
              {categories.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
          <Field label="Hujjat sanasi"><Input type="date" {...form.register('docDate')} /></Field>
          <Field label="Raqami / rekvizitlar" error={e.number?.message} hint="Masalan: 12-son"><Input {...form.register('number')} /></Field>
        </div>
        <Controller control={form.control} name="fileMediaId" render={({ field }) => (
          <MediaField label="Fayl (PDF, DOCX, XLSX, PPTX)" kind="DOCUMENT" value={field.value} initial={doc ? { id: doc.file.id, kind: 'DOCUMENT', originalName: `${doc.file.originalName} (${formatBytes(doc.file.size)})`, url: null, thumbUrl: null } : null} onChange={field.onChange} error={e.fileMediaId?.message} />
        )} />
        <LocaleTabs active={locale} onChange={setLocale} filled={filled} errors={errLocales}>
          {(l) => (
            <div className="space-y-4">
              {l !== 'uz' && !filled[l] && <Alert tone="info">Bu tilda nom kiritilmagan. Avtomatik tarjima ishlatilmaydi.</Alert>}
              <Field label="Nomi" required={l === 'uz'} error={e.translations?.[l]?.title?.message}><Input {...form.register(`translations.${l}.title`)} /></Field>
              <Field label="Qisqa tavsif" error={e.translations?.[l]?.description?.message}><Textarea rows={3} {...form.register(`translations.${l}.description`)} /></Field>
            </div>
          )}
        </LocaleTabs>
        {doc && <Alert tone="info">Holat: <StatusBadge status={doc.status} /> — holatni ro‘yxatdagi tugmalar orqali o‘zgartiring.</Alert>}
      </form>
    </Modal>
  );
}

export default function DocumentsPage() {
  const p = useListParams();
  const [search, setSearch] = useSearchParams();
  const query = documentsApi.useList({ page: p.page, pageSize: 20, q: p.get('q') || undefined, status: p.get('status') || undefined, type: p.get('type') || undefined });
  const update = documentsApi.useUpdate();
  const remove = documentsApi.useRemove();
  const editId = search.get('edit');
  const editing = documentsApi.useItem(editId && editId !== 'new' ? editId : undefined);
  const [creating, setCreating] = useState(false);

  // Dashboard'dan ?edit=ID bilan kelinganda tahrir oynasi ochiladi
  const closeModal = () => {
    setCreating(false);
    if (search.has('edit')) {
      const next = new URLSearchParams(search);
      next.delete('edit');
      setSearch(next, { replace: true });
    }
  };

  // Hujjatlarda alohida publish endpointi yo'q: holat PATCH orqali o'zgaradi
  const statusMutation = {
    mutateAsync: ({ id, action }: { id: string; action: 'publish' | 'unpublish' | 'archive' }) =>
      update.mutateAsync({ id, body: { status: action === 'publish' ? 'PUBLISHED' : action === 'archive' ? 'ARCHIVED' : 'DRAFT' } }),
    isPending: update.isPending,
  };
  const actions = useRowActions<AdminDocument>({ action: statusMutation, remove, noun: 'Hujjat', title: (r) => r.title });

  const columns: Column<AdminDocument>[] = [
    {
      header: 'Nomi',
      cell: (r) => (
        <div>
          <button type="button" className="text-left font-medium text-primary-600 hover:underline" onClick={() => { const n = new URLSearchParams(search); n.set('edit', r.id); setSearch(n, { replace: true }); }}>{r.title}</button>
          <p className="text-xs text-muted">{r.file.originalName} · {formatBytes(r.file.size)}</p>
        </div>
      ),
    },
    { header: 'Turi', cell: (r) => <span className="text-muted">{DOCUMENT_TYPE_LABELS[r.type]}</span> },
    { header: 'Raqam / sana', cell: (r) => <span className="whitespace-nowrap text-muted">{r.number ?? '—'} · {fmtDate(r.docDate)}</span> },
    { header: 'Tillar', cell: (r) => <TranslationBadges status={r.translationStatus} /> },
    { header: 'Holat', cell: (r) => <StatusBadge status={r.status} /> },
    {
      header: 'Amallar',
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <RowButtons row={r} status={r.status} editTo={`/admin/documents?edit=${r.id}`} actions={actions} />
          <a href={`/api/v1/admin/media/${r.file.id}/file`} aria-label="Faylni yuklab olish" title="Faylni yuklab olish" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-primary-700 hover:bg-surface"><Download className="h-4 w-4" aria-hidden /></a>
        </div>
      ),
    },
  ];

  const modalOpen = creating || Boolean(editId && editId !== 'new');
  const docForModal = editId && editId !== 'new' ? (editing.data ?? null) : null;

  return (
    <>
      <PageTitle title="Hujjatlar" actions={<Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setCreating(true)}>Yangi hujjat</Button>} />
      <Toolbar>
        <SearchBox value={p.get('q')} onChange={(v) => p.set({ q: v || null })} placeholder="Nomi yoki raqami bo‘yicha qidirish…" />
        <StatusFilter value={p.get('status')} onChange={(v) => p.set({ status: v || null })} />
        <div>
          <label htmlFor="doc-type-filter" className="sr-only">Hujjat turi</label>
          <Select id="doc-type-filter" value={p.get('type')} onChange={(e) => p.set({ type: e.target.value || null })} className="min-w-44">
            <option value="">Barcha turlar</option>
            {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>)}
          </Select>
        </div>
      </Toolbar>
      <ListResult
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        emptyTitle={p.get('q') || p.get('status') || p.get('type') ? 'Hech narsa topilmadi' : 'Hozircha hujjatlar mavjud emas'}
        emptyText="Birinchi hujjatni yuklang."
        emptyAction={<Button onClick={() => setCreating(true)}>Yangi hujjat</Button>}
        onPage={(n) => p.set({ page: n > 1 ? String(n) : null }, false)}
      />
      {modalOpen && (!editId || editing.data || creating) && <DocumentFormModal key={docForModal?.id ?? 'new'} doc={docForModal} open={modalOpen} onClose={closeModal} />}
      {actions.dialog}
    </>
  );
}
