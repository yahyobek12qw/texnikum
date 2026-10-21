import { LOCALES, LOCALE_LABELS, LOCALE_SHORT, type Locale } from '@uchkoprik/shared';
import { Link, useLocation } from 'react-router-dom';
import { cn } from './ui/cn';
import { useAlternatesInfo, useLocale, useT } from '../i18n/locale';

/** Joriy sahifaning boshqa tildagi versiyasiga havola yasaydi (tarjima slugi bo'yicha). */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useT();
  const { pathname, search } = useLocation();
  const info = useAlternatesInfo();
  const rest = pathname.split('/').filter(Boolean).slice(1); // tildan keyingi qismlar

  const hrefFor = (l: Locale): { href: string; available: boolean } => {
    if (info) {
      const alt = info.items.find((i) => i.locale === l);
      const slug = alt?.slug ?? rest[rest.length - 1] ?? '';
      return { href: `/${l}/${info.prefix}${slug}`, available: alt?.available ?? false };
    }
    return { href: `/${[l, ...rest].join('/')}${search}`, available: true };
  };

  return (
    <nav aria-label={t('language')} className={cn('flex items-center gap-1', className)}>
      {LOCALES.map((l) => {
        const { href, available } = hrefFor(l);
        const current = l === locale;
        return (
          <Link
            key={l}
            to={href}
            hrefLang={l}
            lang={l}
            aria-current={current ? 'true' : undefined}
            aria-label={`${LOCALE_LABELS[l]}${available ? '' : ` (${t('languageUnavailable')})`}`}
            title={available ? LOCALE_LABELS[l] : `${LOCALE_LABELS[l]} — ${t('languageUnavailable')}`}
            className={cn(
              'inline-flex min-h-9 min-w-10 items-center justify-center rounded px-2 text-sm font-semibold no-underline',
              current ? 'bg-white text-primary-800' : 'text-white hover:bg-white/15',
              !available && !current && 'opacity-70',
            )}
          >
            {LOCALE_SHORT[l]}
            {!available && !current && <span aria-hidden className="ml-0.5 text-[10px]">*</span>}
          </Link>
        );
      })}
    </nav>
  );
}
