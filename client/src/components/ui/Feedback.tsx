import { CircleAlert, Info, LoaderCircle, TriangleAlert, CircleCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from './cn';
import { Button } from './Button';

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('h-5 w-5 animate-spin text-primary-600', className)} aria-hidden />;
}

export function Loading({ label = 'Yuklanmoqda…', className }: { label?: string; className?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-3 py-12 text-muted', className)}>
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

interface StateProps {
  title: string;
  text?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ title, text, action, className }: StateProps) {
  return (
    <div className={cn('rounded-lg border border-dashed border-line bg-surface/60 px-6 py-10 text-center', className)}>
      <Info className="mx-auto mb-3 h-8 w-8 text-muted" aria-hidden />
      <p className="text-lg font-medium text-ink">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-xl text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

interface ErrorStateProps {
  title: string;
  text?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title, text, retryLabel = 'Qayta urinish', onRetry, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('rounded-lg border border-danger-600/30 bg-danger-50 px-6 py-8 text-center', className)}>
      <CircleAlert className="mx-auto mb-3 h-8 w-8 text-danger-600" aria-hidden />
      <p className="text-lg font-medium text-danger-700">{title}</p>
      {text && <p className="mx-auto mt-1 max-w-xl text-ink">{text}</p>}
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

type AlertTone = 'info' | 'warn' | 'success' | 'danger';
const tones: Record<AlertTone, { box: string; icon: ReactNode }> = {
  info: { box: 'border-primary-200 bg-primary-50 text-primary-800', icon: <Info className="h-5 w-5" aria-hidden /> },
  warn: { box: 'border-warn-700/30 bg-warn-50 text-warn-700', icon: <TriangleAlert className="h-5 w-5" aria-hidden /> },
  success: { box: 'border-accent-600/30 bg-accent-50 text-accent-700', icon: <CircleCheck className="h-5 w-5" aria-hidden /> },
  danger: { box: 'border-danger-600/30 bg-danger-50 text-danger-700', icon: <CircleAlert className="h-5 w-5" aria-hidden /> },
};

export function Alert({ tone = 'info', children, className }: { tone?: AlertTone; children: ReactNode; className?: string }) {
  const t = tones[tone];
  return (
    <div role={tone === 'danger' ? 'alert' : 'note'} className={cn('flex items-start gap-3 rounded-md border px-4 py-3 text-sm', t.box, className)}>
      <span className="mt-0.5 shrink-0">{t.icon}</span>
      <div>{children}</div>
    </div>
  );
}

type BadgeTone = 'neutral' | 'success' | 'warn' | 'danger' | 'info';
const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-surface text-ink border-line',
  success: 'bg-accent-50 text-accent-700 border-accent-600/30',
  warn: 'bg-warn-50 text-warn-700 border-warn-700/30',
  danger: 'bg-danger-50 text-danger-700 border-danger-600/30',
  info: 'bg-primary-50 text-primary-700 border-primary-200',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium', badgeTones[tone], className)}>
      {children}
    </span>
  );
}
