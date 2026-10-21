import { History, Save, Send, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, LOCALES, PAGE_TEMPLATES, PAGE_TEMPLATE_LABELS, STAFF_KINDS, STAFF_KIND_LABELS,
  pageCreateSchema, pageUpdateSchema, slugify,
  type AdminPage, type DocumentType, type Locale, type PageTemplate, type PageTranslationInput, type StaffKind,
} from '@uchkoprik/shared';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Alert, ErrorState, Loading } from '../../components/ui/Feedback';
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Form';
import { ConfirmDialog } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { pagesApi, usePageVersions, useRestoreVersion } from '../api';
import { useCan } from '../auth';
import { Card, MobileSaveBar, PageTitle, StatusBadge, fmtDate } from '../components/common';
import { applyIssues, isSlugConflict, LocaleTabs, serverIssues } from '../components/form-utils';
import { RichTextEditor } from '../components/RichTextEditor';
import { errorMessage } from '../components/row-actions';

interface TrForm {
  title: string;
  slug: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
}
interface PageFormValues {
  parentId: string;
  template: PageTemplate;
  documentTypes: DocumentType[];
  staffKind: StaffKind | '';
  sortOrder: number;
  translations: Record<Locale, TrForm>;
}

const emptyTr = (): TrForm => ({ title: '', slug: '', content: '', seoTitle: '', seoDescription: '' });

function toFormValues(page: AdminPage | null): PageFormValues {
  const tr = (l: Locale): TrForm => {
    const t = page?.translations[l];
    return t ? { title: t.title, slug: t.slug, content: t.content, seoTitle: t.seoTitle ?? '', seoDescription: t.seoDescription ?? '' } : emptyTr();
  };
  return {
    parentId: page?.parentId ?? '',
    template: page?.template ?? 'DEFAULT',
    documentTypes: page?.options?.documentTypes ?? [],
    staffKind: page?.options?.staffKind ?? '',
    sortOrder: page?.sortOrder ?? 0,
    translations: { uz: tr('uz'), ru: tr('ru'), en: tr('en') },
  };
}

const isFilled = (t: TrForm) => Boolean(t.title.trim() || t.slug.trim() || t.seoTitle.trim() || t.seoDescription.trim() || t.content.replace(/<[^>]*>/g, '').trim());

function toTranslation(t: TrForm): PageTranslationInput {
  return { title: t.title.trim(), slug: t.slug.trim(), content: t.content, seoTitle: t.seoTitle.trim() || null, seoDescription: t.seoDescription.trim() || null };
}

function buildOptions(v: PageFormValues) {
  if (v.template === 'DOCUMENTS' && v.documentTypes.length) return { documentTypes: v.documentTypes };
  if (v.template === 'STAFF' && v.staffKind) return { staffKind: v.staffKind };
  return null;
}

