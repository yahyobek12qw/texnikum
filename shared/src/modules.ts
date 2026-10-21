// Funksiya modullari: administrator ularni vaqtincha o'chirib, keyin qayta yoqishi mumkin.
// Modul o'chirilganda ma'lumotlar bazadan o'chirilmaydi: faqat saytda, menyuda, API va admin panelda yashiriladi.

export const MODULE_KEYS = [
  'news',
  'announcements',
  'events',
  'photoGallery',
  'videoGallery',
  'programs',
  'admission',
  'documents',
  'staff',
  'alumni',
  'partners',
  'contacts',
  'statistics',
  'users',
  // Hozircha o'chirilgan (kerak bo'lganda yoqiladi):
  'search',
  'usefulLinks',
  'transparency',
  'activity',
  'teachers',
  'translations',
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export interface ModuleDef {
  key: ModuleKey;
  label: string;
  description: string;
  defaultEnabled: boolean;
  group: 'main' | 'extra';
}

export const MODULES: readonly ModuleDef[] = [
  { key: 'news', label: 'Yangiliklar', description: 'Yangiliklar ro‘yxati va sahifalari.', defaultEnabled: true, group: 'main' },
  { key: 'announcements', label: 'E’lonlar', description: 'E’lonlar bo‘limi va bosh sahifadagi “Muhim e’lonlar”.', defaultEnabled: true, group: 'main' },
  { key: 'events', label: 'Tadbirlar', description: 'Tadbirlar bo‘limi va “Yaqin tadbirlar”.', defaultEnabled: true, group: 'main' },
  { key: 'photoGallery', label: 'Fotogalereya', description: 'Rasmlar galereyasi.', defaultEnabled: true, group: 'main' },
  { key: 'videoGallery', label: 'Videogalereya', description: 'YouTube/Vimeo videolari galereyasi.', defaultEnabled: true, group: 'main' },
  { key: 'programs', label: 'Yo‘nalishlar va mutaxassisliklar', description: 'Ta’lim yo‘nalishlari ro‘yxati.', defaultEnabled: true, group: 'main' },
  { key: 'admission', label: 'Qabul shartlari va hujjatlari', description: 'Qabul sahifasi va qabul hujjatlari.', defaultEnabled: true, group: 'main' },
  { key: 'documents', label: 'Hujjatlar', description: 'Hujjatlar kutubxonasi (nizom, reja, hisobot va h.k.).', defaultEnabled: true, group: 'main' },
  { key: 'staff', label: 'Rahbariyat va xodimlar', description: 'Rahbariyat va xodimlar ro‘yxati.', defaultEnabled: true, group: 'main' },
  { key: 'alumni', label: 'Bitiruvchilar', description: 'Bitiruvchilar sahifasi.', defaultEnabled: true, group: 'main' },
  { key: 'partners', label: 'Hamkor korxonalar', description: 'Hamkor korxonalar sahifasi.', defaultEnabled: true, group: 'main' },
  { key: 'contacts', label: 'Aloqa', description: 'Manzil, telefon, ish vaqti sahifasi.', defaultEnabled: true, group: 'main' },
  { key: 'statistics', label: 'Statistika va hisobotlar', description: 'Ko‘rishlar statistikasi, “Raqamlarda” bloki va hisobotlarni yuklab olish.', defaultEnabled: true, group: 'main' },
  { key: 'users', label: 'Foydalanuvchilar va rollar', description: 'Foydalanuvchilarni boshqarish sahifasi (ruxsatlar baribir ishlaydi).', defaultEnabled: true, group: 'main' },
  { key: 'search', label: 'Sayt ichida qidiruv', description: 'Qidiruv maydoni va natijalar sahifasi.', defaultEnabled: false, group: 'extra' },
  { key: 'usefulLinks', label: 'Foydali havolalar', description: 'Foydali havolalar sahifasi va bloki.', defaultEnabled: false, group: 'extra' },
  { key: 'transparency', label: 'Ochiqlik va shaffoflik', description: 'Ochiq ma’lumotlar va korrupsiyaga qarshi faoliyat sahifalari.', defaultEnabled: false, group: 'extra' },
  { key: 'activity', label: 'Faoliyat bo‘limi', description: 'Faoliyat yo‘nalishlari, yillik rejalar, hisobotlar sahifalari.', defaultEnabled: false, group: 'extra' },
  { key: 'teachers', label: 'O‘qituvchilar ro‘yxati', description: 'O‘qituvchilar sahifasi.', defaultEnabled: false, group: 'extra' },
  { key: 'translations', label: 'Tarjimalar holati (admin)', description: 'Admin paneldagi “Uch tilli tarjimalar” sahifasi.', defaultEnabled: false, group: 'extra' },
];

export type ModulesState = Record<ModuleKey, boolean>;

export function defaultModules(): ModulesState {
  return Object.fromEntries(MODULES.map((m) => [m.key, m.defaultEnabled])) as ModulesState;
}

/** Saqlangan (qisman) qiymatlarni standartlar bilan birlashtiradi. */
export function resolveModules(stored: Partial<Record<string, boolean>> | null | undefined): ModulesState {
  const base = defaultModules();
  for (const k of MODULE_KEYS) if (typeof stored?.[k] === 'boolean') base[k] = stored[k] as boolean;
  return base;
}

/** Qat'iy marshrutlar qaysi modulga tegishli ("/" doim ochiq). */
export const ROUTE_MODULES: Record<string, readonly ModuleKey[]> = {
  '/news': ['news'],
  '/announcements': ['announcements'],
  '/events': ['events'],
  '/gallery': ['photoGallery', 'videoGallery'], // kamida bittasi yoqilgan bo'lsa
  '/useful-links': ['usefulLinks'],
  '/contacts': ['contacts'],
  '/search': ['search'],
  '/alumni': ['alumni'],
  '/partners': ['partners'],
};

export function isRouteEnabled(route: string, modules: ModulesState): boolean {
  const need = ROUTE_MODULES[route];
  return !need || need.some((k) => modules[k]);
}
