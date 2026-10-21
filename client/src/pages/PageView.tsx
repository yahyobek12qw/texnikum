import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { PageSection, PublicPage } from '@uchkoprik/shared';
import { PageHeading, TranslationNotice } from '../components/PageHeading';
import { RichContent, isEmptyHtml } from '../components/RichContent';
import { EmptyState } from '../components/ui/Feedback';
import { cn } from '../components/ui/cn';
import { DocumentsBrowser } from '../features/documents/DocumentsBrowser';
import { ProgramsList } from '../features/programs/ProgramsList';
import { StaffGrid } from '../features/staff/StaffGrid';
import { useT } from '../i18n/locale';

/** Bo'lim ichidagi sahifalar navigatsiyasi (desktopda yon ustun, mobilda ochiladigan blok). */
function SectionNav({ section, currentId }: { section: PageSection; currentId: string }) {
  const t = useT();
  const list = (
    <ul className="space-y-0.5">
      {section.items.map((i) => {
        const active = i.id === currentId;
        return (
          <li key={i.id}>
            <Link
              to={i.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center justify-between gap-2 rounded-md border-l-4 px-3 py-2.5 text-[0.95rem] no-underline',
                active ? 'border-accent-600 bg-accent-50 font-semibold text-primary-800' : 'border-transparent text-ink hover:bg-surface',
              )}
            >
              {i.title}
              {!active && <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
  return (
    <nav aria-label={t('navigateSection')} className="lg:sticky lg:top-20">
      <details className="card lg:hidden" open={false}>
        <summary className="cursor-pointer list-none px-4 py-3 font-medium text-primary-800">
          <span className="eyebrow block">{t('inThisSection')}</span>
          {section.title}
        </summary>
        <div className="border-t border-line p-2">{list}</div>
      </details>
      <div className="card hidden overflow-hidden lg:block">
        <Link to={section.href} className="block bg-primary-700 px-4 py-3 font-semibold text-white no-underline hover:bg-primary-800">
          {section.title}
        </Link>
        <div className="p-2">{list}</div>
      </div>
    </nav>
  );
}

/** CMS sahifasini shablonga qarab chizadi (ommaviy sayt va admin oldindan ko'rish uchun umumiy). */
export function PageView({ page }: { page: PublicPage }) {
  const t = useT();
  const hasContent = !isEmptyHtml(page.content);
  const hasList = page.template !== 'DEFAULT' && page.template !== 'SECTION';
  const isSectionRoot = page.template === 'SECTION' && page.children.length > 0;
  // Bo'limning o'zida (ildiz) ichki sahifalar kartochka ko'rinishida beriladi, yon navigatsiya shart emas
  const showSideNav = Boolean(page.section) && !isSectionRoot;

  return (
    <>
      <PageHeading title={page.title} trail={page.breadcrumbs} />
      <div className="container-page section-y" lang={page.isFallback ? page.locale : undefined}>
        <div className={cn(showSideNav && 'grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,1fr)]')}>
          {showSideNav && page.section && <SectionNav section={page.section} currentId={page.id} />}
          <div className="min-w-0">
            <TranslationNotice info={page} />
            <article className="max-w-3xl">
              {hasContent && <RichContent html={page.content} />}
              {!hasContent && !hasList && !isSectionRoot && <EmptyState title={t('emptyContent')} />}
            </article>

            {isSectionRoot && (
              <section aria-label={t('sectionPages')} className={cn(hasContent && 'mt-10')}>
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {page.children.map((c) => (
                    <li key={c.id}>
                      <Link to={c.href} className="card-link group flex h-full min-h-20 items-center justify-between gap-3 p-5 text-lg font-medium text-primary-800">
                        {c.title}
                        <ChevronRight className="h-5 w-5 shrink-0 text-accent-600 transition-transform group-hover:translate-x-1" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {hasList && (
              <div className={cn(hasContent && 'mt-10')}>
                {page.template === 'DOCUMENTS' && <DocumentsBrowser fixedTypes={page.options?.documentTypes} />}
                {page.template === 'STAFF' && <StaffGrid kind={page.options?.staffKind} />}
                {page.template === 'PROGRAMS' && <ProgramsList />}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
