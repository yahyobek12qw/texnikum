import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type {
  AdminAlumnus,
  AdminPartner,
  AdminStats,
  AdminUserRow,
  AdminVideo,
  AdminCategory,
  AdminDocument,
  AdminMedia,
  AdminNavigation,
  AdminNews,
  AdminPage,
  AdminPageVersion,
  AdminProgram,
  AdminSession,
  AdminStaff,
  AuditLogEntry,
  DashboardStats,
  MediaUsage,
  NavigationUpdateInput,
  Paginated,
  PublicNewsDetail,
  PublicPage,
  SettingsPatchInput,
  SiteSettingsAdmin,
  TranslationOverviewRow,
} from '@uchkoprik/shared';
import { del, get, patch, post, put, upload, type Query } from '../api/client';

const base = '/api/v1/admin';

// ───────────── Auth ─────────────
export const authApi = {
  login: (email: string, password: string) => post<AdminSession>(`${base}/auth/login`, { email, password }),
  logout: () => post<void>(`${base}/auth/logout`),
  me: () => get<AdminSession>(`${base}/auth/me`),
  changePassword: (currentPassword: string, newPassword: string) =>
    post<void>(`${base}/auth/change-password`, { currentPassword, newPassword }),
};

// ───────────── Umumiy resurs fabrikasi ─────────────
interface ResourceOptions {
  /** Qo'shimcha keshlarni ham yangilash (masalan, dashboard) */
  alsoInvalidate?: QueryKey[];
}

function resource<T, Create = unknown, Update = unknown>(path: string, key: string, opts: ResourceOptions = {}) {
  const url = `${base}/${path}`;
  const useInvalidate = () => {
    const qc = useQueryClient();
    return () => {
      void qc.invalidateQueries({ queryKey: [key] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['translations'] });
      for (const k of opts.alsoInvalidate ?? []) void qc.invalidateQueries({ queryKey: k });
    };
  };
  return {
    key,
    useList: <R = Paginated<T>>(params: Query = {}) =>
      useQuery({ queryKey: [key, 'list', params], queryFn: () => get<R>(url, params), placeholderData: keepPreviousData }),
    useItem: (id: string | undefined) =>
      useQuery({ queryKey: [key, 'item', id], queryFn: () => get<T>(`${url}/${id}`), enabled: Boolean(id) }),
    useCreate: () => {
      const invalidate = useInvalidate();
      return useMutation({ mutationFn: (body: Create) => post<T>(url, body), onSuccess: invalidate });
    },
    useUpdate: () => {
      const invalidate = useInvalidate();
      return useMutation({ mutationFn: ({ id, body }: { id: string; body: Update }) => patch<T>(`${url}/${id}`, body), onSuccess: invalidate });
    },
    useRemove: () => {
      const invalidate = useInvalidate();
      return useMutation({ mutationFn: (id: string) => del(`${url}/${id}`), onSuccess: invalidate });
    },
    useAction: () => {
      const invalidate = useInvalidate();
      return useMutation({
        mutationFn: ({ id, action }: { id: string; action: 'publish' | 'unpublish' | 'archive' }) => post<T>(`${url}/${id}/${action}`),
        onSuccess: invalidate,
      });
    },
  };
}

export const pagesApi = resource<AdminPage>('pages', 'pages');
export const newsApi = resource<AdminNews>('news', 'news');
export const documentsApi = resource<AdminDocument>('documents', 'documents');
export const categoriesApi = resource<AdminCategory>('categories', 'categories');
export const programsApi = resource<AdminProgram>('education-programs', 'programs');
export const staffApi = resource<AdminStaff>('staff', 'staff');
export const videosApi = resource<AdminVideo>('videos', 'videos');
export const alumniApi = resource<AdminAlumnus>('alumni', 'alumni');
export const partnersApi = resource<AdminPartner>('partners', 'partners');
export const usersApi = resource<AdminUserRow>('users', 'users');

export const useAdminStats = (days: number) =>
  useQuery({ queryKey: ['stats', days], queryFn: () => get<AdminStats>(`${base}/stats`, { days }) });

