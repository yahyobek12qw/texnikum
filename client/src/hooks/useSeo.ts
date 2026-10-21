import { useEffect } from 'react';
import type { Locale } from '@uchkoprik/shared';

interface SeoInput {
  title: string;
  description?: string | null;
  locale: Locale;
  noindex?: boolean;
  canonicalPath?: string | null;
  alternates?: { locale: Locale; path: string }[];
}

function setMeta(selector: string, create: () => HTMLElement, attr: string, value: string | null) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (value === null || value === '') {
    el?.remove();
    return;
  }
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

/** SPA ichida navigatsiya qilinganda title, description, canonical, hreflang va <html lang> ni yangilaydi. */
export function useSeo({ title, description, locale, noindex, canonicalPath, alternates }: SeoInput) {
  const altKey = JSON.stringify(alternates ?? []);
  useEffect(() => {
    document.documentElement.lang = locale;
    if (title) document.title = title;

    setMeta('meta[name="description"]', () => Object.assign(document.createElement('meta'), { name: 'description' }), 'content', description ?? '');
    setMeta('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' }), 'content', noindex ? 'noindex, nofollow' : null);

    const origin = window.location.origin;
    setMeta('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', canonicalPath ? origin + canonicalPath : null);

    document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((n) => n.remove());
    for (const a of alternates ?? []) {
      const link = document.createElement('link');
      link.rel = 'alternate';
      link.hreflang = a.locale;
      link.href = origin + a.path;
      document.head.appendChild(link);
    }
  }, [title, description, locale, noindex, canonicalPath, altKey]);
}
