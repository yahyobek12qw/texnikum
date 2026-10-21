import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import type { ModuleKey, Permission } from '@uchkoprik/shared';
import { Loading } from '../components/ui/Feedback';
import NotFoundPage from '../pages/NotFoundPage';
import { AuthProvider, useAuth } from './auth';
import AdminLayout from './components/AdminLayout';
import { Guard } from './components/Guard';
import CategoriesPage from './pages/CategoriesPage';
import DashboardPage from './pages/DashboardPage';
import DocumentsPage from './pages/DocumentsPage';
import { AlumniAdminPage, PartnersAdminPage, VideosAdminPage } from './pages/EntityPages';
import LoginPage from './pages/LoginPage';
import MediaPage from './pages/MediaPage';
import { AccountPage, AuditPage, PreviewPage, TranslationsPage } from './pages/MiscPages';
import ModulesPage from './pages/ModulesPage';
import NavigationPage from './pages/NavigationPage';
import NewsEditPage from './pages/NewsEditPage';
import NewsListPage from './pages/NewsListPage';
import PageEditPage from './pages/PageEditPage';
import PagesListPage from './pages/PagesListPage';
import ProgramsPage from './pages/ProgramsPage';
import { HomeSettingsPage, SiteSettingsPage } from './pages/SettingsPages';
import StaffPage from './pages/StaffPage';
import StatsPage from './pages/StatsPage';
import UsersPage from './pages/UsersPage';

function AdminNotFound() {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-2xl">Sahifa topilmadi</h1>
      <p className="mt-2 text-muted">Bunday boshqaruv sahifasi mavjud emas.</p>
    </div>
  );
}

/** Oldindan ko'rish ham faqat tizimga kirgan foydalanuvchiga ochiq. */
function PreviewGate({ kind }: { kind: 'page' | 'news' }) {
  const { status } = useAuth();
  if (status === 'loading') return <Loading className="min-h-screen" />;
  if (status === 'anonymous') return <Navigate to="/admin/login" replace />;
  return <PreviewPage kind={kind} />;
}

const g = (permission: Permission | undefined, modules: ModuleKey[] | undefined, el: ReactNode) => (
  <Guard {...(permission ? { permission } : {})} {...(modules ? { modules } : {})}>{el}</Guard>
);

// Bu modul App ichida lazy yuklanadi: admin kodi ommaviy saytning asosiy bundle'iga kirmaydi.
export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<LoginPage />} />
        <Route path="preview/page/:id" element={<PreviewGate kind="page" />} />
        <Route path="preview/news/:id" element={<PreviewGate kind="news" />} />
        <Route element={<AdminLayout />}>
          <Route index element={g('content.read', undefined, <DashboardPage />)} />
          <Route path="pages" element={g('content.read', undefined, <PagesListPage />)} />
          <Route path="pages/:id" element={g('content.read', undefined, <PageEditPage />)} />
          <Route path="news" element={g('content.read', ['news'], <NewsListPage type="NEWS" />)} />
          <Route path="announcements" element={g('content.read', ['announcements'], <NewsListPage type="ANNOUNCEMENT" />)} />
          <Route path="events" element={g('content.read', ['events'], <NewsListPage type="EVENT" />)} />
          <Route path="news/:id" element={g('content.read', ['news', 'announcements', 'events'], <NewsEditPage />)} />
          <Route path="documents" element={g('content.read', ['documents', 'admission'], <DocumentsPage />)} />
          <Route path="media" element={g('content.read', undefined, <MediaPage />)} />
          <Route path="categories" element={g('content.read', undefined, <CategoriesPage />)} />
          <Route path="programs" element={g('content.read', ['programs'], <ProgramsPage />)} />
          <Route path="staff" element={g('content.read', ['staff', 'teachers'], <StaffPage />)} />
          <Route path="videos" element={g('content.read', ['videoGallery'], <VideosAdminPage />)} />
          <Route path="alumni" element={g('content.read', ['alumni'], <AlumniAdminPage />)} />
          <Route path="partners" element={g('content.read', ['partners'], <PartnersAdminPage />)} />
          <Route path="navigation" element={g('navigation.manage', undefined, <NavigationPage />)} />
          <Route path="home" element={g('settings.manage', undefined, <HomeSettingsPage />)} />
          <Route path="settings" element={g('settings.manage', undefined, <SiteSettingsPage />)} />
          <Route path="translations" element={g('content.read', ['translations'], <TranslationsPage />)} />
          <Route path="stats" element={g('stats.view', ['statistics'], <StatsPage />)} />
          <Route path="users" element={g('users.manage', ['users'], <UsersPage />)} />
          <Route path="modules" element={g('modules.manage', undefined, <ModulesPage />)} />
          <Route path="audit" element={g('audit.view', undefined, <AuditPage />)} />
          <Route path="account" element={<AccountPage />} />
          <Route path="*" element={<AdminNotFound />} />
        </Route>
        <Route path="*" element={<NotFoundPage standalone />} />
      </Routes>
    </AuthProvider>
  );
}
