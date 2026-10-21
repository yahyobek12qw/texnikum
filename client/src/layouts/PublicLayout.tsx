import { ArrowUp, ChevronDown, Mail, MapPin, Menu, Phone, Search, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { PublicNavItem, PublicSettings } from '@uchkoprik/shared';
import { useNavigation, useSettings } from '../api/public';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { SmartLink } from '../components/SmartLink';
import { cn } from '../components/ui/cn';
import { AlternatesProvider, useLocale, useT } from '../i18n/locale';
import { useModules } from '../hooks/useModules';
import { publicApi } from '../api/public';

function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="">
      <rect width="64" height="64" rx="12" fill="#12345B" />
      <path d="M14 46V26l18-10 18 10v20" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M22 46V32h20v14" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinejoin="round" />
      <rect x="28" y="36" width="8" height="10" fill="#087F5B" />
    </svg>
  );
}

function SearchForm({ id, className, onDone }: { id: string; className?: string; onDone?: () => void }) {
  const t = useT();
  const locale = useLocale();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = q.trim();
    if (value.length < 2) return;
    navigate(`/${locale}/search?q=${encodeURIComponent(value)}`);
    onDone?.();
  };
  return (
    <form role="search" onSubmit={submit} className={cn('relative', className)}>
      <label htmlFor={id} className="sr-only">{t('search')}</label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="h-11 w-full rounded-md border border-line bg-surface pl-3 pr-11 text-base text-ink placeholder:text-muted focus:bg-white"
      />
      <button type="submit" aria-label={t('search')} className="absolute right-1 top-1 inline-flex h-9 w-9 items-center justify-center rounded text-primary-700 hover:bg-primary-50">
        <Search className="h-5 w-5" aria-hidden />
      </button>
    </form>
  );
}