// ───────────── Sahifa versiyalari va oldindan ko'rish ─────────────
export const useDashboard = () => useQuery({ queryKey: ['dashboard'], queryFn: () => get<DashboardStats>(`${base}/dashboard`) });

export const usePageVersions = (id: string | undefined) =>
  useQuery({ queryKey: ['pages', 'versions', id], queryFn: () => get<{ items: AdminPageVersion[] }>(`${base}/pages/${id}/versions`), enabled: Boolean(id) });

export function useRestoreVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => post<AdminPage>(`${base}/pages/${id}/restore-version`, { version }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pages'] });
    },
  });
}

export const usePagePreview = (id: string | undefined, locale: string) =>
  useQuery({ queryKey: ['preview', 'page', id, locale], queryFn: () => get<PublicPage>(`${base}/pages/${id}/preview`, { locale }), enabled: Boolean(id), retry: false });
export const useNewsPreview = (id: string | undefined, locale: string) =>
  useQuery({ queryKey: ['preview', 'news', id, locale], queryFn: () => get<PublicNewsDetail>(`${base}/news/${id}/preview`, { locale }), enabled: Boolean(id), retry: false });

// ───────────── Media ─────────────
export const mediaApi = {
  useList: (params: Query) =>
    useQuery({ queryKey: ['media', 'list', params], queryFn: () => get<Paginated<AdminMedia>>(`${base}/media`, params), placeholderData: keepPreviousData }),
  useDetail: (id: string | undefined) =>
    useQuery({ queryKey: ['media', 'item', id], queryFn: () => get<AdminMedia & { usage: MediaUsage[] }>(`${base}/media/${id}`), enabled: Boolean(id) }),
  useUpload: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ file, kind }: { file: File; kind?: 'IMAGE' | 'DOCUMENT' }) => upload<AdminMedia>(`${base}/media`, file, { kind }),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ['media'] });
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
      },
    });
  },
  useUpdate: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, body }: { id: string; body: unknown }) => patch<AdminMedia>(`${base}/media/${id}`, body),
      onSuccess: () => void qc.invalidateQueries({ queryKey: ['media'] }),
    });
  },
  useRemove: () => {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, force }: { id: string; force?: boolean }) => del(`${base}/media/${id}`, force ? { force: 'true' } : undefined),
      onSuccess: () => {
        void qc.invalidateQueries({ queryKey: ['media'] });
        void qc.invalidateQueries({ queryKey: ['dashboard'] });
      },
    });
  },
};

// ───────────── Menyu, sozlamalar, audit, tarjimalar ─────────────
export const useAdminNavigation = () => useQuery({ queryKey: ['navigation'], queryFn: () => get<AdminNavigation>(`${base}/navigation`) });
export function useSaveNavigation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NavigationUpdateInput) => put<AdminNavigation>(`${base}/navigation`, body),
    onSuccess: (data) => {
      qc.setQueryData(['navigation'], data);
      void qc.invalidateQueries({ queryKey: ['public', 'navigation'] });
    },
  });
}

export const useAdminSettings = () => useQuery({ queryKey: ['settings'], queryFn: () => get<SiteSettingsAdmin>(`${base}/settings`) });
export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SettingsPatchInput) => patch<SiteSettingsAdmin>(`${base}/settings`, body),
    onSuccess: (data) => {
      qc.setQueryData(['settings'], data);
      void qc.invalidateQueries({ queryKey: ['public'] });
      // modullar o'zgarganda sessiya ma'lumoti (yon menyu) yangilanadi
      void qc.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

export const useAuditLogs = (params: Query) =>
  useQuery({ queryKey: ['audit', params], queryFn: () => get<Paginated<AuditLogEntry>>(`${base}/audit-logs`, params), placeholderData: keepPreviousData });

export const useTranslationOverview = (params: Query) =>
  useQuery({ queryKey: ['translations', params], queryFn: () => get<Paginated<TranslationOverviewRow>>(`${base}/translations`, params), placeholderData: keepPreviousData });
