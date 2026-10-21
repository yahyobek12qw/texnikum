import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, lazy, Suspense, useState, type ErrorInfo, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { DEFAULT_LOCALE, LOCALES, isLocale, type Locale } from '@uchkoprik/shared';
import { ApiError } from '../api/client';
import { Loading } from '../components/ui/Feedback';
import { ToastProvider } from '../components/ui/Toast';
import PublicLayout from '../layouts/PublicLayout';
import CmsPage from '../pages/CmsPage';
import HomePage from '../pages/HomePage';
import NewsDetailPage from '../pages/NewsDetailPage';
import NewsListPage from '../pages/NewsListPage';
import NotFoundPage from '../pages/NotFoundPage';
import RouteErrorPage from '../pages/RouteErrorPage';
import { ContactsPage, SearchPage, UsefulLinksPage } from '../pages/SimplePages';
import GalleryPage from '../pages/GalleryPage';
import { AlumniPage, PartnersPage } from '../pages/AlumniPartnersPages';
import { ModuleGate } from '../hooks/useModules';

const AdminApp = lazy(() => import('../admin/AdminApp'));

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }
  override render() {
    return this.state.failed ? <RouteErrorPage /> : this.props.children;
  }
}

function preferredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem('locale');
    if (isLocale(stored)) return stored;
  } catch {
    // saqlash mavjud emas
  }
  for (const lang of navigator.languages ?? [navigator.language]) {
    const code = lang.slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return DEFAULT_LOCALE;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`/${preferredLocale()}`} replace />} />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<Loading />}>
            <AdminApp />
          </Suspense>
        }
      />
      {LOCALES.map((l) => (
        <Route key={l} path={`/${l}`} element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="news" element={<ModuleGate keys={['news']}><NewsListPage type="NEWS" /></ModuleGate>} />
          <Route path="news/:slug" element={<ModuleGate keys={['news']}><NewsDetailPage /></ModuleGate>} />
          <Route path="announcements" element={<ModuleGate keys={['announcements']}><NewsListPage type="ANNOUNCEMENT" /></ModuleGate>} />
          <Route path="announcements/:slug" element={<ModuleGate keys={['announcements']}><NewsDetailPage /></ModuleGate>} />
          <Route path="events" element={<ModuleGate keys={['events']}><NewsListPage type="EVENT" /></ModuleGate>} />
          <Route path="events/:slug" element={<ModuleGate keys={['events']}><NewsDetailPage /></ModuleGate>} />
          <Route path="gallery" element={<ModuleGate keys={['photoGallery', 'videoGallery']}><GalleryPage /></ModuleGate>} />
          <Route path="alumni" element={<ModuleGate keys={['alumni']}><AlumniPage /></ModuleGate>} />
          <Route path="partners" element={<ModuleGate keys={['partners']}><PartnersPage /></ModuleGate>} />
          <Route path="useful-links" element={<ModuleGate keys={['usefulLinks']}><UsefulLinksPage /></ModuleGate>} />
          <Route path="contacts" element={<ModuleGate keys={['contacts']}><ContactsPage /></ModuleGate>} />
          <Route path="search" element={<ModuleGate keys={['search']}><SearchPage /></ModuleGate>} />
          <Route path=":slug" element={<CmsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      ))}
      <Route path="*" element={<NotFoundPage standalone />} />
    </Routes>
  );
}

export default function App() {
  const [client] = useState(createQueryClient);
  return (
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
