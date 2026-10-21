export const CONTENT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];
export const STATUS_LABELS: Record<ContentStatus, string> = {
  DRAFT: 'Qoralama',
  PUBLISHED: 'Nashr qilingan',
  ARCHIVED: 'Arxivlangan',
};

export const PAGE_TEMPLATES = ['DEFAULT', 'SECTION', 'DOCUMENTS', 'STAFF', 'PROGRAMS'] as const;
export type PageTemplate = (typeof PAGE_TEMPLATES)[number];
export const PAGE_TEMPLATE_LABELS: Record<PageTemplate, string> = {
  DEFAULT: 'Oddiy sahifa',
  SECTION: 'Bo‘lim (ichki sahifalar ro‘yxati bilan)',
  DOCUMENTS: 'Hujjatlar ro‘yxati bilan',
  STAFF: 'Xodimlar ro‘yxati bilan',
  PROGRAMS: 'Ta’lim yo‘nalishlari ro‘yxati bilan',
};

export const NEWS_TYPES = ['NEWS', 'ANNOUNCEMENT', 'EVENT'] as const;
export type NewsType = (typeof NEWS_TYPES)[number];
export const NEWS_TYPE_LABELS: Record<NewsType, string> = {
  NEWS: 'Yangilik',
  ANNOUNCEMENT: 'E’lon',
  EVENT: 'Tadbir',
};
/** Ommaviy saytdagi marshrut segmenti. */
export const NEWS_TYPE_ROUTES: Record<NewsType, string> = {
  NEWS: 'news',
  ANNOUNCEMENT: 'announcements',
  EVENT: 'events',
};

export const DOCUMENT_TYPES = [
  'REGULATION',
  'CHARTER',
  'PLAN',
  'REPORT',
  'OPEN_DATA',
  'ANTICORRUPTION',
  'ADMISSION',
  'OTHER',
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  REGULATION: 'Me’yoriy hujjat',
  CHARTER: 'Nizom',
  PLAN: 'Tasdiqlangan reja',
  REPORT: 'Hisobot',
  OPEN_DATA: 'Ochiq ma’lumot',
  ANTICORRUPTION: 'Korrupsiyaga qarshi kurashish',
  ADMISSION: 'Qabul hujjati',
  OTHER: 'Boshqa',
};

export const MEDIA_KINDS = ['IMAGE', 'DOCUMENT', 'VIDEO'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const STAFF_KINDS = ['LEADERSHIP', 'TEACHER', 'STAFF'] as const;
export type StaffKind = (typeof STAFF_KINDS)[number];
export const STAFF_KIND_LABELS: Record<StaffKind, string> = {
  LEADERSHIP: 'Rahbariyat',
  TEACHER: 'O‘qituvchi',
  STAFF: 'Xodim',
};

export const NAV_ITEM_KINDS = ['PAGE', 'ROUTE', 'EXTERNAL'] as const;
export type NavItemKind = (typeof NAV_ITEM_KINDS)[number];

export const CATEGORY_SCOPES = ['NEWS', 'DOCUMENT'] as const;
export type CategoryScope = (typeof CATEGORY_SCOPES)[number];
export const CATEGORY_SCOPE_LABELS: Record<CategoryScope, string> = {
  NEWS: 'Yangiliklar',
  DOCUMENT: 'Hujjatlar',
};

/** Ommaviy saytdagi qat'iy (CMS sahifasi bo'lmagan) marshrutlar — menyuga ROUTE sifatida biriktiriladi. */
export const FIXED_ROUTES = [
  { route: '/', label: 'Bosh sahifa' },
  { route: '/news', label: 'Yangiliklar' },
  { route: '/announcements', label: 'E’lonlar' },
  { route: '/events', label: 'Tadbirlar' },
  { route: '/gallery', label: 'Foto va video galereya' },
  { route: '/alumni', label: 'Bitiruvchilar' },
  { route: '/partners', label: 'Hamkor korxonalar' },
  { route: '/useful-links', label: 'Foydali havolalar' },
  { route: '/contacts', label: 'Aloqa' },
  { route: '/search', label: 'Qidiruv' },
] as const;

export const VIDEO_PROVIDERS = ['YOUTUBE', 'VIMEO', 'UPLOAD'] as const;
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number];
/** Tashqi (havola orqali) provayderlar; UPLOAD — saytga yuklangan fayl. */
export type ExternalVideoProvider = Exclude<VideoProvider, 'UPLOAD'>;

/** Yuklanadigan video formatlari (brauzer ijro eta oladiganlari). */
export const VIDEO_UPLOAD_EXTENSIONS = ['mp4', 'm4v', 'mov', 'webm'] as const;
