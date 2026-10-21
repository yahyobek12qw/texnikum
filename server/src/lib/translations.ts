import {
  FALLBACK_ORDER,
  LOCALES,
  type Alternate,
  type Locale,
  type TranslationMap,
  type TranslationStatus,
} from '@uchkoprik/shared';

type WithLocale = { locale: Locale };

export function translationStatus(trs: WithLocale[]): TranslationStatus {
  const have = new Set(trs.map((t) => t.locale));
  return { uz: have.has('uz'), ru: have.has('ru'), en: have.has('en') };
}

/** Fallback tartibi: so'ralgan til, so'ng uz → ru → en. Tarjima umuman yo'q bo'lsa null. */
export function resolveTranslation<T extends WithLocale>(
  trs: T[],
  locale: Locale,
): { tr: T; isFallback: boolean } | null {
  const order: Locale[] = [locale, ...FALLBACK_ORDER.filter((l) => l !== locale)];
  for (const l of order) {
    const tr = trs.find((t) => t.locale === l);
    if (tr) return { tr, isFallback: l !== locale };
  }
  return null;
}

export function toTranslationMap<T extends WithLocale, R>(
  trs: T[],
  map: (t: T) => R,
): TranslationMap<R> {
  const out: TranslationMap<R> = {};
  for (const t of trs) out[t.locale] = map(t);
  return out;
}

/** Admin ro'yxatlari uchun sarlavha: uz → ru → en. */
export function adminTitle<T extends WithLocale>(trs: T[], pick: (t: T) => string): string {
  const r = resolveTranslation(trs, 'uz');
  return r ? pick(r.tr) : '—';
}

export function buildAlternates(trs: (WithLocale & { slug: string })[]): Alternate[] {
  return LOCALES.map((locale) => {
    const tr = trs.find((t) => t.locale === locale);
    return { locale, slug: tr?.slug ?? null, available: Boolean(tr) };
  });
}

export interface TranslationPatchArgs<T> {
  patch: Partial<Record<Locale, T | null | undefined>> | undefined;
  existing: Locale[];
  upsert: (locale: Locale, data: T) => Promise<unknown>;
  remove: (locale: Locale) => Promise<unknown>;
}

/** Berilgan tillar upsert qilinadi, `null` berilgan tillar o'chiriladi, berilmaganlari o'zgarmaydi. */
export async function applyTranslationPatch<T>(args: TranslationPatchArgs<T>): Promise<void> {
  if (!args.patch) return;
  for (const locale of LOCALES) {
    const value = args.patch[locale];
    if (value === undefined) continue;
    if (value === null) {
      if (args.existing.includes(locale)) await args.remove(locale);
    } else {
      await args.upsert(locale, value);
    }
  }
}
