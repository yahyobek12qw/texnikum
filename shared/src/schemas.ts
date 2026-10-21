import { z } from 'zod';
import {
  CATEGORY_SCOPES,
  CONTENT_STATUSES,
  DOCUMENT_TYPES,
  NAV_ITEM_KINDS,
  NEWS_TYPES,
  PAGE_TEMPLATES,
  STAFF_KINDS,
} from './enums.js';
import { LOCALES } from './locales.js';
import { MODULE_KEYS } from './modules.js';
import { ROLES } from './permissions.js';
import { parseVideoUrl } from './video.js';

// ───────────── Umumiy bloklar ─────────────

export const localeSchema = z.enum(LOCALES);
export const idSchema = z.string().min(1).max(64);

export const slugSchema = z
  .string()
  .trim()
  .min(1, 'Slug kiritilishi shart')
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug faqat kichik lotin harflari, raqamlar va "-" dan iborat bo‘lishi kerak');

/** Faqat http/https manzillar (javascript: va data: kabilarni rad etadi). */
export const httpUrlSchema = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'To‘g‘ri http(s) manzil kiriting');

/** Bo'sh qatorga ham ruxsat beruvchi URL. */
export const optionalUrlSchema = z.union([z.literal(''), httpUrlSchema]);

/** Sayt ichidagi yo'l ("/...") yoki to'liq http(s) manzil. */
export const linkSchema = z.union([
  z.literal(''),
  httpUrlSchema,
  z.string().trim().regex(/^\/(?!\/)[^\s]*$/, 'Ichki yo‘l "/" bilan boshlanishi kerak'),
]);

export const dateStringSchema = z
  .string()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Sana noto‘g‘ri');

const text = (max: number) => z.string().trim().max(max);

export const localizedText = (max = 500) =>
  z.object({ uz: text(max), ru: text(max), en: text(max) });
export type LocalizedInput = z.infer<ReturnType<typeof localizedText>>;

/** Tarjimalar xaritasi: uz majburiy (create), ru/en ixtiyoriy. */
const translations = <T extends z.ZodType>(item: T) =>
  z.object({ uz: item, ru: item.nullish(), en: item.nullish() });

/** Yangilashda: berilgan til almashtiriladi, null — tarjimani o'chiradi (uz o'chirilmaydi). */
const translationsPatch = <T extends z.ZodType>(item: T) =>
  z.object({ uz: item.optional(), ru: item.nullish(), en: item.nullish() }).partial();

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const statusFilter = z.enum(CONTENT_STATUSES).optional();
const qFilter = z.string().trim().max(200).optional();

// ───────────── Auth ─────────────

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Elektron pochta noto‘g‘ri').max(200),
  password: z.string().min(1, 'Parolni kiriting').max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const PASSWORD_MIN = 12;
