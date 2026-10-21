import { ExternalLink } from 'lucide-react';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../i18n/locale';

interface Props extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  newTab?: boolean;
  children: ReactNode;
  showExternalIcon?: boolean;
}

const isExternal = (href: string) => /^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:');

/** Ichki yo'llar uchun SPA navigatsiyasi, tashqi manzillar uchun xavfsiz <a> (noopener). */
export function SmartLink({ href, newTab, children, showExternalIcon, ...rest }: Props) {
  const t = useT();
  if (isExternal(href)) {
    const web = /^https?:/i.test(href);
    return (
      <a href={href} target={newTab ? '_blank' : undefined} rel={newTab || web ? 'noopener noreferrer' : undefined} {...rest}>
        {children}
        {showExternalIcon && web && (
          <>
            <ExternalLink className="ml-1 inline h-3.5 w-3.5 align-[-1px]" aria-hidden />
            <span className="sr-only"> ({t('externalLink')}{newTab ? `, ${t('openInNewTab')}` : ''})</span>
          </>
        )}
      </a>
    );
  }
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
  );
}
