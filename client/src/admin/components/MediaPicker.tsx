import { FileText, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { AdminMedia, AdminMediaRef } from '@uchkoprik/shared';
import { ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { EmptyState, ErrorState, Loading } from '../../components/ui/Feedback';
import { Input } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { Pagination } from '../../components/ui/Pagination';
import { useToast } from '../../components/ui/Toast';
import { cn } from '../../components/ui/cn';
import { useDebounced } from '../../hooks/useDebounced';
import { mediaApi } from '../api';

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

interface PickerProps {
  open: boolean;
  kind?: 'IMAGE' | 'DOCUMENT';
  title?: string;
  onClose: () => void;
  onSelect: (media: AdminMedia) => void;
}

/** Media kutubxonasidan fayl tanlash (yoki shu yerning o'zida yangisini yuklash). */
export function MediaPicker({ open, kind, title = 'Faylni tanlang', onClose, onSelect }: PickerProps) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const debounced = useDebounced(q, 300);
  const fileRef = useRef<HTMLInputElement>(null);
  const query = mediaApi.useList({ kind, q: debounced || undefined, page, pageSize: 12 });
  const upload = mediaApi.useUpload();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const media = await upload.mutateAsync({ file, kind });
      toast.success('Fayl yuklandi');
      onSelect(media);
    } catch (err) {
      toast.error(`Fayl yuklanmadi: ${err instanceof ApiError ? err.message : 'noma’lum xatolik'}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Modal open={open} title={title} onClose={onClose} size="lg">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-48 flex-1">
          <label htmlFor="picker-search" className="sr-only">Fayl qidirish</label>
          <Input id="picker-search" type="search" placeholder="Fayl nomi yoki alt matn bo‘yicha qidirish…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
        <input ref={fileRef} type="file" className="sr-only" id="picker-upload" accept={kind === 'IMAGE' ? 'image/jpeg,image/png,image/webp' : kind === 'DOCUMENT' ? '.pdf,.docx,.xlsx,.pptx' : 'image/jpeg,image/png,image/webp,.pdf,.docx,.xlsx,.pptx'} onChange={(e) => void onFile(e.target.files?.[0])} />
        <Button loading={upload.isPending} icon={<Upload className="h-4 w-4" aria-hidden />} onClick={() => fileRef.current?.click()}>Yangi fayl yuklash</Button>
      </div>

      {query.isPending ? <Loading /> : query.isError ? (
        <ErrorState title="Fayllarni yuklab bo‘lmadi" onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState title="Fayl topilmadi" text="Yangi fayl yuklang." />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {query.data.items.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onSelect(m)} className="group block w-full overflow-hidden rounded-md border border-line bg-white text-left hover:border-primary-500">
                  {m.thumbUrl || m.url ? (
                    <img src={m.thumbUrl ?? m.url ?? ''} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[4/3] items-center justify-center bg-surface"><FileText className="h-10 w-10 text-muted" aria-hidden /></div>
                  )}
                  <span className="block truncate px-2 pt-1.5 text-sm font-medium">{m.originalName}</span>
                  <span className="block px-2 pb-1.5 text-xs text-muted">{formatBytes(m.size)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Pagination className="mt-4" meta={query.data.meta} onPage={setPage} />
        </>
      )}
    </Modal>
  );
}

interface FieldProps {
  label: string;
  kind: 'IMAGE' | 'DOCUMENT';
  value: string | null | undefined;
  initial?: AdminMediaRef | null | undefined;
  onChange: (id: string | null) => void;
  error?: string | undefined;
  hint?: string;
}

/** Tanlangan faylni ko'rsatadigan va almashtirish/olib tashlash imkonini beradigan maydon. */
export function MediaField({ label, kind, value, initial, onChange, error, hint }: FieldProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<AdminMediaRef | null>(null);
  const display = value ? (picked?.id === value ? picked : initial?.id === value ? initial : null) : null;

  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      <div className={cn('flex items-center gap-3 rounded-md border bg-white p-2', error ? 'border-danger-600' : 'border-line')}>
        {display?.thumbUrl || display?.url ? (
          <img src={display.thumbUrl ?? display.url ?? ''} alt="" className="h-16 w-16 rounded object-cover" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded bg-surface">{value ? <FileText className="h-6 w-6 text-muted" aria-hidden /> : <span className="text-xs text-muted">Yo‘q</span>}</div>
        )}
        <div className="min-w-0 flex-1 text-sm">
          <p className="truncate font-medium">{value ? (display?.originalName ?? 'Tanlangan fayl') : 'Fayl tanlanmagan'}</p>
          {hint && <p className="text-muted">{hint}</p>}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{value ? 'Almashtirish' : 'Tanlash'}</Button>
        {value && (
          <Button size="sm" variant="ghost" aria-label={`${label}: olib tashlash`} onClick={() => { onChange(null); setPicked(null); }}>
            <X className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
      {error && <p role="alert" className="mt-1 text-sm font-medium text-danger-600">{error}</p>}
      <MediaPicker
        open={open}
        kind={kind}
        title={kind === 'IMAGE' ? 'Rasmni tanlang' : 'Hujjat faylini tanlang'}
        onClose={() => setOpen(false)}
        onSelect={(m) => {
          setPicked({ id: m.id, kind: m.kind, originalName: m.originalName, url: m.url, thumbUrl: m.thumbUrl });
          onChange(m.id);
          setOpen(false);
        }}
      />
    </div>
  );
}
