import {
  Calendar, ChevronLeft, ChevronRight, Clock, Pause, Play, ExternalLink, GraduationCap, Handshake, Images, Link2, Mail, MapPin, Megaphone, Newspaper, Phone,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LOCALE_BCP47, isRouteEnabled, type PublicBanner, type PublicNewsItem, type PublicSettings } from '@uchkoprik/shared';
import { useAlumni, useGallery, useNewsList, usePartners, usePublicDocuments, useSettings, useVideos } from '../api/public';
import { QueryBoundary } from '../components/QueryBoundary';
import { SmartLink } from '../components/SmartLink';
import { buttonClass } from '../components/ui/Button';
import { EmptyState, Loading } from '../components/ui/Feedback';
import { cn } from '../components/ui/cn';
import { DocumentRow } from '../features/documents/DocumentsBrowser';
import { VideoCard } from '../features/gallery/VideoCard';
import { NewsCard, NewsLine, newsHref } from '../features/news/NewsCard';
import { ProgramsList } from '../features/programs/ProgramsList';
import { useModules } from '../hooks/useModules';
import { useSeo } from '../hooks/useSeo';
import { useLocale, useT } from '../i18n/locale';
import type { DictKey } from '../i18n/dictionary';
import { AlumnusCard, PartnerCard } from './AlumniPartnersPages';