function PageForm({ page }: { page: AdminPage | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const create = pagesApi.useCreate();
  const canPublish = useCan('content.publish');
  const canDelete = useCan('content.delete');
  const locked = page?.status === 'PUBLISHED' && !canPublish;
  const update = pagesApi.useUpdate();
  const action = pagesApi.useAction();
  const remove = pagesApi.useRemove();
  const restore = useRestoreVersion();
  const versions = usePageVersions(page?.id);
  const parents = pagesApi.useList({ pageSize: 100 });

  const [activeLocale, setActiveLocale] = useState<Locale>('uz');
  const [localesWithErrors, setLocalesWithErrors] = useState<Partial<Record<Locale, boolean>>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);

  const defaults = useMemo(() => toFormValues(page), [page]);
  const form = useForm<PageFormValues>({ defaultValues: defaults });
  const { register, control, watch, setValue, formState } = form;
  const slugTouched = useMemo(() => new Set<Locale>(LOCALES.filter((l) => page?.translations[l]?.slug)), [page]);

  const template = watch('template');
  const translations = watch('translations');
  const filled = { uz: true, ru: isFilled(translations.ru), en: isFilled(translations.en) };
  const existing = useMemo(() => new Set(LOCALES.filter((l) => page?.translations[l])), [page]);

  useEffect(() => form.reset(toFormValues(page)), [page, form]);
  useEffect(() => {
    if (!formState.isDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [formState.isDirty]);

  const submit = async (publish: boolean) => {
    const v = form.getValues();
    const trs: Record<string, PageTranslationInput | null> = { uz: toTranslation(v.translations.uz) };
    for (const l of ['ru', 'en'] as const) {
      if (isFilled(v.translations[l])) trs[l] = toTranslation(v.translations[l]);
      else if (existing.has(l)) trs[l] = null;
    }
    const base = { parentId: v.parentId || null, template: v.template, options: buildOptions(v), sortOrder: Number(v.sortOrder) || 0, translations: trs };

    form.clearErrors();
    setLocalesWithErrors({});
    const parsed = page ? pageUpdateSchema.safeParse(base) : pageCreateSchema.safeParse({ ...base, parentId: base.parentId });
    if (!parsed.success) {
      const locs = applyIssues(form, parsed.error.issues);
      setLocalesWithErrors(Object.fromEntries([...locs].map((l) => [l, true])));
      if (locs.size && !locs.has(activeLocale)) setActiveLocale([...locs][0]!);
      toast.error('Formada xatoliklar bor. Belgilangan maydonlarni tekshiring.');
      return;
    }

    try {
      let saved = page;
      if (page) saved = await update.mutateAsync({ id: page.id, body: base });
      else saved = await create.mutateAsync(base);
      if (publish && saved) saved = await action.mutateAsync({ id: saved.id, action: 'publish' });
      toast.success(publish ? 'Sahifa saqlandi va nashr qilindi' : page?.status === 'PUBLISHED' ? 'O‘zgarishlar saqlandi' : 'Sahifa qoralama sifatida saqlandi');
      if (!page && saved) navigate(`/admin/pages/${saved.id}`, { replace: true });
      else form.reset(toFormValues(saved));
    } catch (err) {
      const issues = serverIssues(err);
      if (issues) {
        const locs = applyIssues(form, issues);
        setLocalesWithErrors(Object.fromEntries([...locs].map((l) => [l, true])));
      } else if (isSlugConflict(err) && err instanceof ApiError) {
        // Qaysi tildagi slug band ekanini aniq ko'rsatish uchun barcha tillardagi slugni belgilaymiz
        const l = LOCALES.find((x) => isFilled(v.translations[x])) ?? 'uz';
        form.setError(`translations.${l}.slug`, { type: 'server', message: err.message });
        setLocalesWithErrors({ [l]: true });
        setActiveLocale(l);
      }
      toast.error(errorMessage(err));
    }
  };

  const busy = create.isPending || update.isPending || action.isPending;
  const statusAction = async (a: 'unpublish' | 'archive') => {
    if (!page) return;
    try {
      await action.mutateAsync({ id: page.id, action: a });
      toast.success(a === 'unpublish' ? 'Sahifa nashrdan qaytarildi' : 'Sahifa arxivlandi');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const parentOptions = (parents.data?.items ?? []).filter((p) => p.id !== page?.id).sort((a, b) => a.title.localeCompare(b.title, 'uz'));

  return (
    <>
      <PageTitle
        title={page ? page.title : 'Yangi sahifa'}
        crumbs={[{ label: 'Sahifalar', to: '/admin/pages' }]}
        actions={page && <StatusBadge status={page.status} />}
      />
      {locked && <Alert tone="warn" className="mb-4">Bu material nashr qilingan. Uni tahrirlash uchun nashr huquqi kerak: o‘zgartirish kiritish uchun bosh muharrir yoki administratorga murojaat qiling.</Alert>}
      <form onSubmit={(e) => { e.preventDefault(); void submit(false); }} noValidate className="grid gap-6 pb-24 xl:pb-0 xl:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title="Mazmun (uch tilda)">
            <LocaleTabs active={activeLocale} onChange={setActiveLocale} filled={filled} errors={localesWithErrors}>
              {(l) => {
                const e = formState.errors.translations?.[l];
                return (
                  <div className="space-y-4">
                    {l !== 'uz' && !filled[l] && (
                      <Alert tone="info">Bu tilda tarjima hali yo‘q. Sarlavha, slug va matn kiritilsa, tarjima yaratiladi. Avtomatik tarjima ishlatilmaydi — matnni tekshirib kiriting.</Alert>
                    )}
                    <Field label="Sarlavha" required={l === 'uz'} error={e?.title?.message}>
                      <Input
                        {...register(`translations.${l}.title`, {
                          onChange: (ev) => {
                            if (!slugTouched.has(l) && !page) setValue(`translations.${l}.slug`, slugify(ev.target.value), { shouldDirty: true });
                          },
                        })}
                      />
                    </Field>
                    <div className="flex items-end gap-2">
                      <Field label="Slug (URL)" required={l === 'uz'} error={e?.slug?.message} hint={`/${l}/${translations[l].slug || 'slug'}`} className="flex-1">
                        <Input {...register(`translations.${l}.slug`, { onChange: () => slugTouched.add(l) })} />
                      </Field>
                      <Button variant="secondary" aria-label="Sarlavhadan slug yaratish" title="Sarlavhadan yaratish" icon={<Wand2 className="h-4 w-4" aria-hidden />} onClick={() => { setValue(`translations.${l}.slug`, slugify(translations[l].title), { shouldDirty: true }); slugTouched.add(l); }} />
                    </div>
                    <div>
                      <p className="mb-1 text-sm font-medium">Matn</p>
                      <Controller
                        control={control}
                        name={`translations.${l}.content`}
                        render={({ field }) => <RichTextEditor key={l} value={field.value} onChange={field.onChange} label={`Sahifa matni (${l})`} invalid={Boolean(e?.content)} />}
                      />
                      {e?.content?.message && <p role="alert" className="mt-1 text-sm font-medium text-danger-600">{e.content.message}</p>}
                    </div>
                    <fieldset className="space-y-3 rounded-md border border-line p-4">
                      <legend className="px-1 text-sm font-semibold">SEO</legend>
                      <Field label="SEO sarlavhasi" error={e?.seoTitle?.message} hint="Bo‘sh qolsa, sahifa sarlavhasi ishlatiladi">
                        <Input {...register(`translations.${l}.seoTitle`)} />
                      </Field>
                      <Field label="SEO tavsifi" error={e?.seoDescription?.message} hint="Qidiruv tizimlarida ko‘rinadigan qisqa tavsif (160 belgigacha tavsiya etiladi)">
                        <Textarea rows={3} {...register(`translations.${l}.seoDescription`)} />
                      </Field>
                    </fieldset>
                  </div>
                );
              }}
            </LocaleTabs>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Nashr">
            <div className="flex flex-col gap-2">
              {page?.status === 'PUBLISHED' && canPublish ? (
                <>
                  <Button type="submit" loading={busy} icon={<Save className="h-4 w-4" aria-hidden />}>O‘zgarishlarni saqlash</Button>
                  <p className="text-xs text-muted">Sahifa nashr qilingan: o‘zgarishlar saqlangach saytda darhol ko‘rinadi.</p>
                </>
              ) : (
                <>
                  <Button type="submit" variant="secondary" disabled={locked} loading={busy} icon={<Save className="h-4 w-4" aria-hidden />}>Qoralama sifatida saqlash</Button>
                  {canPublish && <Button variant="accent" loading={busy} icon={<Send className="h-4 w-4" aria-hidden />} onClick={() => void submit(true)}>Saqlash va nashr qilish</Button>}
                </>
              )}
              {page && (
                <>
                  <Link to={`/admin/preview/page/${page.id}`} target="_blank" className="inline-flex min-h-10 items-center justify-center rounded-md border border-line text-sm font-medium no-underline hover:bg-surface">Oldindan ko‘rish (yangi oynada)</Link>
                  {formState.isDirty && <p className="text-xs text-warn-700">Saqlanmagan o‘zgarishlar oldindan ko‘rishda aks etmaydi.</p>}
                  {canPublish && page.status === 'PUBLISHED' && <Button variant="secondary" onClick={() => void statusAction('unpublish')}>Nashrdan qaytarish</Button>}
                  {canPublish && page.status !== 'ARCHIVED' && <Button variant="secondary" onClick={() => void statusAction('archive')}>Arxivlash</Button>}
                  {canDelete && <Button variant="ghost" className="text-danger-600" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => setConfirmDelete(true)}>O‘chirish</Button>}
                </>
              )}
            </div>
            {page && <p className="mt-3 text-xs text-muted">Yaratilgan: {fmtDate(page.createdAt, true)}<br />Yangilangan: {fmtDate(page.updatedAt, true)}{page.publishedAt && <><br />Nashr: {fmtDate(page.publishedAt, true)}</>}</p>}
          </Card>

          <Card title="Sozlamalar">
            <div className="space-y-4">
              <Field label="Ota sahifa (bo‘lim)" hint="Menyu va yo‘l ko‘rsatkichi uchun">
                <Select {...register('parentId')}>
                  <option value="">— Yo‘q (asosiy daraja) —</option>
                  {parentOptions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </Select>
              </Field>
              <Field label="Sahifa shabloni">
                <Select {...register('template')}>
                  {PAGE_TEMPLATES.map((t) => <option key={t} value={t}>{PAGE_TEMPLATE_LABELS[t]}</option>)}
                </Select>
              </Field>
              {template === 'DOCUMENTS' && (
                <fieldset>
                  <legend className="mb-1 text-sm font-medium">Qaysi turdagi hujjatlar ko‘rsatilsin</legend>
                  <p className="mb-2 text-xs text-muted">Hech narsa tanlanmasa — barcha turlar.</p>
                  <Controller control={control} name="documentTypes" render={({ field }) => (
                    <div className="space-y-1">
                      {DOCUMENT_TYPES.map((d) => (
                        <Checkbox key={d} label={DOCUMENT_TYPE_LABELS[d]} checked={field.value.includes(d)} onChange={(e) => field.onChange(e.target.checked ? [...field.value, d] : field.value.filter((x) => x !== d))} />
                      ))}
                    </div>
                  )} />
                </fieldset>
              )}
              {template === 'STAFF' && (
                <Field label="Xodimlar turi">
                  <Select {...register('staffKind')}>
                    <option value="">Barchasi</option>
                    {STAFF_KINDS.map((k) => <option key={k} value={k}>{STAFF_KIND_LABELS[k]}</option>)}
                  </Select>
                </Field>
              )}
              <Field label="Tartib raqami" hint="Bo‘lim ichida kichik raqam yuqorida turadi">
                <Input type="number" min={0} max={9999} {...register('sortOrder', { valueAsNumber: true })} />
              </Field>
            </div>
          </Card>

          {page && (
            <Card title="Versiyalar tarixi">
              {versions.isPending ? <Loading /> : versions.isError ? <ErrorState title="Versiyalarni yuklab bo‘lmadi" /> : (
                <ul className="max-h-72 divide-y divide-line overflow-y-auto text-sm">
                  {versions.data.items.map((v, i) => (
                    <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                      <div>
                        <p className="font-medium">v{v.version}{i === 0 && ' (joriy)'}</p>
                        <p className="text-xs text-muted">{fmtDate(v.createdAt, true)}{v.createdBy ? ` · ${v.createdBy}` : ''}{v.note ? ` · ${v.note}` : ''}</p>
                      </div>
                      {i > 0 && <Button size="sm" variant="secondary" icon={<History className="h-3.5 w-3.5" aria-hidden />} onClick={() => setRestoreVersion(v.version)}>Tiklash</Button>}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </aside>
        <MobileSaveBar>
          {page?.status === 'PUBLISHED' && canPublish ? (
            <Button type="submit" className="flex-1" loading={busy}>Saqlash</Button>
          ) : (
            <>
              <Button type="submit" variant="secondary" className="flex-1" disabled={locked} loading={busy}>Qoralama</Button>
              {canPublish && <Button variant="accent" className="flex-1" loading={busy} onClick={() => void submit(true)}>Nashr qilish</Button>}
            </>
          )}
        </MobileSaveBar>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        danger
        title="Sahifani o‘chirish"
        message={<>“{page?.title}” sahifasi va uning barcha tarjimalari hamda versiyalari o‘chiriladi. Bu amalni qaytarib bo‘lmaydi. Arxivlash ko‘proq xavfsiz variant.</>}
        confirmLabel="O‘chirish"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!page) return;
          try {
            await remove.mutateAsync(page.id);
            toast.success('Sahifa o‘chirildi');
            navigate('/admin/pages', { replace: true });
          } catch (err) {
            toast.error(errorMessage(err));
            setConfirmDelete(false);
          }
        }}
      />
      <ConfirmDialog
        open={restoreVersion !== null}
        title="Versiyani tiklash"
        message={<>Sahifa v{restoreVersion} versiyadagi holatga qaytariladi. Joriy holat ham versiyalar tarixida saqlanib qoladi.</>}
        confirmLabel="Tiklash"
        loading={restore.isPending}
        onCancel={() => setRestoreVersion(null)}
        onConfirm={async () => {
          if (!page || restoreVersion === null) return;
          try {
            await restore.mutateAsync({ id: page.id, version: restoreVersion });
            toast.success(`v${restoreVersion} versiya tiklandi`);
          } catch (err) {
            toast.error(errorMessage(err));
          } finally {
            setRestoreVersion(null);
          }
        }}
      />
    </>
  );
}

export default function PageEditPage() {
  const { id } = useParams();
  const isNew = !id || id === 'new';
  const query = pagesApi.useItem(isNew ? undefined : id);
  if (isNew) return <PageForm page={null} />;
  if (query.isPending) return <Loading label="Sahifa yuklanmoqda…" />;
  if (query.isError) return <ErrorState title="Sahifani yuklab bo‘lmadi" text={query.error.message} onRetry={() => void query.refetch()} />;
  return <PageForm page={query.data} />;
}
