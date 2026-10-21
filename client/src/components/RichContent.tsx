import DOMPurify from 'dompurify';
import { useMemo } from 'react';
import { cn } from './ui/cn';

/**
 * Server tomonida tozalangan HTML yana brauzerda DOMPurify bilan tozalanadi (ikki qatlamli himoya).
 */
export function RichContent({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(
    () => DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, ADD_ATTR: ['target'], FORBID_TAGS: ['style', 'form', 'input', 'iframe'] }),
    [html],
  );
  return <div className={cn('prose-content', className)} dangerouslySetInnerHTML={{ __html: clean }} />;
}

export function isEmptyHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  return html.replace(/<(?!img\b)[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() === '';
}