function Section({ title, action, children, tone = 'white', id }: { title: string; action?: ReactNode; children: ReactNode; tone?: 'white' | 'surface'; id?: string }) {
  return (
    <section aria-labelledby={id} className={cn('section-y', tone === 'surface' && 'bg-surface')}>
      <div className="container-page">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3 sm:mb-8">
          <h2 id={id} className="section-title">{title}</h2>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}

const allLink = (to: string, label: string) => <Link to={to} className={buttonClass('secondary', 'sm')}>{label}</Link>;

// ───────────── Hero ─────────────

/** Bannerlar almashish oralig'i (ms) */
const BANNER_INTERVAL = 6000;

export function Hero({ banners, settings }: { banners: PublicBanner[]; settings: PublicSettings | undefined }) {
  const t = useT();
  const [index, setIndex] = useState(0);
  // Foydalanuvchi pauza bosgan yoki harakatni kamaytirish sozlamasi yoqilgan bo'lsa, avtomatik almashmaydi
  const [paused, setPaused] = useState(() => typeof window !== 'undefined' && (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false));
  const [hover, setHover] = useState(false);
  const count = banners.length;
  const name = settings?.officialName || t('siteNameFallback');

  useEffect(() => {
    if (count < 2 || paused || hover) return;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), BANNER_INTERVAL);
    return () => clearTimeout(timer);
  }, [index, count, paused, hover]);

  if (banners.length === 0) {
    return (
      <section aria-label={name} className="bg-primary-700 text-white">
        <div className="container-page py-12 pb-20 sm:py-20 sm:pb-28">
          <p className="eyebrow !text-primary-100">{t('officialPortal')}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold leading-tight text-white sm:text-5xl">{name}</h1>
          {settings?.seo.defaultDescription && <p className="mt-4 max-w-2xl text-base text-primary-100 sm:text-lg">{settings.seo.defaultDescription}</p>}
        </div>
      </section>
    );
  }

  const b = banners[Math.min(index, banners.length - 1)]!;
  const go = (delta: number) => setIndex((i) => (i + delta + banners.length) % banners.length);
  return (
    <section
      aria-roledescription="carousel"
      aria-label={name}
      className="relative bg-primary-800 text-white"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <h1 className="sr-only">{name}</h1>
      <div className="relative min-h-[17rem] sm:min-h-[24rem] lg:min-h-[28rem]">
        {b.image && <img key={b.id} src={b.image.url} alt={b.image.alt} className="banner-fade absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-primary-900/90 via-primary-900/60 to-primary-900/20" aria-hidden />
        <div className="container-page relative flex min-h-[17rem] items-center pb-16 pt-8 sm:min-h-[24rem] sm:pb-20 lg:min-h-[28rem]" aria-live={paused || hover ? 'polite' : 'off'}>
          <div className="max-w-2xl">
            {b.title && <h2 className="text-2xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl">{b.title}</h2>}
            {b.text && <p className="mt-3 text-base text-white/90 sm:mt-4 sm:text-lg">{b.text}</p>}
            {b.linkUrl && <SmartLink href={b.linkUrl} className={buttonClass('accent', 'lg', 'mt-5 sm:mt-6')}>{t('readMore')}</SmartLink>}
          </div>
        </div>
      </div>
      {banners.length > 1 && (
        <div className="container-page absolute inset-x-0 bottom-14 flex items-center justify-between sm:bottom-16">
          <div className="flex gap-1.5">
            {banners.map((x, i) => (
              <button key={x.id} type="button" aria-label={t('bannerGoto', { n: i + 1 })} aria-current={i === index} onClick={() => setIndex(i)} className={cn('h-2.5 rounded-full transition-all', i === index ? 'w-8 bg-white' : 'w-5 bg-white/45 hover:bg-white/70')} />
            ))}
          </div>
          <div className="flex gap-2">
            <button type="button" aria-label={paused ? t('bannerPlay') : t('bannerPause')} aria-pressed={paused} onClick={() => setPaused((p) => !p)} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30">
              {paused ? <Play className="h-4 w-4" aria-hidden /> : <Pause className="h-4 w-4" aria-hidden />}
            </button>
            <button type="button" aria-label={t('bannerPrev')} onClick={() => go(-1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"><ChevronLeft className="h-5 w-5" aria-hidden /></button>
            <button type="button" aria-label={t('bannerNext')} onClick={() => go(1)} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"><ChevronRight className="h-5 w-5" aria-hidden /></button>
          </div>
        </div>
      )}
    </section>
  );
}

// ───────────── Tezkor havolalar (qat'iy marshrutlar; faqat yoqilgan modullar) ─────────────

const QUICK: { path: string; key: DictKey; Icon: LucideIcon }[] = [
  { path: '/news', key: 'newsTitle', Icon: Newspaper },
  { path: '/announcements', key: 'announcementsTitle', Icon: Megaphone },
  { path: '/events', key: 'eventsTitle', Icon: Calendar },
  { path: '/gallery', key: 'galleryTitle', Icon: Images },
  { path: '/alumni', key: 'alumniTitle', Icon: GraduationCap },
  { path: '/partners', key: 'partnersTitle', Icon: Handshake },
  { path: '/useful-links', key: 'usefulLinksTitle', Icon: Link2 },
  { path: '/contacts', key: 'contactsTitle', Icon: Phone },
];

function QuickLinks() {
  const locale = useLocale();
  const t = useT();
  const { modules } = useModules();
  const items = QUICK.filter((q) => isRouteEnabled(q.path, modules));
  if (items.length === 0) return null;
  return (
    <nav aria-label={t('quickLinks')} className="container-page relative z-10 -mt-12 sm:-mt-14">
      <ul className="grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-[repeat(auto-fit,minmax(7.5rem,1fr))]">
        {items.map(({ path, key, Icon }) => (
          <li key={path}>
            <Link to={`/${locale}${path}`} className="card-link flex h-full min-h-20 flex-col items-center justify-center gap-1.5 px-2 py-3 text-center text-[0.8rem] font-medium leading-tight text-primary-800 sm:min-h-24 sm:text-sm">
              <Icon className="h-6 w-6 text-accent-600 sm:h-7 sm:w-7" aria-hidden />
              {t(key)}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ───────────── "Raqamlarda": qiymatlarni administrator kiritadi ─────────────

function StatsStrip({ settings }: { settings: PublicSettings | undefined }) {
  const t = useT();
  const items = settings?.statistics ?? [];
  if (items.length === 0) return null;
  return (
    <section aria-label={t('statsSection')} className="bg-primary-800 text-white">
      <div className="container-page py-8 sm:py-10">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-6 text-center sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
          {items.map((s) => (
            <li key={s.id}>
              <p className="text-3xl font-semibold text-white sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-primary-100">{s.label}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ───────────── Yangiliklar + yon ustun ─────────────

function NewsSection() {
  const locale = useLocale();
  const t = useT();
  const query = useNewsList({ locale, type: 'NEWS', pageSize: 5 });
  return (
    <div className="min-w-0">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <h2 id="latest-news" className="section-title">{t('latestNews')}</h2>
        {allLink(`/${locale}/news`, t('allNews'))}
      </div>
      <QueryBoundary query={query}>
        {(data) => {
          if (data.items.length === 0) return <EmptyState title={t('noNews')} />;
          const [first, ...rest] = data.items as [PublicNewsItem, ...PublicNewsItem[]];
          return (
            <div className="space-y-4 sm:space-y-5">
              <NewsCard item={first} featured />
              {rest.length > 0 && (
                <ul className="grid gap-3 sm:grid-cols-2 sm:gap-5">
                  {rest.map((n) => <li key={n.id} className="flex"><NewsCard item={n} className="w-full" /></li>)}
                </ul>
              )}
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}

function EventDate({ iso }: { iso: string }) {
  const locale = useLocale();
  const d = new Date(iso);
  const month = d.toLocaleDateString(LOCALE_BCP47[locale], { month: 'short' });
  const uzMonths = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
  return (
    <span aria-hidden className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-md bg-accent-50 text-accent-700">
      <span className="text-xl font-semibold leading-none">{d.getDate()}</span>
      <span className="mt-0.5 text-[0.7rem] font-medium uppercase">{locale === 'uz' ? uzMonths[d.getMonth()] : month.replace('.', '')}</span>
    </span>
  );
}

function ImportantCard() {
  const locale = useLocale();
  const t = useT();
  const important = useNewsList({ locale, important: true, pageSize: 4 });
  return (
    <section className="card border-t-4 border-t-warn-700 p-5" aria-labelledby="side-important">
      <h2 id="side-important" className="mb-1 text-lg">{t('importantAnnouncements')}</h2>
      {important.isPending ? <Loading /> : important.isError ? null : important.data.items.length === 0 ? (
        <p className="py-3 text-sm text-muted">{t('noImportant')}</p>
      ) : (
        <ul className="divide-y divide-line">{important.data.items.map((n) => <NewsLine key={n.id} item={n} />)}</ul>
      )}
      <Link to={`/${locale}/announcements`} className="mt-2 inline-block text-sm font-medium">{t('allAnnouncements')} →</Link>
    </section>
  );
}

function EventsCard() {
  const locale = useLocale();
  const t = useT();
  const events = useNewsList({ locale, type: 'EVENT', pageSize: 3 });
  return (
    <section className="card border-t-4 border-t-accent-600 p-5" aria-labelledby="side-events">
      <h2 id="side-events" className="mb-3 text-lg">{t('upcomingEvents')}</h2>
      {events.isPending ? <Loading /> : events.isError ? null : events.data.items.length === 0 ? (
        <p className="py-3 text-sm text-muted">{t('noUpcoming')}</p>
      ) : (
        <ul className="space-y-3">
          {events.data.items.map((e) => (
            <li key={e.id} className="flex gap-3">
              <EventDate iso={e.eventAt ?? e.publishedAt} />
              <div className="min-w-0">
                <Link to={newsHref(locale, e)} className="font-medium leading-snug text-primary-800 no-underline hover:underline" lang={e.isFallback ? e.locale : undefined}>{e.title}</Link>
                {e.category && <p className="text-xs text-muted">{e.category.name}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Link to={`/${locale}/events`} className="mt-3 inline-block text-sm font-medium">{t('allEvents')} →</Link>
    </section>
  );
}

function AboutBlock({ settings, tone }: { settings: PublicSettings | undefined; tone: 'white' | 'surface' }) {
  const t = useT();
  const about = settings?.homeAbout;
  if (!about) return null;
  return (
    <Section id="about" title={about.title || t('aboutSection')} tone={tone}>
      <div className="max-w-3xl">
        {about.text && <p className="whitespace-pre-line text-lg leading-relaxed">{about.text}</p>}
        {about.pageHref && <Link to={about.pageHref} className={buttonClass('primary', 'md', 'mt-5')}>{t('readMore')}</Link>}
      </div>
    </Section>
  );
}

function DocumentsBlock({ tone }: { tone: 'white' | 'surface' }) {
  const locale = useLocale();
  const t = useT();
  const query = usePublicDocuments({ locale, pageSize: 4 });
  return (
    <Section id="documents" tone={tone} title={t('documentsSection')} action={allLink(`/${locale}/documents`, t('allDocuments'))}>
      <QueryBoundary query={query}>
        {(data) => (data.items.length === 0 ? <EmptyState title={t('noDocuments')} /> : <ul className="grid gap-3 lg:grid-cols-2">{data.items.map((d) => <DocumentRow key={d.id} doc={d} compact />)}</ul>)}
      </QueryBoundary>
    </Section>
  );
}

function GalleryStrip({ tone }: { tone: 'white' | 'surface' }) {
  const locale = useLocale();
  const t = useT();
  const query = useGallery({ locale, pageSize: 6 });
  if (!query.data || query.data.items.length === 0) return null;
  return (
    <Section id="gallery" title={t('galleryTitle')} tone={tone} action={allLink(`/${locale}/gallery`, t('allGallery'))}>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {query.data.items.map((g) => (
          <li key={g.id}>
            <Link to={`/${locale}/gallery`} className="block overflow-hidden rounded-lg border border-line bg-white">
              <img src={g.image.thumbUrl ?? g.image.url} alt={g.image.alt || g.caption} loading="lazy" width={g.image.width ?? 300} height={g.image.height ?? 225} className="aspect-[4/3] w-full object-cover transition-transform duration-300 hover:scale-105" />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function VideoStrip({ tone }: { tone: 'white' | 'surface' }) {
  const locale = useLocale();
  const t = useT();
  const query = useVideos({ locale, pageSize: 3 });
  if (!query.data || query.data.items.length === 0) return null;
  return (
    <Section id="videos" title={t('videosTab')} tone={tone} action={allLink(`/${locale}/gallery?tab=videos`, t('allVideos'))}>
      <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
        {query.data.items.map((v) => <li key={v.id}><VideoCard video={v} /></li>)}
      </ul>
    </Section>
  );
}

function AlumniStrip({ tone }: { tone: 'white' | 'surface' }) {
  const locale = useLocale();
  const t = useT();
  const query = useAlumni({ locale, pageSize: 4 });
  if (!query.data || query.data.items.length === 0) return null;
  return (
    <Section id="alumni" title={t('alumniSection')} tone={tone} action={allLink(`/${locale}/alumni`, t('allAlumni'))}>
      <ul className="grid gap-4 lg:grid-cols-2">
        {query.data.items.map((a) => <li key={a.id}><AlumnusCard a={a} /></li>)}
      </ul>
    </Section>
  );
}

function PartnersStrip({ tone }: { tone: 'white' | 'surface' }) {
  const locale = useLocale();
  const t = useT();
  const query = usePartners(locale);
  if (!query.data || query.data.items.length === 0) return null;
  return (
    <Section id="partners" title={t('partnersSection')} tone={tone} action={allLink(`/${locale}/partners`, t('allPartners'))}>
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4">
        {query.data.items.slice(0, 8).map((p) => <li key={p.id}><PartnerCard p={p} /></li>)}
      </ul>
    </Section>
  );
}

function LinksAndContacts({ settings, tone }: { settings: PublicSettings | undefined; tone: 'white' | 'surface' }) {
  const t = useT();
  const { modules } = useModules();
  const links = settings?.usefulLinks ?? [];
  const hasContacts = Boolean(settings && (settings.address || settings.phones.length || settings.email || settings.workingHours));
  const showLinks = modules.usefulLinks;
  const showContacts = modules.contacts;
  if (!showLinks && !showContacts) return null;
  return (
    <section className={cn('section-y', tone === 'surface' && 'bg-surface')} aria-label={`${t('usefulLinksSection')} / ${t('contactsSection')}`}>
      <div className={cn('container-page grid gap-10', showLinks && showContacts && 'lg:grid-cols-2')}>
        {showLinks && (
          <div>
            <h2 className="section-title mb-6">{t('usefulLinksSection')}</h2>
            {links.length === 0 ? (
              <EmptyState title={t('noLinks')} />
            ) : (
              <ul className="space-y-2">
                {links.map((l) => (
                  <li key={l.id}>
                    <SmartLink href={l.url} newTab showExternalIcon className="card-link flex items-center justify-between gap-3 px-4 py-3 font-medium text-primary-800">
                      <span>{l.label}</span><ExternalLink className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                    </SmartLink>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        {showContacts && (
          <div>
            <h2 className="section-title mb-6">{t('contactsSection')}</h2>
            {!hasContacts || !settings ? (
              <EmptyState title={t('noContacts')} />
            ) : (
              <div className="card space-y-4 p-5">
                <ul className="space-y-4 text-base">
                  {settings.address && <li className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden /><span>{settings.address}</span></li>}
                  {settings.phones.map((p) => <li key={p} className="flex gap-3"><Phone className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden /><a href={`tel:${p.replace(/[^\d+]/g, '')}`}>{p}</a></li>)}
                  {settings.email && <li className="flex gap-3"><Mail className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden /><a href={`mailto:${settings.email}`}>{settings.email}</a></li>}
                  {settings.workingHours && <li className="flex gap-3"><Clock className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden /><span className="whitespace-pre-line">{settings.workingHours}</span></li>}
                </ul>
                {settings.mapUrl && <a href={settings.mapUrl} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary', 'sm')}><MapPin className="h-4 w-4" aria-hidden />{t('openMap')}</a>}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

export default function HomePage() {
  const locale = useLocale();
  const t = useT();
  const settingsQuery = useSettings(locale);
  const settings = settingsQuery.data;
  const { modules } = useModules();

  useSeo({
    title: settings?.seo.defaultTitle || settings?.officialName || t('siteNameFallback'),
    description: settings?.seo.defaultDescription,
    locale,
    canonicalPath: `/${locale}`,
    alternates: (['uz', 'ru', 'en'] as const).map((l) => ({ locale: l, path: `/${l}` })),
  });

  const showSide = modules.announcements || modules.events;
  const about = settings?.homeAbout;
  type Tone = 'white' | 'surface';
  // Bo'limlar oq/kulrang fonlar bilan galma-gal keladi (o'chirilgan modullar tushib qolsa ham tartib buzilmaydi)
  const blocks: ((tone: Tone, key: number) => ReactNode)[] = [];
  if (about && (about.title || about.text)) blocks.push((tone, k) => <AboutBlock key={k} settings={settings} tone={tone} />);
  if (modules.programs) blocks.push((tone, k) => <Section key={k} id="programs" title={t('programsSection')} tone={tone}><ProgramsList limit={6} /></Section>);
  if (modules.documents) blocks.push((tone, k) => <DocumentsBlock key={k} tone={tone} />);
  if (modules.photoGallery) blocks.push((tone, k) => <GalleryStrip key={k} tone={tone} />);
  if (modules.videoGallery) blocks.push((tone, k) => <VideoStrip key={k} tone={tone} />);
  if (modules.alumni) blocks.push((tone, k) => <AlumniStrip key={k} tone={tone} />);
  if (modules.partners) blocks.push((tone, k) => <PartnersStrip key={k} tone={tone} />);
  if (modules.usefulLinks || modules.contacts) blocks.push((tone, k) => <LinksAndContacts key={k} settings={settings} tone={tone} />);

  return (
    <>
      <Hero banners={settings?.banners ?? []} settings={settings} />
      <QuickLinks />
      {(modules.news || showSide) && (
        <section className="section-y" aria-labelledby={modules.news ? 'latest-news' : 'side-important'}>
          <div className={cn('container-page grid gap-8', modules.news && showSide && 'lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]')}>
            {modules.news && <NewsSection />}
            {showSide && (
              <aside className={cn('space-y-6', modules.news && 'lg:sticky lg:top-16 lg:self-start')} aria-label={t('upcomingEvents')}>
                {modules.announcements && <ImportantCard />}
                {modules.events && <EventsCard />}
              </aside>
            )}
          </div>
        </section>
      )}
      <StatsStrip settings={settings} />
      {blocks.map((render, i) => render(i % 2 === 0 ? 'surface' : 'white', i))}
    </>
  );
}
