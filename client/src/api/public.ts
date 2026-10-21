import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  Locale,
  NewsType,
  Paginated,
  PublicAlumnus,
  PublicPartner,
  PublicVideo,
  PublicCategory,
  PublicDocument,
  PublicGalleryItem,
  PublicNavigation,
  PublicNewsDetail,
  PublicNewsItem,
  PublicPage,
  PublicProgram,
  PublicSettings,
  PublicStaffMember,
  SearchResult,
  StaffKind,
} from '@uchkoprik/shared';
import { get, post, type Query } from './client';

const base = '/api/v1/public';

export const publicApi = {
  settings: (locale: Locale) => get<PublicSettings>(`${base}/settings`, { locale }),
  navigation: (locale: Locale) => get<PublicNavigation>(`${base}/navigation`, { locale }),
  page: (slug: string, locale: Locale) => get<PublicPage>(`${base}/pages/${encodeURIComponent(slug)}`, { locale }),
  news: (q: Query) => get<Paginated<PublicNewsItem>>(`${base}/news`, q),
  newsItem: (slug: string, locale: Locale) => get<PublicNewsDetail>(`${base}/news/${encodeURIComponent(slug)}`, { locale }),
  documents: (q: Query) => get<Paginated<PublicDocument>>(`${base}/documents`, q),
  categories: (locale: Locale, scope: 'NEWS' | 'DOCUMENT') => get<{ items: PublicCategory[] }>(`${base}/categories`, { locale, scope }),
  programs: (locale: Locale) => get<{ items: PublicProgram[] }>(`${base}/education-programs`, { locale }),
  staff: (locale: Locale, kind?: StaffKind) => get<{ items: PublicStaffMember[] }>(`${base}/staff`, { locale, kind }),
  gallery: (q: Query) => get<Paginated<PublicGalleryItem>>(`${base}/gallery`, q),
  search: (q: Query) => get<Paginated<SearchResult>>(`${base}/search`, q),
  videos: (q: Query) => get<Paginated<PublicVideo>>(`${base}/videos`, q),
  alumni: (q: Query) => get<Paginated<PublicAlumnus>>(`${base}/alumni`, q),
  partners: (locale: Locale) => get<{ items: PublicPartner[] }>(`${base}/partners`, { locale }),
  track: (path: string) => post<void>(`${base}/track`, { path }),
};

const STALE = 30_000;

export const useSettings = (locale: Locale) =>
  useQuery({ queryKey: ['public', 'settings', locale], queryFn: () => publicApi.settings(locale), staleTime: STALE });

export const useNavigation = (locale: Locale) =>
  useQuery({ queryKey: ['public', 'navigation', locale], queryFn: () => publicApi.navigation(locale), staleTime: STALE });

export const usePublicPage = (slug: string, locale: Locale) =>
  useQuery({ queryKey: ['public', 'page', slug, locale], queryFn: () => publicApi.page(slug, locale), staleTime: STALE, retry: false });

export const useNewsList = (params: { locale: Locale; type?: NewsType; page?: number; pageSize?: number; category?: string; q?: string; important?: boolean }) =>
  useQuery({
    queryKey: ['public', 'news', params],
    queryFn: () => publicApi.news({ ...params, important: params.important ? 'true' : undefined }),
    placeholderData: keepPreviousData,
    staleTime: STALE,
  });

export const usePublicNewsItem = (slug: string, locale: Locale) =>
  useQuery({ queryKey: ['public', 'news-item', slug, locale], queryFn: () => publicApi.newsItem(slug, locale), staleTime: STALE, retry: false });

export const usePublicDocuments = (params: { locale: Locale; type?: string; category?: string; q?: string; page?: number; pageSize?: number }) =>
  useQuery({ queryKey: ['public', 'documents', params], queryFn: () => publicApi.documents(params), placeholderData: keepPreviousData, staleTime: STALE });

export const usePublicCategories = (locale: Locale, scope: 'NEWS' | 'DOCUMENT') =>
  useQuery({ queryKey: ['public', 'categories', locale, scope], queryFn: () => publicApi.categories(locale, scope), staleTime: STALE });

export const usePublicPrograms = (locale: Locale) =>
  useQuery({ queryKey: ['public', 'programs', locale], queryFn: () => publicApi.programs(locale), staleTime: STALE });

export const usePublicStaff = (locale: Locale, kind?: StaffKind) =>
  useQuery({ queryKey: ['public', 'staff', locale, kind], queryFn: () => publicApi.staff(locale, kind), staleTime: STALE });

export const useGallery = (params: { locale: Locale; page?: number; pageSize?: number }) =>
  useQuery({ queryKey: ['public', 'gallery', params], queryFn: () => publicApi.gallery(params), placeholderData: keepPreviousData, staleTime: STALE });

export const usePublicSearch = (params: { locale: Locale; q: string; page?: number }) =>
  useQuery({
    queryKey: ['public', 'search', params],
    queryFn: () => publicApi.search(params),
    enabled: params.q.trim().length >= 2,
    placeholderData: keepPreviousData,
  });

export const useVideos = (params: { locale: Locale; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: ['public', 'videos', params], queryFn: () => publicApi.videos(params), placeholderData: keepPreviousData, staleTime: STALE, enabled });

export const useAlumni = (params: { locale: Locale; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: ['public', 'alumni', params], queryFn: () => publicApi.alumni(params), placeholderData: keepPreviousData, staleTime: STALE, enabled });

export const usePartners = (locale: Locale, enabled = true) =>
  useQuery({ queryKey: ['public', 'partners', locale], queryFn: () => publicApi.partners(locale), staleTime: STALE, enabled });
