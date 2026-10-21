import { Link } from 'react-router-dom';
import { buttonClass } from '../components/ui/Button';
import { useSeo } from '../hooks/useSeo';
import { useLocale, useT } from '../i18n/locale';

export default function NotFoundPage({ standalone = false, document: isDocument = false }: { standalone?: boolean; document?: boolean }) {
  const locale = useLocale();
  const t = useT();
  const title = isDocument ? t('documentNotFoundTitle') : t('notFoundTitle');
  useSeo({ title, locale, noindex: true });

  return (
    <div className={standalone ? 'flex min-h-screen items-center justify-center' : ''}>
      <div className="container-page py-20 text-center">
        <p className="text-6xl font-bold text-primary-200" aria-hidden>404</p>
        <h1 className="mt-4 text-3xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted">{isDocument ? t('documentNotFoundText') : t('notFoundText')}</p>
        <Link to={`/${locale}`} className={buttonClass('primary', 'lg', 'mt-8')}>{t('toHome')}</Link>
      </div>
    </div>
  );
}
