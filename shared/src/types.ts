import type { ModulesState } from './modules.js';
import type { Permission, Role } from './permissions.js';
import type { VideoProvider } from './enums.js';
import type {
  CategoryScope,
  ContentStatus,
  DocumentType,
  MediaKind,
  NavItemKind,
  NewsType,
  PageTemplate,
  StaffKind,
} from './enums.js';
import type { Locale } from './locales.js';
import type {
  AlumnusTranslationInput,
  CategoryTranslationInput as CategoryTranslationInputShape,
  PartnerTranslationInput,
  StatisticItem,
  VideoTranslationInput,
  DocumentTranslationInput,
  NewsTranslationInput,
  PageOptions,
  PageTranslationInput,
  ProgramTranslationInput,
  SiteSettingsAdmin,
  StaffTranslationInput,
} from './schemas.js';

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}
export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export type TranslationMap<T> = Partial<Record<Locale, T>>;

// ───────────── Ommaviy API ─────────────

export interface ImageRef {
  id: string;
  url: string;
  thumbUrl: string | null;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface PublicBanner {
  id: string;
  image: ImageRef | null;
  title: string;
  text: string;
  linkUrl: string;
}

export interface PublicSettings {
  officialName: string;
  shortName: string;
  logo: ImageRef | null;
  topBar: { text: string; linkUrl: string } | null;
  address: string;
  phones: string[];
  email: string;
  workingHours: string;
  mapUrl: string;
  social: { telegram: string; instagram: string; facebook: string; youtube: string };
  footerText: string;
  seo: { defaultTitle: string; defaultDescription: string; ogImage: ImageRef | null };
  homeAbout: { title: string; text: string; pageHref: string | null };
  banners: PublicBanner[];
  usefulLinks: { id: string; label: string; url: string }[];
  /** Qaysi funksiya modullari yoqilgan (o'chirilganlari saytda yashiriladi) */
  modules: ModulesState;
  statistics: { id: string; value: string; label: string }[];
}

export interface PublicNavItem {
  id: string;
  label: string;
  href: string;
  newTab: boolean;
  external: boolean;
  children: PublicNavItem[];
}
export interface PublicNavigation {
  main: PublicNavItem[];
  footer: PublicNavItem[];
}

export interface Alternate {
  locale: Locale;
  /** Shu tildagi slug (tarjima mavjud bo'lmasa null) */
  slug: string | null;
  available: boolean;
}

export interface Breadcrumb {
  title: string;
  href: string;
}

export interface TranslationInfo {
  /** Foydalanuvchi so'ragan til */
  requestedLocale: Locale;
  /** Kontent haqiqatda qaysi tilda berilmoqda */
  locale: Locale;
  isFallback: boolean;
}

export interface PublicPageChild {
  id: string;
  title: string;
  slug: string;
  href: string;
}

/** Sahifa tegishli bo'lim: bo'lim sarlavhasi va uning ichki sahifalari (yon navigatsiya uchun). */
export interface PageSection {
  title: string;
  href: string;
  items: PublicPageChild[];
}

export interface PublicPage extends TranslationInfo {
  id: string;
  template: PageTemplate;
  options: PageOptions | null;
  title: string;
  slug: string;
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  updatedAt: string;
  alternates: Alternate[];
  breadcrumbs: Breadcrumb[];
  children: PublicPageChild[];
  section: PageSection | null;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  scope: CategoryScope;
}

export interface PublicNewsItem extends TranslationInfo {
  id: string;
  type: NewsType;
  title: string;
  slug: string;
  excerpt: string;
  cover: ImageRef | null;
  category: { id: string; name: string; slug: string } | null;
  publishedAt: string;
  eventAt: string | null;
  isImportant: boolean;
}

export interface PublicNewsDetail extends PublicNewsItem {
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
  alternates: Alternate[];
}

export interface PublicDocument extends TranslationInfo {
  id: string;
  type: DocumentType;
  title: string;
  description: string;
  number: string | null;
  docDate: string | null;
  category: { id: string; name: string } | null;
  file: { name: string; mimeType: string; size: number; extension: string };
  downloadUrl: string;
}

export interface PublicProgram extends TranslationInfo {
  id: string;
  code: string | null;
  title: string;
  summary: string;
  description: string;
  duration: string;
  qualification: string;
}

export interface PublicStaffMember extends TranslationInfo {
  id: string;
  kind: StaffKind;
  fullName: string;
  position: string;
  bio: string;
  email: string | null;
  phone: string | null;
  photo: ImageRef | null;
}

export interface PublicGalleryItem {
  id: string;
  image: ImageRef;
  caption: string;
  createdAt: string;
}

export interface SearchResult {
  type: 'page' | 'news' | 'document' | 'program';
  id: string;
  title: string;
  snippet: string;
  href: string;
  date: string | null;
  isFallback: boolean;
  locale: Locale;
}

// ───────────── Admin API ─────────────

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
export interface AdminSession {
  user: AdminUser;
  csrfToken: string;
  permissions: Permission[];
  modules: ModulesState;
}

export interface TranslationStatus {
  uz: boolean;
  ru: boolean;
  en: boolean;
}

export interface AdminMediaRef {
  id: string;
  kind: MediaKind;
  originalName: string;
  url: string | null;
  thumbUrl: string | null;
}

export interface AdminPage {
  id: string;
  module: string | null;
  parentId: string | null;
  parentTitle: string | null;
  template: PageTemplate;
  options: PageOptions | null;
  status: ContentStatus;
  sortOrder: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  title: string;
  translationStatus: TranslationStatus;
  translations: TranslationMap<PageTranslationInput>;
}

export interface AdminPageVersion {
  id: string;
  version: number;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface AdminNews {
  id: string;
  type: NewsType;
  status: ContentStatus;
  categoryId: string | null;
  categoryName: string | null;
  cover: AdminMediaRef | null;
  isImportant: boolean;
  publishedAt: string | null;
  scheduledAt: string | null;
  eventAt: string | null;
  createdAt: string;
  updatedAt: string;
  title: string;
  translationStatus: TranslationStatus;
  translations: TranslationMap<NewsTranslationInput>;
}

export interface AdminDocument {
  id: string;
  type: DocumentType;
  status: ContentStatus;
  categoryId: string | null;
  categoryName: string | null;
  number: string | null;
  docDate: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  title: string;
  file: { id: string; originalName: string; mimeType: string; size: number };
  translationStatus: TranslationStatus;
  translations: TranslationMap<DocumentTranslationInput>;
}

export interface AdminCategory {
  id: string;
  scope: CategoryScope;
  sortOrder: number;
  name: string;
  usageCount: number;
  translationStatus: TranslationStatus;
  translations: TranslationMap<CategoryTranslationInputShape>;
}

export interface AdminProgram {
  id: string;
  code: string | null;
  status: ContentStatus;
  sortOrder: number;
  publishedAt: string | null;
  updatedAt: string;
  title: string;
  translationStatus: TranslationStatus;
  translations: TranslationMap<ProgramTranslationInput>;
}

export interface AdminStaff {
  id: string;
  kind: StaffKind;
  status: ContentStatus;
  photo: AdminMediaRef | null;
  email: string | null;
  phone: string | null;
  sortOrder: number;
  updatedAt: string;
  title: string;
  translationStatus: TranslationStatus;
  translations: TranslationMap<StaffTranslationInput>;
}

export interface AdminMedia {
  id: string;
  kind: MediaKind;
  originalName: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  url: string | null;
  thumbUrl: string | null;
  downloadUrl: string;
  showInGallery: boolean;
  createdAt: string;
  translations: Record<Locale, { alt: string; caption: string }>;
}

export interface MediaUsage {
  type: string;
  id: string;
  title: string;
  /** true bo'lsa, fayl majburiy bog'langan va o'chirib bo'lmaydi */
  blocking: boolean;
}

export interface AdminNavItem {
  id: string;
  kind: NavItemKind;
  pageId: string | null;
  pageTitle: string | null;
  route: string | null;
  url: string | null;
  newTab: boolean;
  labels: Record<Locale, string>;
  children: AdminNavItem[];
}
export interface AdminNavigation {
  menus: { key: 'main' | 'footer'; items: AdminNavItem[] }[];
}

export interface AuditLogEntry {
  id: string;
  userEmail: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  ip: string | null;
  createdAt: string;
}

export interface DashboardStats {
  pages: { total: number; published: number; draft: number; archived: number };
  news: { total: number; published: number; draft: number };
  documents: { total: number; published: number };
  media: { total: number };
  recentContent: { type: string; id: string; title: string; status: ContentStatus; updatedAt: string }[];
  recentActions: AuditLogEntry[];
}

export interface TranslationOverviewRow {
  entity: 'page' | 'news' | 'document' | 'program' | 'staff';
  id: string;
  title: string;
  status: ContentStatus;
  translations: TranslationStatus;
}

export type { SiteSettingsAdmin };

// ───────────── Videogalereya, bitiruvchilar, hamkorlar ─────────────

export interface PublicVideo extends TranslationInfo {
  id: string;
  title: string;
  description: string;
  provider: VideoProvider;
  /** YouTube/Vimeo uchun iframe manzili (yuklangan videoda null) */
  embedUrl: string | null;
  watchUrl: string | null;
  /** Saytga yuklangan video fayl manzili (havola orqali bo'lsa null) */
  fileUrl: string | null;
  thumbnail: ImageRef | null;
  /** Tashqi (YouTube) ko'rsatkich rasmi, o'z rasmi yo'q bo'lsa */
  thumbnailUrl: string | null;
}

export interface PublicAlumnus extends TranslationInfo {
  id: string;
  graduationYear: number | null;
  fullName: string;
  program: string;
  workplace: string;
  story: string;
  photo: ImageRef | null;
}

export interface PublicPartner extends TranslationInfo {
  id: string;
  name: string;
  description: string;
  websiteUrl: string | null;
  logo: ImageRef | null;
}

export interface AdminVideoFile {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface AdminVideo {
  id: string;
  sourceUrl: string;
  /** Saytga yuklangan fayl (provider = UPLOAD) */
  file: AdminVideoFile | null;
  provider: VideoProvider;
  externalId: string;
  thumb: AdminMediaRef | null;
  status: ContentStatus;
  sortOrder: number;
  updatedAt: string;
  title: string;
  translationStatus: TranslationStatus;
  translations: TranslationMap<VideoTranslationInput>;
}

export interface AdminAlumnus {
  id: string;
  graduationYear: number | null;
  photo: AdminMediaRef | null;
  status: ContentStatus;
  sortOrder: number;
  updatedAt: string;
  title: string;
  translationStatus: TranslationStatus;
  translations: TranslationMap<AlumnusTranslationInput>;
}

export interface AdminPartner {
  id: string;
  websiteUrl: string | null;
  logo: AdminMediaRef | null;
  status: ContentStatus;
  sortOrder: number;
  updatedAt: string;
  title: string;
  translationStatus: TranslationStatus;
  translations: TranslationMap<PartnerTranslationInput>;
}

export interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

// ───────────── Statistika ─────────────

export interface AdminStats {
  days: number;
  totals: { views: number; activeDays: number; averagePerDay: number };
  daily: { day: string; count: number }[];
  topPaths: { path: string; count: number }[];
  content: {
    pages: number;
    news: number;
    announcements: number;
    events: number;
    documents: number;
    videos: number;
    photos: number;
    programs: number;
    staff: number;
    alumni: number;
    partners: number;
    media: number;
    users: number;
  };
  /** Ko'rishlar taxminiy: cookie va IP saqlanmaydi, takroriy tashrif ajratilmaydi. */
  note: string;
}

export type { StatisticItem };
