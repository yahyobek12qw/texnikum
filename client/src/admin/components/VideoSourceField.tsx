import { Camera, Link2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { VIDEO_UPLOAD_EXTENSIONS, type AdminMedia, type AdminVideo } from '@uchkoprik/shared';
import { ApiError, uploadWithProgress } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { Field, Input } from '../../components/ui/Form';
import { useToast } from '../../components/ui/Toast';
import { cn } from '../../components/ui/cn';
import { formatBytes } from './MediaPicker';

type Mode = 'link' | 'file';
interface UploadedFile {
  id: string;
  name: string;
  size: number;
  url: string;
}

const ACCEPT = 'video/mp4,video/quicktime,video/webm,.mp4,.m4v,.mov,.webm';

/**
 * Video manbasi: YouTube/Vimeo havolasi YOKI fayl yuklash (kompyuter yoki telefon).
 * Forma qiymatlari: base.sourceUrl (havola) va base.fileMediaId (yuklangan video).
 */
export function VideoSourceField({ form, item, error }: { form: UseFormReturn<any>; item: AdminVideo | null; error: string | undefined }) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const toast = useToast();
  const [mode, setMode] = useState<Mode>(item?.provider === 'UPLOAD' ? 'file' : 'link');
  const [file, setFile] = useState<UploadedFile | null>(item?.file ? { id: item.file.id, name: item.file.originalName, size: item.file.size, url: item.file.url } : null);
  const [progress, setProgress] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const uploading = progress !== null;

  const switchMode = (m: Mode) => {
    if (uploading) return;
    setMode(m);
    // Qaysi manba faol bo'lsa, boshqasi tozalanadi (serverga aynan bittasi yuboriladi)
    if (m === 'link') form.setValue('base.fileMediaId', null);
    else form.setValue('base.sourceUrl', '');
  };

  const onPick = async (picked: File | undefined, input: HTMLInputElement | null) => {
    if (!picked) return;
    if (input) input.value = '';
    const ext = picked.name.split('.').pop()?.toLowerCase() ?? '';
    if (!(VIDEO_UPLOAD_EXTENSIONS as readonly string[]).includes(ext)) {
      toast.error('Faqat MP4, MOV yoki WebM video yuklash mumkin');
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setProgress(0);
    try {
      const media = await uploadWithProgress<AdminMedia>('/api/v1/admin/videos/upload', picked, setProgress, ctrl.signal);
      setFile({ id: media.id, name: media.originalName, size: media.size, url: media.url ?? '' });
      form.setValue('base.fileMediaId', media.id, { shouldDirty: true });
      form.clearErrors('base.sourceUrl');
      toast.success('Video yuklandi. “Saqlash”ni bosing.');
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        toast.error(`Video yuklanmadi: ${err instanceof ApiError ? err.message : 'noma’lum xatolik'}`);
      }
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };

  const removeFile = () => {
    setFile(null);
    form.setValue('base.fileMediaId', null, { shouldDirty: true });
  };

  return (
    <div className="space-y-3">
      <div role="group" aria-label="Video manbasi" className="inline-flex rounded-lg border border-line bg-white p-1">
        {([['file', 'Fayl yuklash', Upload], ['link', 'Havola (YouTube/Vimeo)', Link2]] as const).map(([m, label, Icon]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => switchMode(m)}
            className={cn('inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium', mode === m ? 'bg-primary-600 text-white' : 'text-ink hover:bg-primary-50')}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {mode === 'link' ? (
        <Field label="Video havolasi (YouTube yoki Vimeo)" required error={error} hint="Video YouTube/Vimeo’da qoladi, saytda bosilganda ijro etiladi.">
          <Input type="url" placeholder="https://www.youtube.com/watch?v=…" {...form.register('base.sourceUrl')} />
        </Field>
      ) : (
        <div className="space-y-3">
          <input ref={pickRef} type="file" accept={ACCEPT} className="sr-only" aria-label="Video faylni tanlash" onChange={(e) => void onPick(e.target.files?.[0], e.target)} />
          <input ref={camRef} type="file" accept="video/*" capture="environment" className="sr-only" aria-label="Kamerada video yozib olish" onChange={(e) => void onPick(e.target.files?.[0], e.target)} />

          {uploading ? (
            <div className="space-y-2 rounded-lg border border-line p-3" role="status" aria-live="polite">
              <div className="flex items-center justify-between text-sm">
                <span>Yuklanmoqda… {Math.round((progress ?? 0) * 100)}%</span>
                <Button size="sm" variant="secondary" onClick={() => abortRef.current?.abort()}>Bekor qilish</Button>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-primary-50" aria-hidden>
                <div className="h-full bg-primary-600 transition-[width]" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
              </div>
              <p className="text-xs text-muted">Sahifani yopmang. Katta video uchun biroz vaqt ketadi.</p>
            </div>
          ) : file ? (
            <div className="space-y-2 rounded-lg border border-line p-3">
              {file.url && <video src={file.url} controls preload="metadata" playsInline className="max-h-56 w-full rounded bg-black" aria-label="Yuklangan video ko‘rinishi" />}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="min-w-0 truncate text-sm"><span className="font-medium">{file.name}</span> <span className="text-muted">· {formatBytes(file.size)}</span></p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => pickRef.current?.click()}>Almashtirish</Button>
                  <Button size="sm" variant="ghost" aria-label="Videoni olib tashlash" icon={<X className="h-4 w-4" aria-hidden />} onClick={removeFile} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button icon={<Upload className="h-4 w-4" aria-hidden />} onClick={() => pickRef.current?.click()}>Videoni tanlash</Button>
              <Button variant="secondary" icon={<Camera className="h-4 w-4" aria-hidden />} className="md:hidden" onClick={() => camRef.current?.click()}>Kamerada yozish</Button>
            </div>
          )}

          {error && <p role="alert" className="text-sm text-danger-600">{error}</p>}
          <Alert tone="info">
            Formatlar: MP4, MOV, WebM. Telefondan: galereyadan tanlang yoki kamerada yozing. iPhone’da “Sozlamalar → Kamera → Formatlar → Eng mos” (H.264) tanlansa, video hamma brauzerda ijro etiladi.
          </Alert>
        </div>
      )}
    </div>
  );
}
