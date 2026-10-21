// Sayt TUZILMASINI yaratadi/to'ldiradi (sahifalar sarlavhalari va menyu). Hech qanday soxta yangilik, statistika yoki
// kontakt ma'lumoti kiritilmaydi — mazmun admin paneldan kiritiladi.
// Skript qayta ishga tushirilsa xavfsiz (idempotent): mavjudlari o'zgartirilmaydi, yangi qo'shilgan bo'limlar qo'shiladi
// (shuning uchun loyiha yangilanganda ham `npm run db:seed` ni ishga tushirish mumkin).
import 'dotenv/config';
import { PrismaClient, type PageTemplate, type Prisma } from '@prisma/client';

type L3 = { uz: string; ru: string; en: string };
interface SeedPage {
  slug: string;
  title: L3;
  template: PageTemplate;
  options?: Prisma.InputJsonValue;
  /** Funksiya moduli (modul o'chirilsa, sahifa saytda yashiriladi) */
  module?: string;
  children?: SeedPage[];
}

const PAGES: SeedPage[] = [
  {
    slug: 'about',
    title: { uz: 'Texnikum haqida', ru: 'О техникуме', en: 'About the college' },
    template: 'SECTION',
    children: [
      { slug: 'history', title: { uz: 'Tarix', ru: 'История', en: 'History' }, template: 'DEFAULT' },
      { slug: 'mission', title: { uz: 'Maqsad va vazifalar', ru: 'Цели и задачи', en: 'Mission and objectives' }, template: 'DEFAULT' },
      { slug: 'structure', title: { uz: 'Tuzilma', ru: 'Структура', en: 'Structure' }, template: 'DEFAULT' },
      {
        slug: 'leadership',
        title: { uz: 'Rahbariyat', ru: 'Руководство', en: 'Leadership' },
        template: 'STAFF',
        options: { staffKind: 'LEADERSHIP' },
        module: 'staff',
      },
    ],
  },
  {
    slug: 'activity',
    title: { uz: 'Faoliyat', ru: 'Деятельность', en: 'Activities' },
    template: 'SECTION',
    module: 'activity',
    children: [
      { slug: 'directions', title: { uz: 'Asosiy faoliyat yo‘nalishlari', ru: 'Основные направления деятельности', en: 'Main areas of activity' }, template: 'DEFAULT', module: 'activity' },
      { slug: 'annual-plans', title: { uz: 'Yillik rejalar', ru: 'Годовые планы', en: 'Annual plans' }, template: 'DOCUMENTS', options: { documentTypes: ['PLAN'] }, module: 'activity' },
      { slug: 'achievements', title: { uz: 'Amalga oshirilgan ishlar', ru: 'Выполненные работы', en: 'Completed work' }, template: 'DEFAULT', module: 'activity' },
      { slug: 'reports', title: { uz: 'Hisobotlar', ru: 'Отчёты', en: 'Reports' }, template: 'DOCUMENTS', options: { documentTypes: ['REPORT'] }, module: 'activity' },
    ],
  },
  {
    slug: 'education',
    title: { uz: 'Ta’lim', ru: 'Образование', en: 'Education' },
    template: 'SECTION',
    children: [
      { slug: 'programs', title: { uz: 'Ta’lim yo‘nalishlari va mutaxassisliklar', ru: 'Направления обучения и специальности', en: 'Study programmes and specialities' }, template: 'PROGRAMS', module: 'programs' },
      { slug: 'learning-process', title: { uz: 'O‘quv jarayoni', ru: 'Учебный процесс', en: 'Learning process' }, template: 'DEFAULT' },
      { slug: 'practice', title: { uz: 'Amaliyot', ru: 'Практика', en: 'Practical training' }, template: 'DEFAULT' },
      { slug: 'teachers', title: { uz: 'O‘qituvchilar', ru: 'Преподаватели', en: 'Teachers' }, template: 'STAFF', options: { staffKind: 'TEACHER' }, module: 'teachers' },
    ],
  },
  {
    slug: 'admission',
    title: { uz: 'Qabul', ru: 'Приём', en: 'Admission' },
    template: 'DOCUMENTS',
    options: { documentTypes: ['ADMISSION'] },
    module: 'admission',
  },
  { slug: 'documents', title: { uz: 'Hujjatlar', ru: 'Документы', en: 'Documents' }, template: 'DOCUMENTS', module: 'documents' },
  {
    slug: 'transparency',
    title: { uz: 'Ochiqlik va shaffoflik', ru: 'Открытость и прозрачность', en: 'Openness and transparency' },
    template: 'SECTION',
    module: 'transparency',
    children: [
      { slug: 'open-data', title: { uz: 'Ochiq ma’lumotlar', ru: 'Открытые данные', en: 'Open data' }, template: 'DOCUMENTS', options: { documentTypes: ['OPEN_DATA'] }, module: 'transparency' },
      { slug: 'anti-corruption', title: { uz: 'Korrupsiyaga qarshi faoliyat', ru: 'Противодействие коррупции', en: 'Anti-corruption activities' }, template: 'DOCUMENTS', options: { documentTypes: ['ANTICORRUPTION'] }, module: 'transparency' },
    ],
  },
  { slug: 'privacy-policy', title: { uz: 'Maxfiylik siyosati', ru: 'Политика конфиденциальности', en: 'Privacy policy' }, template: 'DEFAULT' },
];