function DesktopNav({ items }: { items: PublicNavItem[] }) {
  const { pathname } = useLocation();
  return (
    <ul className="flex flex-wrap items-center">
      {items.map((item) => {
        const active = pathname === item.href || item.children.some((c) => c.href === pathname);
        return (
          <li key={item.id} className="group relative">
            <SmartLink
              href={item.href}
              newTab={item.newTab}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-12 items-center gap-1 border-b-[3px] px-3 text-[0.92rem] font-medium no-underline xl:px-3.5',
                active ? 'border-accent-600 text-primary-800' : 'border-transparent text-ink hover:border-primary-200 hover:text-primary-700',
              )}
            >
              {item.label}
              {item.children.length > 0 && <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />}
            </SmartLink>
            {item.children.length > 0 && (
              <ul
                aria-label={item.label}
                className="invisible absolute left-0 top-full z-50 min-w-64 rounded-b-md border border-t-2 border-line border-t-accent-600 bg-white py-2 opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
              >
                {item.children.map((c) => (
                  <li key={c.id}>
                    <SmartLink
                      href={c.href}
                      newTab={c.newTab}
                      showExternalIcon={c.external}
                      aria-current={pathname === c.href ? 'page' : undefined}
                      className={cn('block px-4 py-2 text-[0.92rem] no-underline hover:bg-surface', pathname === c.href ? 'font-semibold text-primary-800' : 'text-ink')}
                    >
                      {c.label}
                    </SmartLink>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MobileNav({ items, onNavigate }: { items: PublicNavItem[]; onNavigate: () => void }) {
  const { pathname } = useLocation();
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id} className="py-1">
          <SmartLink
            href={item.href}
            newTab={item.newTab}
            onClick={onNavigate}
            aria-current={pathname === item.href ? 'page' : undefined}
            className={cn('block px-1 py-2.5 text-[1.05rem] font-semibold no-underline', pathname === item.href ? 'text-accent-700' : 'text-primary-800')}
          >
            {item.label}
          </SmartLink>
          {item.children.length > 0 && (
            <ul className="mb-2 ml-2 border-l-2 border-line pl-3">
              {item.children.map((c) => (
                <li key={c.id}>
                  <SmartLink href={c.href} newTab={c.newTab} showExternalIcon={c.external} onClick={onNavigate} aria-current={pathname === c.href ? 'page' : undefined} className={cn('block py-2 text-base no-underline', pathname === c.href ? 'font-semibold text-primary-800' : 'text-ink')}>
                    {c.label}
                  </SmartLink>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function TopStrips({ settings }: { settings: PublicSettings | undefined }) {
  const t = useT();
  return (
    <>
      {settings?.topBar && (
        <div className="bg-accent-700 text-white">
          <div className="container-page flex items-center justify-center gap-3 py-1.5 text-sm">
            <p>{settings.topBar.text}</p>
            {settings.topBar.linkUrl && (
              <SmartLink href={settings.topBar.linkUrl} className="whitespace-nowrap font-semibold text-white underline">
                {t('topBarMore')}
              </SmartLink>
            )}
          </div>
        </div>
      )}
      <div className="bg-primary-800 text-white">
        <div className="container-page flex items-center justify-between gap-x-6 py-1 text-sm">
          <div className="hidden items-center gap-5 md:flex">
            {settings?.phones?.[0] && (
              <a href={`tel:${settings.phones[0].replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 text-white no-underline hover:underline">
                <Phone className="h-3.5 w-3.5" aria-hidden /> {settings.phones[0]}
              </a>
            )}
            {settings?.email && (
              <a href={`mailto:${settings.email}`} className="inline-flex items-center gap-1.5 text-white no-underline hover:underline">
                <Mail className="h-3.5 w-3.5" aria-hidden /> {settings.email}
              </a>
            )}
          </div>
          <LanguageSwitcher className="ml-auto" />
        </div>
      </div>
    </>
  );
}

/** Mobilda yopishqoq (menyu doim qo'l ostida), desktopda oddiy. */
function BrandBar({ settings, nav }: { settings: PublicSettings | undefined; nav: PublicNavItem[] }) {
  const t = useT();
  const { modules } = useModules();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  const name = settings?.officialName || t('siteNameFallback');

  return (
    <div className="sticky top-0 z-50 border-b border-line bg-white lg:static">
      <div className="container-page flex items-center gap-3 py-2.5 sm:gap-4 sm:py-3.5">
        <Link to={`/${locale}`} className="flex min-w-0 flex-1 items-center gap-3 no-underline lg:flex-none lg:basis-[28rem]">
          {settings?.logo ? (
            <img src={settings.logo.url} alt="" width={56} height={56} className="h-11 w-11 shrink-0 object-contain sm:h-14 sm:w-14" />
          ) : (
            <BrandMark className="h-11 w-11 shrink-0 sm:h-14 sm:w-14" />
          )}
          <span className="min-w-0">
            <span className="eyebrow hidden sm:block">{t('officialPortal')}</span>
            <span className="block text-[0.95rem] font-semibold leading-tight text-primary-800 sm:text-lg">{name}</span>
          </span>
        </Link>
        {modules.search && <SearchForm id="site-search-desktop" className="ml-auto hidden w-full max-w-sm md:block" />}
        {!modules.search && <div className="ml-auto hidden md:block" />}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md border border-line px-3 font-medium text-primary-700 lg:hidden"
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          <span className="max-[380px]:sr-only">{open ? t('closeMenu') : t('menu')}</span>
        </button>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label={t('mainNavigation')} className="border-t border-line bg-white lg:hidden">
          <div className="container-page max-h-[calc(100vh-4.5rem)] overflow-y-auto py-3">
            {modules.search && <SearchForm id="site-search-mobile" className="mb-3 md:hidden" onDone={() => setOpen(false)} />}
            <MobileNav items={nav} onNavigate={() => setOpen(false)} />
          </div>
        </nav>
      )}
    </div>
  );
}

function Footer({ settings, main, footer }: { settings: PublicSettings | undefined; main: PublicNavItem[]; footer: PublicNavItem[] }) {
  const t = useT();
  const year = new Date().getFullYear();
  const name = settings?.officialName || t('siteNameFallback');
  const social = settings?.social ? Object.entries(settings.social).filter(([, url]) => url) : [];
  const socialLabels: Record<string, string> = { telegram: 'Telegram', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube' };
  const linkCls = 'text-primary-100 underline-offset-2 hover:text-white hover:underline';

  return (
    <footer className="mt-auto bg-primary-800 text-white">
      <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.3fr] lg:gap-10">
        <div>
          <p className="text-lg font-semibold text-white">{name}</p>
          {settings?.footerText && <p className="mt-2 text-sm leading-relaxed text-primary-100">{settings.footerText}</p>}
          {social.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label={t('followUs')}>
              {social.map(([k, url]) => (
                <li key={k}><a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center rounded-md border border-white/25 px-3 text-sm text-white no-underline hover:bg-white/10">{socialLabels[k] ?? k}</a></li>
              ))}
            </ul>
          )}
        </div>
        {main.length > 0 && (
          <nav aria-label={t('sections')}>
            <h2 className="eyebrow mb-3 !text-primary-200">{t('sections')}</h2>
            <ul className="space-y-2 text-sm">
              {main.slice(0, 8).map((i) => (
                <li key={i.id}><SmartLink href={i.href} newTab={i.newTab} className={linkCls}>{i.label}</SmartLink></li>
              ))}
            </ul>
          </nav>
        )}
        {footer.length > 0 && (
          <nav aria-label={t('footerNavigation')}>
            <h2 className="eyebrow mb-3 !text-primary-200">{t('quickLinks')}</h2>
            <ul className="space-y-2 text-sm">
              {footer.map((i) => (
                <li key={i.id}><SmartLink href={i.href} newTab={i.newTab} showExternalIcon={i.external} className={linkCls}>{i.label}</SmartLink></li>
              ))}
            </ul>
          </nav>
        )}
        <div>
          <h2 className="eyebrow mb-3 !text-primary-200">{t('contactInfo')}</h2>
          <ul className="space-y-2.5 text-sm text-primary-100">
            {settings?.address && <li className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /><span>{settings.address}</span></li>}
            {settings?.phones.map((p) => (
              <li key={p} className="flex items-center gap-2"><Phone className="h-4 w-4 shrink-0" aria-hidden /><a href={`tel:${p.replace(/[^\d+]/g, '')}`} className="text-white">{p}</a></li>
            ))}
            {settings?.email && <li className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0" aria-hidden /><a href={`mailto:${settings.email}`} className="break-all text-white">{settings.email}</a></li>}
            {settings?.workingHours && <li className="whitespace-pre-line pl-6">{settings.workingHours}</li>}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/15">
        <div className="container-page flex flex-wrap items-center justify-between gap-3 py-4 text-sm text-primary-100">
          <p>© {year} {name}. {t('rightsFooter')}</p>
          <a href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0 }); }} className="inline-flex items-center gap-1.5 text-white no-underline hover:underline">
            <ArrowUp className="h-4 w-4" aria-hidden /> {t('backToTop')}
          </a>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout() {
  return (
    <AlternatesProvider>
      <PublicShell />
    </AlternatesProvider>
  );
}

function PublicShell() {
  const locale = useLocale();
  const t = useT();
  const settings = useSettings(locale);
  const navigation = useNavigation(locale);
  const { pathname } = useLocation();

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem('locale', locale);
    } catch {
      // saqlash mavjud emas
    }
  }, [locale]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  // Ko'rishlar hisoblagichi: cookie yo'q, faqat sahifa yo'li yuboriladi; "Do Not Track" hurmat qilinadi
  useEffect(() => {
    if (navigator.doNotTrack === '1') return;
    const timer = window.setTimeout(() => void publicApi.track(pathname).catch(() => undefined), 800);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const main = navigation.data?.main ?? [];
  return (
    <div id="top" className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">{t('skipToContent')}</a>
      <header>
        <TopStrips settings={settings.data} />
      </header>
      <BrandBar settings={settings.data} nav={main} />
      <nav aria-label={t('mainNavigation')} className="sticky top-0 z-40 hidden border-b border-line bg-white shadow-sm lg:block">
        <div className="container-page"><DesktopNav items={main} /></div>
      </nav>
      <main id="main" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <Footer settings={settings.data} main={main} footer={navigation.data?.footer ?? []} />
    </div>
  );
}
