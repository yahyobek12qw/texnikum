export const LOCALES = ['uz', 'ru', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'uz';

/** Tarjima mavjud bo'lmasa, qaysi tartibda boshqa tilga o'tiladi (so'ralgan til doim birinchi). */
export const FALLBACK_ORDER: readonly Locale[] = ['uz', 'ru', 'en'];

export const LOCALE_LABELS: Record<Locale, string> = {
  uz: 'O‘zbekcha',
  ru: 'Русский',
  en: 'English',
};

export const LOCALE_SHORT: Record<Locale, string> = { uz: 'UZ', ru: 'RU', en: 'EN' };

/** Sana formatlash uchun BCP-47 teglari. */
export const LOCALE_BCP47: Record<Locale, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export type Localized<T = string> = Record<Locale, T>;

export function emptyLocalized(): Localized {
  return { uz: '', ru: '', en: '' };
}

/** Lokalizatsiya qilingan qiymatdan tilga mos matnni tanlaydi; bo'sh bo'lsa fallback tartibida keyingisini oladi. */
export function pickLocalized(
  value: Partial<Record<Locale, string | null | undefined>> | null | undefined,
  locale: Locale,
): string {
  if (!value) return '';
  const order: Locale[] = [locale, ...FALLBACK_ORDER.filter((l) => l !== locale)];
  for (const l of order) {
    const v = value[l];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return '';
}