type NavSeed = { page: string; children?: NavSeed[] } | { route: string; label: L3; children?: NavSeed[] };

const ALUMNI: NavSeed = { route: '/alumni', label: { uz: 'Bitiruvchilar', ru: 'Выпускники', en: 'Alumni' } };
const PARTNERS: NavSeed = { route: '/partners', label: { uz: 'Hamkor korxonalar', ru: 'Предприятия-партнёры', en: 'Partner companies' } };

const MAIN_NAV: NavSeed[] = [
  { route: '/', label: { uz: 'Bosh sahifa', ru: 'Главная', en: 'Home' } },
  { page: 'about', children: [{ page: 'history' }, { page: 'mission' }, { page: 'structure' }, { page: 'leadership' }] },
  { page: 'activity', children: [{ page: 'directions' }, { page: 'annual-plans' }, { page: 'achievements' }, { page: 'reports' }] },
  { page: 'education', children: [{ page: 'programs' }, { page: 'learning-process' }, { page: 'practice' }, { page: 'teachers' }, ALUMNI, PARTNERS] },
  { page: 'admission' },
  {
    route: '/news',
    label: { uz: 'Axborot xizmati', ru: 'Пресс-служба', en: 'News & media' },
    children: [
      { route: '/news', label: { uz: 'Yangiliklar', ru: 'Новости', en: 'News' } },
      { route: '/announcements', label: { uz: 'E’lonlar', ru: 'Объявления', en: 'Announcements' } },
      { route: '/events', label: { uz: 'Tadbirlar', ru: 'Мероприятия', en: 'Events' } },
      { route: '/gallery', label: { uz: 'Foto va video galereya', ru: 'Фото и видео галерея', en: 'Photo & video gallery' } },
    ],
  },
  { page: 'documents' },
  { page: 'transparency', children: [{ page: 'open-data' }, { page: 'anti-corruption' }] },
  { route: '/contacts', label: { uz: 'Aloqa', ru: 'Контакты', en: 'Contacts' } },
];

const FOOTER_NAV: NavSeed[] = [
  { page: 'admission' },
  { page: 'documents' },
  { route: '/useful-links', label: { uz: 'Foydali havolalar', ru: 'Полезные ссылки', en: 'Useful links' } },
  { route: '/contacts', label: { uz: 'Aloqa', ru: 'Контакты', en: 'Contacts' } },
  { page: 'privacy-policy' },
];

const LOCALES = ['uz', 'ru', 'en'] as const;