export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Parol kamida ${PASSWORD_MIN} ta belgidan iborat bo‘lishi kerak`)
  .max(200)
  .refine((v) => /[a-zA-Z]/.test(v) && /\d/.test(v), 'Parolda harf va raqam bo‘lishi kerak');

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Joriy parolni kiriting').max(200),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ───────────── Sahifalar ─────────────

export const pageOptionsSchema = z.object({
  documentTypes: z.array(z.enum(DOCUMENT_TYPES)).max(10).optional(),
  staffKind: z.enum(STAFF_KINDS).optional(),
});
export type PageOptions = z.infer<typeof pageOptionsSchema>;

export const pageTranslationSchema = z.object({
  title: text(250).min(1, 'Sarlavhani kiriting'),
  slug: slugSchema,
  content: z.string().max(500_000),
  seoTitle: text(200).nullish(),
  seoDescription: text(400).nullish(),
});
export type PageTranslationInput = z.infer<typeof pageTranslationSchema>;

export const pageCreateSchema = z.object({
  parentId: idSchema.nullish(),
  template: z.enum(PAGE_TEMPLATES),
  options: pageOptionsSchema.nullish(),
  sortOrder: z.number().int().min(0).max(9999),
  translations: translations(pageTranslationSchema),
});
export type PageCreateInput = z.infer<typeof pageCreateSchema>;

export const pageUpdateSchema = z
  .object({
    parentId: idSchema.nullable(),
    template: z.enum(PAGE_TEMPLATES),
    options: pageOptionsSchema.nullable(),
    sortOrder: z.number().int().min(0).max(9999),
    translations: translationsPatch(pageTranslationSchema),
    note: text(200),
  })
  .partial();
export type PageUpdateInput = z.infer<typeof pageUpdateSchema>;

export const pageListQuery = paginationQuery.extend({
  q: qFilter,
  status: statusFilter,
  parentId: z.string().optional(),
});

export const restoreVersionSchema = z.object({ version: z.number().int().min(1) });

// ───────────── Yangiliklar ─────────────

export const newsTranslationSchema = z.object({
  title: text(250).min(1, 'Sarlavhani kiriting'),
  slug: slugSchema,
  excerpt: text(600),
  content: z.string().max(500_000),
  seoTitle: text(200).nullish(),
  seoDescription: text(400).nullish(),
});
export type NewsTranslationInput = z.infer<typeof newsTranslationSchema>;

export const newsCreateSchema = z.object({
  type: z.enum(NEWS_TYPES),
  categoryId: idSchema.nullish(),
  coverMediaId: idSchema.nullish(),
  isImportant: z.boolean(),
  publishedAt: dateStringSchema.nullish(),
  scheduledAt: dateStringSchema.nullish(),
  eventAt: dateStringSchema.nullish(),
  translations: translations(newsTranslationSchema),
});
export type NewsCreateInput = z.infer<typeof newsCreateSchema>;

export const newsUpdateSchema = z
  .object({
    type: z.enum(NEWS_TYPES),
    categoryId: idSchema.nullable(),
    coverMediaId: idSchema.nullable(),
    isImportant: z.boolean(),
    publishedAt: dateStringSchema.nullable(),
    scheduledAt: dateStringSchema.nullable(),
    eventAt: dateStringSchema.nullable(),
    translations: translationsPatch(newsTranslationSchema),
  })
  .partial();
export type NewsUpdateInput = z.infer<typeof newsUpdateSchema>;

export const newsListQuery = paginationQuery.extend({
  q: qFilter,
  status: statusFilter,
  type: z.enum(NEWS_TYPES).optional(),
  categoryId: z.string().optional(),
});

// ───────────── Hujjatlar ─────────────

export const documentTranslationSchema = z.object({
  title: text(300).min(1, 'Nomini kiriting'),
  description: text(2000),
});
export type DocumentTranslationInput = z.infer<typeof documentTranslationSchema>;

export const documentCreateSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  categoryId: idSchema.nullish(),
  fileMediaId: idSchema,
  docDate: dateStringSchema.nullish(),
  number: text(100).nullish(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
  translations: translations(documentTranslationSchema),
});
export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;

export const documentUpdateSchema = z
  .object({
    type: z.enum(DOCUMENT_TYPES),
    categoryId: idSchema.nullable(),
    fileMediaId: idSchema,
    docDate: dateStringSchema.nullable(),
    number: text(100).nullable(),
    status: z.enum(CONTENT_STATUSES),
    translations: translationsPatch(documentTranslationSchema),
  })
  .partial();
export type DocumentUpdateInput = z.infer<typeof documentUpdateSchema>;

export const documentListQuery = paginationQuery.extend({
  q: qFilter,
  status: statusFilter,
  type: z.enum(DOCUMENT_TYPES).optional(),
  categoryId: z.string().optional(),
});

// ───────────── Kategoriyalar ─────────────

export const categoryTranslationSchema = z.object({
  name: text(150).min(1, 'Nomini kiriting'),
  slug: slugSchema,
});
export type CategoryTranslationInput = z.infer<typeof categoryTranslationSchema>;
export const categoryCreateSchema = z.object({
  scope: z.enum(CATEGORY_SCOPES),
  sortOrder: z.number().int().min(0).max(9999),
  translations: translations(categoryTranslationSchema),
});
export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export const categoryUpdateSchema = z
  .object({
    sortOrder: z.number().int().min(0).max(9999),
    translations: translationsPatch(categoryTranslationSchema),
  })
  .partial();
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;

// ───────────── Ta'lim yo'nalishlari ─────────────

export const programTranslationSchema = z.object({
  title: text(250).min(1, 'Nomini kiriting'),
  summary: text(1000),
  description: z.string().max(200_000),
  duration: text(100),
  qualification: text(250),
});
export type ProgramTranslationInput = z.infer<typeof programTranslationSchema>;
export const programCreateSchema = z.object({
  code: text(50).nullish(),
  sortOrder: z.number().int().min(0).max(9999),
  translations: translations(programTranslationSchema),
});
export type ProgramCreateInput = z.infer<typeof programCreateSchema>;
export const programUpdateSchema = z
  .object({
    code: text(50).nullable(),
    sortOrder: z.number().int().min(0).max(9999),
    translations: translationsPatch(programTranslationSchema),
  })
  .partial();
export type ProgramUpdateInput = z.infer<typeof programUpdateSchema>;

// ───────────── Rahbariyat va xodimlar ─────────────

export const staffTranslationSchema = z.object({
  fullName: text(200).min(1, 'F.I.Sh. ni kiriting'),
  position: text(250),
  bio: text(5000),
});
export type StaffTranslationInput = z.infer<typeof staffTranslationSchema>;
const phoneSchema = z.string().trim().max(50).regex(/^[0-9+()\-\s]*$/, 'Telefon raqami noto‘g‘ri');
export const staffCreateSchema = z.object({
  kind: z.enum(STAFF_KINDS),
  photoMediaId: idSchema.nullish(),
  email: z.union([z.literal(''), z.string().trim().email().max(200)]).nullish(),
  phone: phoneSchema.nullish(),
  sortOrder: z.number().int().min(0).max(9999),
  translations: translations(staffTranslationSchema),
});
export type StaffCreateInput = z.infer<typeof staffCreateSchema>;
export const staffUpdateSchema = z
  .object({
    kind: z.enum(STAFF_KINDS),
    photoMediaId: idSchema.nullable(),
    email: z.union([z.literal(''), z.string().trim().email().max(200)]).nullable(),
    phone: phoneSchema.nullable(),
    sortOrder: z.number().int().min(0).max(9999),
    translations: translationsPatch(staffTranslationSchema),
  })
  .partial();
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>;

// ───────────── Media ─────────────

export const mediaUpdateSchema = z
  .object({
    showInGallery: z.boolean(),
    translations: z.object({
      uz: z.object({ alt: text(300), caption: text(500) }),
      ru: z.object({ alt: text(300), caption: text(500) }),
      en: z.object({ alt: text(300), caption: text(500) }),
    }),
  })
  .partial();
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;

export const mediaListQuery = paginationQuery.extend({
  q: qFilter,
  kind: z.enum(['IMAGE', 'DOCUMENT', 'VIDEO']).optional(),
});

// ───────────── Navigatsiya ─────────────

export interface NavItemInput {
  id?: string | undefined;
  kind: (typeof NAV_ITEM_KINDS)[number];
  pageId?: string | null | undefined;
  route?: string | null | undefined;
  url?: string | null | undefined;
  newTab: boolean;
  labels: { uz: string; ru: string; en: string };
  children: NavItemInput[];
}

export const navItemSchema: z.ZodType<NavItemInput> = z.lazy(() =>
  z
    .object({
      id: idSchema.optional(),
      kind: z.enum(NAV_ITEM_KINDS),
      pageId: idSchema.nullish(),
      route: z.string().trim().max(200).nullish(),
      url: httpUrlSchema.nullish(),
      newTab: z.boolean(),
      labels: z.object({ uz: text(100), ru: text(100), en: text(100) }),
      children: z.array(navItemSchema).max(30),
    })
    .superRefine((v, ctx) => {
      if (!v.labels.uz && !v.labels.ru && !v.labels.en) {
        ctx.addIssue({ code: 'custom', message: 'Kamida bitta tilda nom kiriting', path: ['labels'] });
      }
      if (v.kind === 'PAGE' && !v.pageId) {
        ctx.addIssue({ code: 'custom', message: 'Sahifani tanlang', path: ['pageId'] });
      }
      if (v.kind === 'ROUTE' && !v.route?.startsWith('/')) {
        ctx.addIssue({ code: 'custom', message: 'Marshrutni tanlang', path: ['route'] });
      }
      if (v.kind === 'EXTERNAL' && !v.url) {
        ctx.addIssue({ code: 'custom', message: 'Tashqi manzilni kiriting', path: ['url'] });
      }
    }),
);

export const MENU_KEYS = ['main', 'footer'] as const;
export const navigationUpdateSchema = z.object({
  menus: z
    .array(z.object({ key: z.enum(MENU_KEYS), items: z.array(navItemSchema).max(40) }))
    .min(1)
    .max(2),
});
export type NavigationUpdateInput = z.infer<typeof navigationUpdateSchema>;

// ───────────── Sayt sozlamalari ─────────────

export const bannerSchema = z.object({
  id: idSchema,
  imageMediaId: idSchema.nullable(),
  title: localizedText(200),
  text: localizedText(500),
  linkUrl: linkSchema,
  isActive: z.boolean(),
});
export type Banner = z.infer<typeof bannerSchema>;

export const usefulLinkSchema = z.object({
  id: idSchema,
  label: localizedText(150),
  url: httpUrlSchema,
});
export type UsefulLink = z.infer<typeof usefulLinkSchema>;

/** "Raqamlarda" bloki: qiymatni administrator kiritadi (kodda doimiy raqamlar yo'q). */
export const statisticItemSchema = z.object({
  id: idSchema,
  value: text(30).min(1, 'Qiymatni kiriting'),
  label: localizedText(100),
});
export type StatisticItem = z.infer<typeof statisticItemSchema>;

export const SETTINGS_SCHEMAS = {
  general: z.object({
    officialName: localizedText(250),
    shortName: localizedText(100),
    logoMediaId: idSchema.nullable(),
  }),
  topBar: z.object({
    isActive: z.boolean(),
    text: localizedText(300),
    linkUrl: linkSchema,
  }),
  contacts: z.object({
    address: localizedText(400),
    phones: z.array(phoneSchema.min(1)).max(10),
    email: z.union([z.literal(''), z.string().trim().email().max(200)]),
    workingHours: localizedText(300),
    mapUrl: optionalUrlSchema,
  }),
  social: z.object({
    telegram: optionalUrlSchema,
    instagram: optionalUrlSchema,
    facebook: optionalUrlSchema,
    youtube: optionalUrlSchema,
  }),
  footer: z.object({ text: localizedText(600) }),
  seo: z.object({
    defaultTitle: localizedText(120),
    defaultDescription: localizedText(300),
    ogImageMediaId: idSchema.nullable(),
  }),
  homeAbout: z.object({
    title: localizedText(150),
    text: localizedText(1500),
    pageId: idSchema.nullable(),
  }),
  banners: z.array(bannerSchema).max(10),
  usefulLinks: z.array(usefulLinkSchema).max(50),
  statistics: z.array(statisticItemSchema).max(8),
  modules: z.record(z.string(), z.boolean()).refine((v) => Object.keys(v).every((k) => (MODULE_KEYS as readonly string[]).includes(k)), 'Noma’lum modul'),
} as const;

export type SettingsKey = keyof typeof SETTINGS_SCHEMAS;
export const SETTINGS_KEYS = Object.keys(SETTINGS_SCHEMAS) as SettingsKey[];
export type SettingsGroupValue<K extends SettingsKey> = z.infer<(typeof SETTINGS_SCHEMAS)[K]>;
export type SiteSettingsAdmin = { [K in SettingsKey]: SettingsGroupValue<K> };

/** PATCH /admin/settings — faqat berilgan guruhlar yangilanadi. */
export const settingsPatchSchema = z
  .object({
    general: SETTINGS_SCHEMAS.general,
    topBar: SETTINGS_SCHEMAS.topBar,
    contacts: SETTINGS_SCHEMAS.contacts,
    social: SETTINGS_SCHEMAS.social,
    footer: SETTINGS_SCHEMAS.footer,
    seo: SETTINGS_SCHEMAS.seo,
    homeAbout: SETTINGS_SCHEMAS.homeAbout,
    banners: SETTINGS_SCHEMAS.banners,
    usefulLinks: SETTINGS_SCHEMAS.usefulLinks,
    statistics: SETTINGS_SCHEMAS.statistics,
    modules: SETTINGS_SCHEMAS.modules,
  })
  .partial();
export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>;

export const DEFAULT_SETTINGS: SiteSettingsAdmin = {
  general: { officialName: { uz: '', ru: '', en: '' }, shortName: { uz: '', ru: '', en: '' }, logoMediaId: null },
  topBar: { isActive: false, text: { uz: '', ru: '', en: '' }, linkUrl: '' },
  contacts: { address: { uz: '', ru: '', en: '' }, phones: [], email: '', workingHours: { uz: '', ru: '', en: '' }, mapUrl: '' },
  social: { telegram: '', instagram: '', facebook: '', youtube: '' },
  footer: { text: { uz: '', ru: '', en: '' } },
  seo: { defaultTitle: { uz: '', ru: '', en: '' }, defaultDescription: { uz: '', ru: '', en: '' }, ogImageMediaId: null },
  homeAbout: { title: { uz: '', ru: '', en: '' }, text: { uz: '', ru: '', en: '' }, pageId: null },
  banners: [],
  usefulLinks: [],
  statistics: [],
  modules: {},
};

// ───────────── Audit va qidiruv ─────────────

export const auditListQuery = paginationQuery.extend({
  entity: z.string().trim().max(50).optional(),
  action: z.string().trim().max(50).optional(),
  q: qFilter,
});

export const publicListQuery = paginationQuery.extend({ locale: localeSchema.default('uz') });
export const publicNewsQuery = publicListQuery.extend({
  type: z.enum(NEWS_TYPES).optional(),
  category: z.string().trim().max(120).optional(),
  q: qFilter,
  important: z.enum(['true', 'false']).optional(),
});
export const publicDocumentsQuery = publicListQuery.extend({
  type: z.string().trim().max(200).optional(), // vergul bilan ajratilgan DocumentType'lar
  category: z.string().trim().max(120).optional(),
  q: qFilter,
});
export const publicSearchQuery = publicListQuery.extend({
  q: z.string().trim().min(2, 'Kamida 2 ta belgi kiriting').max(200),
});

// ───────────── Videogalereya ─────────────

export const videoTranslationSchema = z.object({
  title: text(250).min(1, 'Sarlavhani kiriting'),
  description: text(2000),
});
export type VideoTranslationInput = z.infer<typeof videoTranslationSchema>;

export const videoUrlSchema = httpUrlSchema.refine((v) => parseVideoUrl(v) !== null, 'Faqat YouTube yoki Vimeo havolasi qabul qilinadi');

/** Video manbasi: YouTube/Vimeo havolasi YOKI saytga yuklangan fayl (video media ID) — aynan bittasi. */
export const videoCreateSchema = z
  .object({
    sourceUrl: videoUrlSchema.nullish(),
    fileMediaId: idSchema.nullish(),
    thumbMediaId: idSchema.nullish(),
    sortOrder: z.number().int().min(0).max(9999),
    translations: translations(videoTranslationSchema),
  })
  .refine((v) => Boolean(v.sourceUrl) !== Boolean(v.fileMediaId), {
    path: ['sourceUrl'],
    message: 'YouTube/Vimeo havolasini kiriting yoki video fayl yuklang',
  });
export type VideoCreateInput = z.infer<typeof videoCreateSchema>;
export const videoUpdateSchema = z
  .object({
    sourceUrl: videoUrlSchema,
    fileMediaId: idSchema,
    thumbMediaId: idSchema.nullable(),
    sortOrder: z.number().int().min(0).max(9999),
    translations: translationsPatch(videoTranslationSchema),
  })
  .partial();
export type VideoUpdateInput = z.infer<typeof videoUpdateSchema>;

// ───────────── Bitiruvchilar ─────────────

export const alumnusTranslationSchema = z.object({
  fullName: text(200).min(1, 'F.I.Sh. ni kiriting'),
  program: text(250),
  workplace: text(250),
  story: text(3000),
});
export type AlumnusTranslationInput = z.infer<typeof alumnusTranslationSchema>;
const yearSchema = z.number().int().min(1950, 'Yil noto‘g‘ri').max(2100, 'Yil noto‘g‘ri');
export const alumnusCreateSchema = z.object({
  graduationYear: yearSchema.nullish(),
  photoMediaId: idSchema.nullish(),
  sortOrder: z.number().int().min(0).max(9999),
  translations: translations(alumnusTranslationSchema),
});
export type AlumnusCreateInput = z.infer<typeof alumnusCreateSchema>;
export const alumnusUpdateSchema = z
  .object({
    graduationYear: yearSchema.nullable(),
    photoMediaId: idSchema.nullable(),
    sortOrder: z.number().int().min(0).max(9999),
    translations: translationsPatch(alumnusTranslationSchema),
  })
  .partial();
export type AlumnusUpdateInput = z.infer<typeof alumnusUpdateSchema>;

// ───────────── Hamkor korxonalar ─────────────

export const partnerTranslationSchema = z.object({
  name: text(200).min(1, 'Nomini kiriting'),
  description: text(2000),
});
export type PartnerTranslationInput = z.infer<typeof partnerTranslationSchema>;
export const partnerCreateSchema = z.object({
  websiteUrl: optionalUrlSchema.nullish(),
  logoMediaId: idSchema.nullish(),
  sortOrder: z.number().int().min(0).max(9999),
  translations: translations(partnerTranslationSchema),
});
export type PartnerCreateInput = z.infer<typeof partnerCreateSchema>;
export const partnerUpdateSchema = z
  .object({
    websiteUrl: optionalUrlSchema.nullable(),
    logoMediaId: idSchema.nullable(),
    sortOrder: z.number().int().min(0).max(9999),
    translations: translationsPatch(partnerTranslationSchema),
  })
  .partial();
export type PartnerUpdateInput = z.infer<typeof partnerUpdateSchema>;

// ───────────── Foydalanuvchilar ─────────────

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email('Elektron pochta noto‘g‘ri').max(200),
  name: text(120).min(1, 'Ismni kiriting'),
  role: z.enum(ROLES),
  password: passwordSchema,
});
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export const userUpdateSchema = z
  .object({
    name: text(120).min(1, 'Ismni kiriting'),
    role: z.enum(ROLES),
    isActive: z.boolean(),
    password: passwordSchema,
  })
  .partial();
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

// ───────────── Statistika ─────────────

export const statsQuery = z.object({ days: z.coerce.number().int().min(7).max(365).default(30) });
export const trackSchema = z.object({ path: z.string().trim().min(1).max(300) });
