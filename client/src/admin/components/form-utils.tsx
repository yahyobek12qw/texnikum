import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { LOCALES, LOCALE_LABELS, type Locale } from '@uchkoprik/shared';
import { ApiError } from '../../api/client';
import { Badge } from '../../components/ui/Feedback';
import { Tabs, type TabItem } from '../../components/ui/Tabs';
import type { ReactNode } from 'react';

export interface IssueLike {
  path: string | (string | number | symbol)[];
  message: string;
}

const pathOf = (p: IssueLike['path']) => (Array.isArray(p) ? p.map(String).join('.') : p);

/** Zod yoki server (VALIDATION_ERROR) xatoliklarini forma maydonlariga bog'laydi. Qaytaradi: xatolik bor tillar. */
export function applyIssues<T extends FieldValues>(form: UseFormReturn<T>, issues: IssueLike[]): Set<Locale> {
  const locales = new Set<Locale>();
  let first = true;
  for (const issue of issues) {
    const path = pathOf(issue.path);
    const m = /^translations\.(uz|ru|en)\b/.exec(path);
    if (m) locales.add(m[1] as Locale);
    form.setError(path as Path<T>, { type: 'server', message: issue.message }, { shouldFocus: first });
    first = false;
  }
  return locales;
}

export function serverIssues(err: unknown): IssueLike[] | null {
  if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && Array.isArray(err.details)) {
    return err.details as IssueLike[];
  }
  return null;
}

/** Slug takrorlanishi kabi 409 xatolarini tegishli tildagi slug maydoniga yo'naltiradi. */
export function isSlugConflict(err: unknown): boolean {
  return err instanceof ApiError && (err.code === 'SLUG_TAKEN' || err.code === 'SLUG_RESERVED');
}

export const firstEmptyOrFilled = <T,>(v: T | undefined | null): v is T => v !== undefined && v !== null;

interface LocaleTabsProps {
  active: Locale;
  onChange: (l: Locale) => void;
  filled: Record<Locale, boolean>;
  errors?: Partial<Record<Locale, boolean>>;
  children: (l: Locale) => ReactNode;
}

/** Uch tilli tahrir uchun til varaqlari: har bir tilda matn borligi va xatolik belgisi ko'rsatiladi. */
export function LocaleTabs({ active, onChange, filled, errors, children }: LocaleTabsProps) {
  const tabs: TabItem<Locale>[] = LOCALES.map((l) => ({
    key: l,
    label: LOCALE_LABELS[l],
    badge: errors?.[l] ? <Badge tone="danger">Xato</Badge> : filled[l] ? <Badge tone="success">Bor</Badge> : <Badge>{l === 'uz' ? 'Majburiy' : 'Yo‘q'}</Badge>,
  }));
  return (
    <Tabs tabs={tabs} active={active} onChange={onChange} label="Tarjima tillari">
      {children}
    </Tabs>
  );
}
