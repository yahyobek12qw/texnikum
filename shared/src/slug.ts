const CYRILLIC: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i', й: 'y',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'x', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

/** Sarlavhadan URL uchun xavfsiz slug yasaydi (kirill va o'zbek lotin belgilarini translit qiladi). */
export function slugify(input: string): string {
  const lower = input.toLowerCase();
  let out = '';
  for (const ch of lower) out += CYRILLIC[ch] ?? ch;
  return out
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ʻʼ‘’'`´]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Ommaviy saytning qat'iy marshrutlari — sahifa sluglari bilan to'qnashmasligi kerak. */
export const RESERVED_SLUGS = [
  'admin',
  'api',
  'uploads',
  'assets',
  'news',
  'announcements',
  'events',
  'gallery',
  'search',
  'contacts',
  'useful-links',
  'alumni',
  'partners',
  'sitemap',
  'robots',
] as const;

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug);
}
