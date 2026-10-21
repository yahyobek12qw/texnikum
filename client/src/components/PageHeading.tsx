import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Breadcrumb, TranslationInfo } from '@uchkoprik/shared';
import { LOCALE_LABELS } from '@uchkoprik/shared';
import { useLocale, useT } from '../i18n/locale';
import { Alert } from './ui/Feedback';

export function Breadcrumbs({ trail, current }: { trail: Breadcrumb[]; current: string }) {
  const t = useT();
  const locale = useLocale();
  return (
    <nav aria-label={t('breadcrumbs')} className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1">
        <li><Link to={`/${locale}`} className="text-muted underline-offset-2 hover:underline">{t('home')}</Link></li>
        {trail.map((b) => (
          <li key={b.href} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            <Link to={b.href} className="text-muted underline-offset-2 hover:underline">{b.title}</Link>
          </li>
        ))}
        <li className="flex min-w-0 items-center gap-1" aria-current="page">
          <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="truncate text-ink">{current}</span>
        </li>
      </ol>
    </nav>
  );
}

/** Tarjima mavjud bo'lmaganda foydalanuvchiga asl til haqida aniq xabar beradi. */
export function TranslationNotice({ info }: { info: TranslationInfo }) {
  const t = useT();
  if (!info.isFallback) return null;
  return (
    <Alert tone="warn" className="mb-6">
      {t('translationNotice', { requested: LOCALE_LABELS[info.requestedLocale], actual: LOCALE_LABELS[info.locale] })}
    </Alert>
  );
}

interface Props {
  title: string;
  trail?: Breadcrumb[];
  lead?: ReactNode;
  children?: ReactNode;
}

export function PageHeading({ title, trail, lead, children }: Props) {
  return (
    <div className="border-b border-line bg-surface">
      <div className="container-page py-5 sm:py-8">
        {trail && <Breadcrumbs trail={trail} current={title} />}
        <h1 className="mt-2 text-2xl leading-tight sm:mt-3 sm:text-4xl">{title}</h1>
        {lead && <p className="mt-2 max-w-3xl text-lg text-muted">{lead}</p>}
        {children}
      </div>
    </div>
  );
}
