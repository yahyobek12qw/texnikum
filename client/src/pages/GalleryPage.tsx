import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { PublicGalleryItem } from '@uchkoprik/shared';
import { useGallery, useSettings, useVideos } from '../api/public';
import { PageHeading } from '../components/PageHeading';
import { QueryBoundary } from '../components/QueryBoundary';
import { EmptyState } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { Tabs } from '../components/ui/Tabs';
import { VideoCard } from '../features/gallery/VideoCard';
import { useModules } from '../hooks/useModules';
import { useSeo } from '../hooks/useSeo';
import { useLocale, useT } from '../i18n/locale';

type Tab = 'photos' | 'videos';

function Photos() {
  const locale = useLocale();
  const t = useT();
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<PublicGalleryItem | null>(null);
  const query = useGallery({ locale, page, pageSize: 12 });
  return (
    <>
      <QueryBoundary query={query}>
        {(data) =>
          data.items.length === 0 ? (
            <EmptyState title={t('noGallery')} />
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {data.items.map((g) => (
                  <li key={g.id}>
                    <button type="button" onClick={() => setActive(g)} className="card-link block w-full overflow-hidden text-left">
                      <img src={g.image.thumbUrl ?? g.image.url} alt={g.image.alt || g.caption} loading="lazy" width={g.image.width ?? 480} height={g.image.height ?? 320} className="aspect-[4/3] w-full object-cover" />
                      {g.caption && <span className="block p-3 text-sm text-ink">{g.caption}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <Pagination className="mt-8" meta={data.meta} onPage={setPage} labels={{ prev: t('prev'), next: t('next'), nav: t('photosTab'), pageOf: (p, total) => t('pageOf', { page: p, total }) }} />
            </>
          )
        }
      </QueryBoundary>
      <Modal open={Boolean(active)} title={active?.caption || active?.image.alt || t('galleryTitle')} onClose={() => setActive(null)} size="xl">
        {active && <img src={active.image.url} alt={active.image.alt || active.caption} className="mx-auto max-h-[75vh] w-auto" />}
      </Modal>
    </>
  );
}

function Videos() {
  const locale = useLocale();
  const t = useT();
  const [page, setPage] = useState(1);
  const query = useVideos({ locale, page, pageSize: 9 });
  return (
    <QueryBoundary query={query}>
      {(data) =>
        data.items.length === 0 ? (
          <EmptyState title={t('noVideos')} />
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {data.items.map((v) => <li key={v.id}><VideoCard video={v} /></li>)}
            </ul>
            <p className="mt-4 text-xs text-muted">{t('videoPrivacy')}</p>
            <Pagination className="mt-6" meta={data.meta} onPage={setPage} labels={{ prev: t('prev'), next: t('next'), nav: t('videosTab'), pageOf: (p, total) => t('pageOf', { page: p, total }) }} />
          </>
        )
      }
    </QueryBoundary>
  );
}

/** Foto va video galereya: bo'limlar (modullar) alohida yoqiladi/o'chiriladi. */
export default function GalleryPage() {
  const locale = useLocale();
  const t = useT();
  const { modules } = useModules();
  const settings = useSettings(locale).data;
  const [params, setParams] = useSearchParams();

  const tabs = [
    ...(modules.photoGallery ? [{ key: 'photos' as Tab, label: t('photosTab') }] : []),
    ...(modules.videoGallery ? [{ key: 'videos' as Tab, label: t('videosTab') }] : []),
  ];
  const requested = params.get('tab') as Tab | null;
  const active: Tab = tabs.some((x) => x.key === requested) ? (requested as Tab) : (tabs[0]?.key ?? 'photos');
  const title = t('galleryTitle');

  useSeo({
    title: settings?.shortName ? `${title} | ${settings.shortName}` : title,
    description: settings?.seo.defaultDescription,
    locale,
    canonicalPath: `/${locale}/gallery`,
    alternates: (['uz', 'ru', 'en'] as const).map((l) => ({ locale: l, path: `/${l}/gallery` })),
  });

  return (
    <>
      <PageHeading title={title} trail={[]} />
      <div className="container-page section-y">
        {tabs.length > 1 ? (
          <Tabs tabs={tabs} active={active} onChange={(k) => setParams(k === tabs[0]!.key ? {} : { tab: k })} label={title}>
            {(k) => (k === 'photos' ? <Photos /> : <Videos />)}
          </Tabs>
        ) : active === 'videos' ? <Videos /> : <Photos />}
      </div>
    </>
  );
}
