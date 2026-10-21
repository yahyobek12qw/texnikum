import { LOCALE_BCP47, type Locale } from '@uchkoprik/shared';

// Brauzerlarda o'zbek (uz) uchun oy nomlari ma'lumotlari to'liq emas, shuning uchun qo'lda beriladi.
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Ommaviy sayt uchun: "20 oktabr 2026" (tilga mos). */
export function formatPublicDate(iso: string | null | undefined, locale: Locale, withTime = false): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const time = withTime ? `, ${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
  if (locale === 'uz') return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}${time}`;
  const date = new Intl.DateTimeFormat(LOCALE_BCP47[locale], { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  return `${date}${time}`;
}

/** Admin panel uchun: "20.10.2026" yoki "20.10.2026 17:07". */
export function formatAdminDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  return withTime ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}
