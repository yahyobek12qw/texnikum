import { Save, Send, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  LOCALES, NEWS_TYPES, NEWS_TYPE_LABELS, newsCreateSchema, newsUpdateSchema, slugify,
  type AdminNews, type Locale, type NewsTranslationInput, type NewsType,
} from '@uchkoprik/shared';
import { Button } from '../../components/ui/Button';
import { Alert, ErrorState, Loading } from '../../components/ui/Feedback';
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Form';
import { ConfirmDialog } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { categoriesApi, newsApi } from '../api';
import { useCan } from '../auth';
import { Card, MobileSaveBar, PageTitle, StatusBadge, fmtDate } from '../components/common';
import { applyIssues, isSlugConflict, LocaleTabs, serverIssues } from '../components/form-utils';
import { MediaField } from '../components/MediaPicker';
import { RichTextEditor } from '../components/RichTextEditor';
import { errorMessage } from '../components/row-actions';

interface TrForm { title: string; slug: string; excerpt: string; content: string; seoTitle: string; seoDescription: string }
interface NewsFormValues {
  type: NewsType;
  categoryId: string;
  coverMediaId: string | null;
  isImportant: boolean;
  publishedAt: string;
  eventAt: string;
  scheduledAt: string;
  translations: Record<Locale, TrForm>;
}

const emptyTr = (): TrForm => ({ title: '', slug: '', excerpt: '', content: '', seoTitle: '', seoDescription: '' });

