import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { DEFAULT_LOCALE, isLocale, type Alternate, type Locale } from '@uchkoprik/shared';
import { formatPublicDate } from '../utils/date';
import { translate, type DictKey } from './dictionary';

/** Admin oldindan ko'rishida (marshrutda til yo'q) tilni qo'lda belgilash uchun. */
const LocaleOverrideCtx = createContext<Locale | null>(null);
export const LocaleOverrideProvider = LocaleOverrideCtx.Provider;

export function useLocale(): Locale {
  const override = useContext(LocaleOverrideCtx);
  // Til marshrutning birinchi segmentidan olinadi (/uz/..., /ru/..., /en/...)
  const { pathname } = useLocation();
  if (override) return override;
  const first = pathname.split('/')[1];
  return isLocale(first) ? first : DEFAULT_LOCALE;
}

export function useT() {
  const locale = useLocale();
  return useCallback((key: DictKey, vars?: Record<string, string | number>) => translate(locale, key, vars), [locale]);
}

export const formatDate = formatPublicDate;

export function formatFileSize(bytes: number, locale: Locale): string {
  if (bytes < 1024 * 1024) return translate(locale, 'fileSizeKb', { n: Math.max(1, Math.round(bytes / 1024)) });
  return translate(locale, 'fileSizeMb', { n: (bytes / 1024 / 1024).toFixed(1) });
}

// ───────────── Til almashtirgich uchun "alternativ sahifalar" konteksti ─────────────

export interface AlternatesInfo {
  /** Slug oldidagi yo'l qismi, masalan "news/" (yangilik uchun) */
  prefix: string;
  items: Alternate[];
}

interface AlternatesCtx {
  info: AlternatesInfo | null;
  set: (v: AlternatesInfo | null) => void;
}
const Ctx = createContext<AlternatesCtx>({ info: null, set: () => undefined });

export function AlternatesProvider({ children }: { children: ReactNode }) {
  const [info, set] = useState<AlternatesInfo | null>(null);
  const value = useMemo(() => ({ info, set }), [info]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAlternatesInfo() {
  return useContext(Ctx).info;
}

/** Sahifa o'z tarjimalari ro'yxatini ro'yxatdan o'tkazadi, til almashtirgich shundan foydalanadi. */
export function useRegisterAlternates(items: Alternate[] | undefined, prefix = '') {
  const { set } = useContext(Ctx);
  const key = items ? JSON.stringify(items) : '';
  useEffect(() => {
    set(items ? { prefix, items } : null);
    return () => set(null);
  }, [key, prefix, set]);
}
