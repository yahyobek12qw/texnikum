import { Copy, FileText, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { LOCALES, LOCALE_LABELS, type AdminMedia, type Locale } from '@uchkoprik/shared';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Alert, EmptyState, ErrorState, Loading } from '../../components/ui/Feedback';
import { Checkbox, Field, Input, Select } from '../../components/ui/Form';
import { ConfirmDialog, Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import { mediaApi } from '../api';
import { useCan } from '../auth';
import { PageTitle, SearchBox, Toolbar, fmtDate, useListParams } from '../components/common';
import { formatBytes } from '../components/MediaPicker';
import { errorMessage } from '../components/row-actions';
import type { MediaUsage } from '@uchkoprik/shared';

function MediaDetailModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const toast = useToast();
  const canDelete = useCan('media.delete');
  const canWrite = useCan('media.write');
  const detail = mediaApi.useDetail(id ?? undefined);
  const update = mediaApi.useUpdate();
  const remove = mediaApi.useRemove();
  const [alts, setAlts] = useState<Record<Locale, { alt: string; caption: string }> | null>(null);
  const [gallery, setGallery] = useState<boolean | null>(null);
  const [confirm, setConfirm] = useState(false);

  const m = detail.data;
  const values = alts ?? m?.translations;
  const showInGallery = gallery ?? m?.showInGallery ?? false;
  const blocking = m?.usage.filter((u) => u.blocking) ?? [];
  const nonBlocking = m?.usage.filter((u) => !u.blocking) ?? [];

  const close = () => { setAlts(null); setGallery(null); setConfirm(false); onClose(); };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(new URL(text, window.location.origin).toString());
      toast.success('Havola nusxalandi');
    } catch {
      toast.error('Nusxalab bo‘lmadi. Havolani qo‘lda belgilab nusxalang.');
    }
  };

  const save = async () => {
    if (!m || !values) return;
    try {
      await update.mutateAsync({ id: m.id, body: { showInGallery, translations: values } });
      toast.success('Fayl ma’lumotlari saqlandi');
      close();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const doDelete = async () => {
    if (!m) return;
    try {
      await remove.mutateAsync({ id: m.id, force: nonBlocking.length > 0 });
      toast.success('Fayl o‘chirildi');
      close();
    } catch (err) {
      toast.error(errorMessage(err));
      setConfirm(false);
    }
  };

  return (
    <>
      <Modal
        open={Boolean(id)}
        onClose={close}
        size="lg"
        title={m?.originalName ?? 'Fayl'}
        footer={m && (
          <>
            {canDelete ? <Button variant="ghost" className="mr-auto text-danger-600" icon={<Trash2 className="h-4 w-4" aria-hidden />} disabled={blocking.length > 0} onClick={() => setConfirm(true)}>O‘chirish</Button> : <span className="mr-auto" />}
            <Button variant="secondary" onClick={close}>Yopish</Button>
            {canWrite && <Button loading={update.isPending} onClick={() => void save()}>Saqlash</Button>}
          </>
        )}
      >
        {detail.isPending ? <Loading /> : detail.isError ? <ErrorState title="Faylni yuklab bo‘lmadi" /> : m && values && (
          <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
            <div>
              {m.url ? <img src={m.thumbUrl ?? m.url} alt={values.uz.alt} className="w-full rounded-md border border-line" /> : (
                <div className="flex aspect-square items-center justify-center rounded-md border border-line bg-surface"><FileText className="h-16 w-16 text-muted" aria-hidden /></div>
              )}
              <dl className="mt-3 space-y-1 text-sm">
                <div><dt className="inline text-muted">Turi: </dt><dd className="inline">{m.mimeType}</dd></div>
                <div><dt className="inline text-muted">Hajmi: </dt><dd className="inline">{formatBytes(m.size)}</dd></div>
                {m.width && <div><dt className="inline text-muted">O‘lchami: </dt><dd className="inline">{m.width}×{m.height}</dd></div>}
                <div><dt className="inline text-muted">Yuklangan: </dt><dd className="inline">{fmtDate(m.createdAt, true)}</dd></div>
              </dl>
              {m.url && <Button size="sm" variant="secondary" className="mt-3 w-full" icon={<Copy className="h-4 w-4" aria-hidden />} onClick={() => void copy(m.url!)}>Havolani nusxalash</Button>}
            </div>
            <div className="space-y-4">
              {m.usage.length > 0 && (
                <Alert tone="warn">
                  <p className="font-medium">Fayl ishlatilmoqda:</p>
                  <ul className="mt-1 list-disc pl-5">{m.usage.map((u: MediaUsage) => <li key={`${u.type}-${u.id}`}>{u.title}{u.blocking && ' (majburiy bog‘langan)'}</li>)}</ul>
                </Alert>
              )}
              {m.kind === 'IMAGE' && (
                <>
                  {LOCALES.map((l) => (
                    <fieldset key={l} className="rounded-md border border-line p-3">
                      <legend className="px-1 text-sm font-semibold">{LOCALE_LABELS[l]}</legend>
                      <Field label="Alt matn (rasm tavsifi)" hint="Ekran o‘qish dasturlari va SEO uchun">
                        <Input value={values[l].alt} onChange={(e) => setAlts({ ...values, [l]: { ...values[l], alt: e.target.value } })} />
                      </Field>
                      <Field label="Izoh (galereyada ko‘rsatiladi)" className="mt-2">
                        <Input value={values[l].caption} onChange={(e) => setAlts({ ...values, [l]: { ...values[l], caption: e.target.value } })} />
                      </Field>
                    </fieldset>
                  ))}
                  <Checkbox label="Fotogalereyada ko‘rsatish" checked={showInGallery} onChange={(e) => setGallery(e.target.checked)} />
                </>
              )}
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={confirm}
        danger
        title="Faylni o‘chirish"
        message={nonBlocking.length > 0 ? <>Fayl {nonBlocking.length} ta joyda ishlatilmoqda. O‘chirilsa, o‘sha joylarda rasm/fayl ko‘rinmay qoladi. Baribir o‘chirilsinmi?</> : <>Fayl butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.</>}
        confirmLabel="Baribir o‘chirish"
        loading={remove.isPending}
        onCancel={() => setConfirm(false)}
        onConfirm={() => void doDelete()}
      />
    </>
  );
}

export default function MediaPage() {
  const toast = useToast();
  const canUpload = useCan('media.write');
  const p = useListParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const query = mediaApi.useList({ page: p.page, pageSize: 24, q: p.get('q') || undefined, kind: p.get('kind') || undefined });
  const upload = mediaApi.useUpload();
  const [uploading, setUploading] = useState(0);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      setUploading((n) => n + 1);
      try {
        await upload.mutateAsync({ file });
        toast.success(`Yuklandi: ${file.name}`);
      } catch (err) {
        toast.error(`Fayl yuklanmadi (${file.name}): ${err instanceof ApiError ? err.message : 'noma’lum xatolik'}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <>
      <PageTitle
        title="Media kutubxonasi"
        actions={
          canUpload && <>
            <input ref={fileRef} id="media-upload" type="file" multiple className="sr-only" accept="image/jpeg,image/png,image/webp,.pdf,.docx,.xlsx,.pptx" onChange={(e) => void onFiles(e.target.files)} />
            <Button icon={<Upload className="h-4 w-4" aria-hidden />} loading={uploading > 0} onClick={() => fileRef.current?.click()}>Fayl yuklash</Button>
          </>
        }
      />
      <Toolbar>
        <SearchBox value={p.get('q')} onChange={(v) => p.set({ q: v || null })} placeholder="Fayl nomi yoki alt matn bo‘yicha qidirish…" />
        <div>
          <label htmlFor="media-kind" className="sr-only">Turi</label>
          <Select id="media-kind" value={p.get('kind')} onChange={(e) => p.set({ kind: e.target.value || null })} className="min-w-40">
            <option value="">Barcha fayllar</option>
            <option value="IMAGE">Rasmlar</option>
            <option value="DOCUMENT">Hujjatlar</option>
          </Select>
        </div>
      </Toolbar>
      <p className="mb-4 text-sm text-muted">Ruxsat etilgan formatlar: JPG, PNG, WEBP, PDF, DOCX, XLSX, PPTX. Fayl turi nomiga emas, haqiqiy tarkibiga qarab tekshiriladi.</p>

      {query.isPending ? <Loading /> : query.isError ? <ErrorState title="Fayllarni yuklab bo‘lmadi" text={query.error.message} onRetry={() => void query.refetch()} /> : query.data.items.length === 0 ? (
        <EmptyState title={p.get('q') || p.get('kind') ? 'Fayl topilmadi' : 'Media kutubxonasi bo‘sh'} text="Rasm yoki hujjat yuklang." action={<Button onClick={() => fileRef.current?.click()}>Fayl yuklash</Button>} />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {query.data.items.map((m: AdminMedia) => (
              <li key={m.id}>
                <button type="button" onClick={() => setSelected(m.id)} className="block w-full overflow-hidden rounded-lg border border-line bg-white text-left shadow-card hover:border-primary-500">
                  {m.thumbUrl || m.url ? <img src={m.thumbUrl ?? m.url ?? ''} alt="" loading="lazy" className="aspect-square w-full object-cover" /> : (
                    <div className="flex aspect-square items-center justify-center bg-surface"><FileText className="h-12 w-12 text-muted" aria-hidden /></div>
                  )}
                  <span className="block truncate px-3 pt-2 text-sm font-medium">{m.originalName}</span>
                  <span className="block px-3 pb-2 text-xs text-muted">{formatBytes(m.size)} · {fmtDate(m.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Pagination className="mt-6" meta={query.data.meta} onPage={(n) => p.set({ page: n > 1 ? String(n) : null }, false)} />
        </>
      )}
      <MediaDetailModal id={selected} onClose={() => setSelected(null)} />
    </>
  );
}
