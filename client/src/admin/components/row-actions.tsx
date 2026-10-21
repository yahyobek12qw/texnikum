import { Archive, Eye, EyeOff, Pencil, Send, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { ContentStatus } from '@uchkoprik/shared';
import { ApiError } from '../../api/client';
import { ConfirmDialog } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { cn } from '../../components/ui/cn';
import { useCan } from '../auth';

export function IconButton({ label, onClick, to, danger, disabled, children }: { label: string; onClick?: () => void; to?: string; danger?: boolean; disabled?: boolean; children: ReactNode }) {
  const cls = cn(
    'inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-white text-primary-700 hover:bg-surface disabled:opacity-40',
    danger && 'text-danger-600 hover:bg-danger-50',
  );
  if (to) return <Link to={to} aria-label={label} title={label} className={cls}>{children}</Link>;
  return <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className={cls}>{children}</button>;
}

type StatusAction = 'publish' | 'unpublish' | 'archive';

interface Mutations<Row extends { id: string }> {
  action?: { mutateAsync: (v: { id: string; action: StatusAction }) => Promise<unknown>; isPending: boolean };
  remove: { mutateAsync: (id: string) => Promise<unknown>; isPending: boolean };
  /** "Sahifa", "Yangilik" kabi nom */
  noun: string;
  title: (row: Row) => string;
}

const DONE: Record<StatusAction, string> = {
  publish: 'nashr qilindi',
  unpublish: 'nashrdan qaytarildi (qoralama)',
  archive: 'arxivlandi',
};

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'So‘rov bajarilmadi, qayta urinib ko‘ring.';
}

/** Jadval qatori uchun nashr/arxiv/o'chirish amallari va o'chirishni tasdiqlash oynasi. */
export function useRowActions<Row extends { id: string }>(m: Mutations<Row>) {
  const toast = useToast();
  const [deleting, setDeleting] = useState<Row | null>(null);

  const run = async (row: Row, a: StatusAction) => {
    try {
      await m.action!.mutateAsync({ id: row.id, action: a });
      toast.success(`${m.noun} ${DONE[a]}`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const dialog = (
    <ConfirmDialog
      open={Boolean(deleting)}
      danger
      title={`${m.noun}ni o‘chirish`}
      message={<>“{deleting ? m.title(deleting) : ''}” butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.</>}
      confirmLabel="O‘chirish"
      loading={m.remove.isPending}
      onCancel={() => setDeleting(null)}
      onConfirm={async () => {
        if (!deleting) return;
        try {
          await m.remove.mutateAsync(deleting.id);
          toast.success(`${m.noun} o‘chirildi`);
        } catch (err) {
          toast.error(errorMessage(err));
        } finally {
          setDeleting(null);
        }
      }}
    />
  );
  return { run, askDelete: setDeleting, dialog };
}

interface RowButtonsProps<Row extends { id: string }> {
  row: Row;
  status: ContentStatus;
  editTo?: string;
  onEdit?: () => void;
  actions: ReturnType<typeof useRowActions<Row>>;
  previewTo?: string;
  noStatus?: boolean;
}

export function RowButtons<Row extends { id: string }>({ row, status, editTo, onEdit, previewTo, actions, noStatus }: RowButtonsProps<Row>) {
  const canPublish = useCan('content.publish');
  const canDelete = useCan('content.delete');
  return (
    <div className="flex flex-nowrap items-center gap-1.5">
      <IconButton label="Tahrirlash" {...(editTo ? { to: editTo } : { onClick: onEdit })}><Pencil className="h-4 w-4" aria-hidden /></IconButton>
      {previewTo && <IconButton label="Oldindan ko‘rish" to={previewTo}><Eye className="h-4 w-4" aria-hidden /></IconButton>}
      {!noStatus && canPublish && (status === 'PUBLISHED' ? (
        <IconButton label="Nashrdan qaytarish" onClick={() => void actions.run(row, 'unpublish')}><EyeOff className="h-4 w-4" aria-hidden /></IconButton>
      ) : (
        <IconButton label="Nashr qilish" onClick={() => void actions.run(row, 'publish')}><Send className="h-4 w-4" aria-hidden /></IconButton>
      ))}
      {!noStatus && canPublish && status !== 'ARCHIVED' && (
        <IconButton label="Arxivlash" onClick={() => void actions.run(row, 'archive')}><Archive className="h-4 w-4" aria-hidden /></IconButton>
      )}
      {canDelete && <IconButton label="O‘chirish" danger onClick={() => actions.askDelete(row)}><Trash2 className="h-4 w-4" aria-hidden /></IconButton>}
    </div>
  );
}