export async function seedStructure(prisma: PrismaClient): Promise<{ pages: number; menus: number }> {
  // ── Sahifalar: yo'qlari yaratiladi, mavjudlarining faqat bo'sh `module` maydoni to'ldiriladi
  const idBySlug = new Map<string, string>();
  const titleBySlug = new Map<string, L3>();
  let created = 0;

  const ensurePage = async (p: SeedPage, parentId: string | null, order: number) => {
    titleBySlug.set(p.slug, p.title);
    const existing = await prisma.pageTranslation.findUnique({ where: { locale_slug: { locale: 'uz', slug: p.slug } }, select: { pageId: true } });
    let id = existing?.pageId;
    if (id) {
      if (p.module) await prisma.page.updateMany({ where: { id, module: null }, data: { module: p.module } });
    } else {
      const page = await prisma.page.create({
        data: {
          parentId,
          template: p.template,
          options: p.options,
          module: p.module ?? null,
          sortOrder: order,
          status: 'PUBLISHED',
          publishedAt: new Date(),
          translations: { create: LOCALES.map((locale) => ({ locale, title: p.title[locale], slug: p.slug, content: '' })) },
        },
      });
      id = page.id;
      created += 1;
    }
    idBySlug.set(p.slug, id);
    let i = 0;
    for (const child of p.children ?? []) await ensurePage(child, id, i++);
  };
  let order = 0;
  for (const p of PAGES) await ensurePage(p, null, order++);

  // ── Menyular
  let menus = 0;
  const labels = (n: NavSeed): L3 | null => ('route' in n ? n.label : (titleBySlug.get(n.page) ?? null));
  const sameItem = (n: NavSeed, row: { pageId: string | null; route: string | null }) => ('route' in n ? row.route === n.route : row.pageId === idBySlug.get(n.page));

  const createItem = async (menuId: string, parentId: string | null, sortOrder: number, n: NavSeed) => {
    const l = labels(n);
    if (!l) return null;
    const pageId = 'page' in n ? idBySlug.get(n.page) : undefined;
    if ('page' in n && !pageId) return null;
    return prisma.navigationItem.create({
      data: {
        menuId, parentId, sortOrder,
        kind: 'route' in n ? 'ROUTE' : 'PAGE',
        pageId: pageId ?? null,
        route: 'route' in n ? n.route : null,
        translations: { create: LOCALES.map((locale) => ({ locale, label: l[locale] })) },
      },
    });
  };

  const buildTree = async (menuId: string, parentId: string | null, list: NavSeed[]) => {
    for (const [index, n] of list.entries()) {
      const row = await createItem(menuId, parentId, index, n);
      if (row && n.children) await buildTree(menuId, row.id, n.children);
    }
  };

  /** Mavjud menyuga faqat YETISHMAYOTGAN bandlar qo'shiladi (foydalanuvchi tahriri saqlanadi). */
  const topUp = async (menuId: string, parentId: string | null, list: NavSeed[]) => {
    const rows = await prisma.navigationItem.findMany({ where: { menuId, parentId }, orderBy: { sortOrder: 'asc' } });
    for (const n of list) {
      let row = rows.find((r) => sameItem(n, r));
      if (!row) {
        // "Aloqa" bandidan oldinga qo'yiladi (bo'lsa), aks holda oxiriga
        const contacts = rows.find((r) => r.route === '/contacts');
        const at = contacts ? contacts.sortOrder : rows.length;
        if (contacts) {
          await prisma.navigationItem.updateMany({ where: { menuId, parentId, sortOrder: { gte: at } }, data: { sortOrder: { increment: 1 } } });
        }
        const created = await createItem(menuId, parentId, parentId ? rows.length : at, n);
        if (!created) continue;
        row = created;
        rows.push(created);
        if (n.children) await buildTree(menuId, created.id, n.children);
        continue;
      }
      if (n.children) await topUp(menuId, row.id, n.children);
    }
  };

  for (const [key, items] of [['main', MAIN_NAV], ['footer', FOOTER_NAV]] as const) {
    const menu = await prisma.navigationMenu.upsert({ where: { key }, create: { key }, update: {} });
    if ((await prisma.navigationItem.count({ where: { menuId: menu.id } })) === 0) {
      await buildTree(menu.id, null, items);
      menus += 1;
    } else {
      // Mavjud menyu: faqat yangi bo'limlar (Qabul, Bitiruvchilar, Hamkorlar) yetishmasa qo'shiladi
      const additions: NavSeed[] =
        key === 'main'
          ? [{ page: 'admission' }, { page: 'education', children: [ALUMNI, PARTNERS] }]
          : [{ page: 'admission' }];
      await topUp(menu.id, null, additions);
    }
  }
  return { pages: created, menus };
}

const isMain = process.argv[1]?.replace(/\\/g, '/').endsWith('prisma/seed.ts');
if (isMain) {
  const prisma = new PrismaClient();
  seedStructure(prisma)
    .then((r) => console.log(`Seed bajarildi: ${r.pages} ta yangi sahifa, ${r.menus} ta yangi menyu yaratildi.`))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