/** ISO sanani <input type="datetime-local"> formatiga (mahalliy vaqt) o'giradi. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

function toFormValues(n: AdminNews | null, defaultType: NewsType): NewsFormValues {
  const tr = (l: Locale): TrForm => {
    const t = n?.translations[l];
    return t ? { title: t.title, slug: t.slug, excerpt: t.excerpt, content: t.content, seoTitle: t.seoTitle ?? '', seoDescription: t.seoDescription ?? '' } : emptyTr();
  };
  return {
    type: n?.type ?? defaultType,
    categoryId: n?.categoryId ?? '',
    coverMediaId: n?.cover?.id ?? null,
    isImportant: n?.isImportant ?? false,
    publishedAt: toLocalInput(n?.publishedAt),
    eventAt: toLocalInput(n?.eventAt),
    scheduledAt: toLocalInput(n?.scheduledAt),
    translations: { uz: tr('uz'), ru: tr('ru'), en: tr('en') },
  };
}

const isFilled = (t: TrForm) => Boolean(t.title.trim() || t.slug.trim() || t.excerpt.trim() || t.seoTitle.trim() || t.seoDescription.trim() || t.content.replace(/<[^>]*>/g, '').trim());
const toTranslation = (t: TrForm): NewsTranslationInput => ({ title: t.title.trim(), slug: t.slug.trim(), excerpt: t.excerpt.trim(), content: t.content, seoTitle: t.seoTitle.trim() || null, seoDescription: t.seoDescription.trim() || null });

function NewsForm({ item, defaultType }: { item: AdminNews | null; defaultType: NewsType }) {
  const navigate = useNavigate();
  const toast = useToast();
  const create = newsApi.useCreate();
  const canPublish = useCan('content.publish');
  const canDelete = useCan('content.delete');
  const locked = item?.status === 'PUBLISHED' && !canPublish;
  const update = newsApi.useUpdate();
  const action = newsApi.useAction();
  const remove = newsApi.useRemove();
  const categories = categoriesApi.useList<{ items: { id: string; name: string }[] }>({ scope: 'NEWS' });

  const [activeLocale, setActiveLocale] = useState<Locale>('uz');
  const [localesWithErrors, setLocalesWithErrors] = useState<Partial<Record<Locale, boolean>>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<NewsFormValues>({ defaultValues: toFormValues(item, defaultType) });
  const { register, control, watch, setValue, formState } = form;
  const slugTouched = useMemo(() => new Set<Locale>(LOCALES.filter((l) => item?.translations[l]?.slug)), [item]);
  const translations = watch('translations');
  const type = watch('type');
  const filled = { uz: true, ru: isFilled(translations.ru), en: isFilled(translations.en) };
  const existing = useMemo(() => new Set(LOCALES.filter((l) => item?.translations[l])), [item]);

  useEffect(() => form.reset(toFormValues(item, defaultType)), [item, defaultType, form]);
  useEffect(() => {
    if (!formState.isDirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [formState.isDirty]);

  const submit = async (publish: boolean) => {
    const v = form.getValues();
    const trs: Record<string, NewsTranslationInput | null> = { uz: toTranslation(v.translations.uz) };
    for (const l of ['ru', 'en'] as const) {
      if (isFilled(v.translations[l])) trs[l] = toTranslation(v.translations[l]);
      else if (existing.has(l)) trs[l] = null;
    }
    const scheduledAt = item?.status === 'PUBLISHED' || publish || !canPublish ? null : fromLocalInput(v.scheduledAt);
    const base = {
      type: v.type,
      categoryId: v.categoryId || null,
      coverMediaId: v.coverMediaId,
      isImportant: v.isImportant,
      publishedAt: fromLocalInput(v.publishedAt),
      eventAt: v.type === 'EVENT' ? fromLocalInput(v.eventAt) : null,
      scheduledAt,
      translations: trs,
    };

    form.clearErrors();
    setLocalesWithErrors({});
    const parsed = item ? newsUpdateSchema.safeParse(base) : newsCreateSchema.safeParse(base);
    if (!parsed.success) {
      const locs = applyIssues(form, parsed.error.issues);
      setLocalesWithErrors(Object.fromEntries([...locs].map((l) => [l, true])));
      if (locs.size && !locs.has(activeLocale)) setActiveLocale([...locs][0]!);
      toast.error('Formada xatoliklar bor. Belgilangan maydonlarni tekshiring.');
      return;
    }

    try {
      let saved: AdminNews;
      if (item) saved = await update.mutateAsync({ id: item.id, body: base });
      else saved = await create.mutateAsync(base);
      if (publish) saved = await action.mutateAsync({ id: saved.id, action: 'publish' });
      toast.success(publish ? 'Material saqlandi va nashr qilindi' : item?.status === 'PUBLISHED' ? 'O‘zgarishlar saqlandi' : scheduledAt ? 'Material saqlandi va nashrga rejalashtirildi' : 'Material qoralama sifatida saqlandi');
      if (!item) navigate(`/admin/news/${saved.id}`, { replace: true });
      else form.reset(toFormValues(saved, defaultType));
    } catch (err) {
      const issues = serverIssues(err);
      if (issues) {
        const locs = applyIssues(form, issues);
        setLocalesWithErrors(Object.fromEntries([...locs].map((l) => [l, true])));
      } else if (isSlugConflict(err)) {
        const l = LOCALES.find((x) => isFilled(v.translations[x])) ?? 'uz';
        form.setError(`translations.${l}.slug`, { type: 'server', message: errorMessage(err) });
        setLocalesWithErrors({ [l]: true });
        setActiveLocale(l);
      }
      toast.error(errorMessage(err));
    }
  };

  const busy = create.isPending || update.isPending || action.isPending;
  const statusAction = async (a: 'unpublish' | 'archive') => {
    if (!item) return;
    try {
      await action.mutateAsync({ id: item.id, action: a });
      toast.success(a === 'unpublish' ? 'Material nashrdan qaytarildi' : 'Material arxivlandi');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageTitle
        title={item ? item.title : `Yangi material (${NEWS_TYPE_LABELS[type]})`}
        crumbs={[{ label: 'Yangiliklar', to: '/admin/news' }]}
        actions={item && <StatusBadge status={item.status} scheduledAt={item.scheduledAt} />}
      />
      {locked && <Alert tone="warn" className="mb-4">Bu material nashr qilingan. Uni tahrirlash uchun nashr huquqi kerak: o‘zgartirish kiritish uchun bosh muharrir yoki administratorga murojaat qiling.</Alert>}
      <form onSubmit={(e) => { e.preventDefault(); void submit(false); }} noValidate className="grid gap-6 pb-24 xl:pb-0 xl:grid-cols-[1fr_22rem]">
        <Card title="Mazmun (uch tilda)">
          <LocaleTabs active={activeLocale} onChange={setActiveLocale} filled={filled} errors={localesWithErrors}>
            {(l) => {
              const e = formState.errors.translations?.[l];
              return (
                <div className="space-y-4">
                  {l !== 'uz' && !filled[l] && <Alert tone="info">Bu tilda tarjima hali yo‘q. Maydonlar to‘ldirilsa, tarjima yaratiladi. Avtomatik tarjima ishlatilmaydi.</Alert>}
                  <Field label="Sarlavha" required={l === 'uz'} error={e?.title?.message}>
                    <Input {...register(`translations.${l}.title`, { onChange: (ev) => { if (!slugTouched.has(l) && !item) setValue(`translations.${l}.slug`, slugify(ev.target.value), { shouldDirty: true }); } })} />
                  </Field>
                  <div className="flex items-end gap-2">
                    <Field label="Slug (URL)" required={l === 'uz'} error={e?.slug?.message} hint={`/${l}/${type === 'NEWS' ? 'news' : type === 'ANNOUNCEMENT' ? 'announcements' : 'events'}/${translations[l].slug || 'slug'}`} className="flex-1">
                      <Input {...register(`translations.${l}.slug`, { onChange: () => slugTouched.add(l) })} />
                    </Field>
                    <Button variant="secondary" aria-label="Sarlavhadan slug yaratish" icon={<Wand2 className="h-4 w-4" aria-hidden />} onClick={() => { setValue(`translations.${l}.slug`, slugify(translations[l].title), { shouldDirty: true }); slugTouched.add(l); }} />
                  </div>
                  <Field label="Qisqa tavsif" error={e?.excerpt?.message} hint="Ro‘yxatlarda va qidiruvda ko‘rsatiladi">
                    <Textarea rows={3} {...register(`translations.${l}.excerpt`)} />
                  </Field>
                  <div>
                    <p className="mb-1 text-sm font-medium">Asosiy matn</p>
                    <Controller control={control} name={`translations.${l}.content`} render={({ field }) => <RichTextEditor key={l} value={field.value} onChange={field.onChange} label={`Asosiy matn (${l})`} invalid={Boolean(e?.content)} />} />
                    {e?.content?.message && <p role="alert" className="mt-1 text-sm font-medium text-danger-600">{e.content.message}</p>}
                  </div>
                  <fieldset className="space-y-3 rounded-md border border-line p-4">
                    <legend className="px-1 text-sm font-semibold">SEO</legend>
                    <Field label="SEO sarlavhasi" error={e?.seoTitle?.message}><Input {...register(`translations.${l}.seoTitle`)} /></Field>
                    <Field label="SEO tavsifi" error={e?.seoDescription?.message}><Textarea rows={3} {...register(`translations.${l}.seoDescription`)} /></Field>
                  </fieldset>
                </div>
              );
            }}
          </LocaleTabs>
        </Card>

        <aside className="space-y-6">
          <Card title="Nashr">
            <div className="flex flex-col gap-2">
              {item?.status === 'PUBLISHED' && canPublish ? (
                <Button type="submit" loading={busy} icon={<Save className="h-4 w-4" aria-hidden />}>O‘zgarishlarni saqlash</Button>
              ) : (
                <>
                  <Button type="submit" variant="secondary" disabled={locked} loading={busy} icon={<Save className="h-4 w-4" aria-hidden />}>{watch('scheduledAt') ? 'Rejalashtirib saqlash' : 'Qoralama sifatida saqlash'}</Button>
                  {canPublish && <Button variant="accent" loading={busy} icon={<Send className="h-4 w-4" aria-hidden />} onClick={() => void submit(true)}>Saqlash va hozir nashr qilish</Button>}
                </>
              )}
              {item && (
                <>
                  <Link to={`/admin/preview/news/${item.id}`} target="_blank" className="inline-flex min-h-10 items-center justify-center rounded-md border border-line text-sm font-medium no-underline hover:bg-surface">Oldindan ko‘rish (yangi oynada)</Link>
                  {canPublish && item.status === 'PUBLISHED' && <Button variant="secondary" onClick={() => void statusAction('unpublish')}>Nashrdan qaytarish</Button>}
                  {canPublish && item.status !== 'ARCHIVED' && <Button variant="secondary" onClick={() => void statusAction('archive')}>Arxivlash</Button>}
                  {canDelete && <Button variant="ghost" className="text-danger-600" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => setConfirmDelete(true)}>O‘chirish</Button>}
                </>
              )}
            </div>
            {item && <p className="mt-3 text-xs text-muted">Yaratilgan: {fmtDate(item.createdAt, true)}<br />Yangilangan: {fmtDate(item.updatedAt, true)}</p>}
          </Card>

          <Card title="Parametrlar">
            <div className="space-y-4">
              <Field label="Turi">
                <Select {...register('type')}>{NEWS_TYPES.map((t) => <option key={t} value={t}>{NEWS_TYPE_LABELS[t]}</option>)}</Select>
              </Field>
              <Field label="Kategoriya">
                <Select {...register('categoryId')}>
                  <option value="">— Kategoriyasiz —</option>
                  {categories.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Controller control={control} name="coverMediaId" render={({ field }) => (
                <MediaField label="Muqova rasmi" kind="IMAGE" value={field.value} initial={item?.cover} onChange={field.onChange} error={formState.errors.coverMediaId?.message} />
              )} />
              <Checkbox label="Muhim yangilik (bosh sahifadagi “Muhim e’lonlar”da chiqadi)" {...register('isImportant')} />
              <Field label="Nashr sanasi" hint="Bo‘sh qolsa, nashr qilingan vaqt qo‘yiladi">
                <Input type="datetime-local" {...register('publishedAt')} />
              </Field>
              {type === 'EVENT' && <Field label="Tadbir o‘tkaziladigan sana"><Input type="datetime-local" {...register('eventAt')} /></Field>}
              {item?.status !== 'PUBLISHED' && canPublish && (
                <Field label="Rejalashtirilgan nashr" error={formState.errors.scheduledAt?.message} hint="Kelajakdagi vaqt: server shu vaqtda avtomatik nashr qiladi. Bo‘sh qolsa — qoralama.">
                  <Input type="datetime-local" {...register('scheduledAt')} />
                </Field>
              )}
            </div>
          </Card>
        </aside>
        <MobileSaveBar>
          {item?.status === 'PUBLISHED' && canPublish ? (
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
        title="Materialni o‘chirish"
        message={<>“{item?.title}” va barcha tarjimalari o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.</>}
        confirmLabel="O‘chirish"
        loading={remove.isPending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!item) return;
          try {
            await remove.mutateAsync(item.id);
            toast.success('Material o‘chirildi');
            navigate('/admin/news', { replace: true });
          } catch (err) {
            toast.error(errorMessage(err));
            setConfirmDelete(false);
          }
        }}
      />
    </>
  );
}

export default function NewsEditPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const isNew = !id || id === 'new';
  const typeParam = params.get('type');
  const defaultType: NewsType = (NEWS_TYPES as readonly string[]).includes(typeParam ?? '') ? (typeParam as NewsType) : 'NEWS';
  const query = newsApi.useItem(isNew ? undefined : id);
  if (isNew) return <NewsForm item={null} defaultType={defaultType} />;
  if (query.isPending) return <Loading label="Material yuklanmoqda…" />;
  if (query.isError) return <ErrorState title="Materialni yuklab bo‘lmadi" text={query.error.message} onRetry={() => void query.refetch()} />;
  return <NewsForm item={query.data} defaultType={defaultType} />;
}
