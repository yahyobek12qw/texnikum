import {
  Award, BarChart3, Calendar, FileText, FolderTree, GraduationCap, Handshake, Home, Images, KeyRound, Languages, LayoutDashboard, Library,
  LogOut, Megaphone, Menu, Newspaper, ScrollText, Settings, Shield, ToggleRight, UserCog, Users, Video, X, ExternalLink,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { Loading } from '../../components/ui/Feedback';
import { cn } from '../../components/ui/cn';
import { useToast } from '../../components/ui/Toast';
import { useAdminModules, useAuth } from '../auth';
import { ROLE_LABELS, type ModuleKey, type Permission } from '@uchkoprik/shared';

interface NavEntry {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
  permission?: Permission;
  /** Kamida bittasi yoqilgan bo'lsa ko'rinadi */
  modules?: ModuleKey[];
}

const GROUPS: { title: string; items: NavEntry[] }[] = [
  {
    title: 'Boshqaruv',
    items: [{ to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, end: true, permission: 'content.read' }],
  },
  {
    title: 'Kontent',
    items: [
      { to: '/admin/pages', label: 'Sahifalar', icon: <FileText className="h-5 w-5" />, permission: 'content.read' },
      { to: '/admin/news', label: 'Yangiliklar', icon: <Newspaper className="h-5 w-5" />, permission: 'content.read', modules: ['news'] },
      { to: '/admin/announcements', label: 'E’lonlar', icon: <Megaphone className="h-5 w-5" />, permission: 'content.read', modules: ['announcements'] },
      { to: '/admin/events', label: 'Tadbirlar', icon: <Calendar className="h-5 w-5" />, permission: 'content.read', modules: ['events'] },
      { to: '/admin/documents', label: 'Hujjatlar (qabul hujjatlari ham)', icon: <Library className="h-5 w-5" />, permission: 'content.read', modules: ['documents', 'admission'] },
      { to: '/admin/media', label: 'Media va fotogalereya', icon: <Images className="h-5 w-5" />, permission: 'content.read' },
      { to: '/admin/videos', label: 'Videogalereya', icon: <Video className="h-5 w-5" />, permission: 'content.read', modules: ['videoGallery'] },
      { to: '/admin/programs', label: 'Ta’lim yo‘nalishlari', icon: <GraduationCap className="h-5 w-5" />, permission: 'content.read', modules: ['programs'] },
      { to: '/admin/staff', label: 'Rahbariyat va xodimlar', icon: <Users className="h-5 w-5" />, permission: 'content.read', modules: ['staff', 'teachers'] },
      { to: '/admin/alumni', label: 'Bitiruvchilar', icon: <Award className="h-5 w-5" />, permission: 'content.read', modules: ['alumni'] },
      { to: '/admin/partners', label: 'Hamkor korxonalar', icon: <Handshake className="h-5 w-5" />, permission: 'content.read', modules: ['partners'] },
      { to: '/admin/categories', label: 'Kategoriyalar', icon: <FolderTree className="h-5 w-5" />, permission: 'content.read' },
    ],
  },
  {
    title: 'Sayt',
    items: [
      { to: '/admin/navigation', label: 'Menyu boshqaruvi', icon: <Menu className="h-5 w-5" />, permission: 'navigation.manage' },
      { to: '/admin/home', label: 'Bosh sahifa sozlamalari', icon: <Home className="h-5 w-5" />, permission: 'settings.manage' },
      { to: '/admin/settings', label: 'Sayt sozlamalari', icon: <Settings className="h-5 w-5" />, permission: 'settings.manage' },
      { to: '/admin/translations', label: 'Uch tilli tarjimalar', icon: <Languages className="h-5 w-5" />, permission: 'content.read', modules: ['translations'] },
    ],
  },
  {
    title: 'Tahlil',
    items: [{ to: '/admin/stats', label: 'Statistika va hisobotlar', icon: <BarChart3 className="h-5 w-5" />, permission: 'stats.view', modules: ['statistics'] }],
  },
  {
    title: 'Tizim',
    items: [
      { to: '/admin/users', label: 'Foydalanuvchilar va rollar', icon: <UserCog className="h-5 w-5" />, permission: 'users.manage', modules: ['users'] },
      { to: '/admin/modules', label: 'Modullar (yoqish/o‘chirish)', icon: <ToggleRight className="h-5 w-5" />, permission: 'modules.manage' },
      { to: '/admin/audit', label: 'Audit jurnali', icon: <ScrollText className="h-5 w-5" />, permission: 'audit.view' },
      { to: '/admin/account', label: 'Hisob va parol', icon: <KeyRound className="h-5 w-5" /> },
    ],
  },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { session } = useAuth();
  const modules = useAdminModules();
  const visible = (e: NavEntry) =>
    (!e.permission || Boolean(session?.permissions.includes(e.permission))) && (!e.modules || e.modules.some((k) => modules[k]));
  return (
    <nav aria-label="Admin menyusi" className="space-y-5 px-3 py-4">
      {GROUPS.map((g) => ({ ...g, items: g.items.filter(visible) })).filter((g) => g.items.length > 0).map((g) => (
        <div key={g.title}>
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-primary-200">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-10 items-center gap-3 rounded-md px-3 text-[0.95rem] no-underline',
                      isActive ? 'bg-white/15 font-semibold text-white' : 'text-primary-100 hover:bg-white/10 hover:text-white',
                    )
                  }
                >
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const { status, session, logout } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);

  if (status === 'loading') return <Loading className="min-h-screen" />;
  if (status === 'anonymous') return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;

  const onLogout = async () => {
    try {
      await logout();
      toast.info('Tizimdan chiqdingiz');
    } catch {
      toast.error('Chiqishda xatolik yuz berdi');
    }
  };

  return (
    <div className="min-h-screen bg-surface lg:grid lg:grid-cols-[17rem_1fr]">
      <a href="#admin-main" className="skip-link">Asosiy mazmunga o‘tish</a>
      <aside className="hidden bg-primary-800 lg:block">
        <div className="sticky top-0 flex h-screen flex-col overflow-y-auto">
          <Link to="/admin" className="flex items-center gap-2 border-b border-white/10 px-5 py-4 text-white no-underline">
            <Shield className="h-6 w-6" aria-hidden />
            <span className="font-semibold leading-tight">Boshqaruv paneli<span className="block text-xs font-normal text-primary-200">Uchko‘prik 1-sonli texnikumi</span></span>
          </Link>
          <Sidebar />
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menyusi">
          <button type="button" aria-label="Menyuni yopish" className="absolute inset-0 bg-primary-900/50" onClick={() => setOpen(false)} />
          <div className="relative h-full w-72 max-w-[85vw] overflow-y-auto bg-primary-800">
            <button type="button" aria-label="Yopish" onClick={() => setOpen(false)} className="absolute right-2 top-2 rounded p-2 text-white hover:bg-white/10"><X className="h-5 w-5" /></button>
            <div className="px-5 pb-1 pt-5 font-semibold text-white">Boshqaruv paneli</div>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white px-4 py-2.5 sm:px-6">
          <button type="button" onClick={() => setOpen(true)} aria-label="Menyuni ochish" className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-line lg:hidden">
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <a href="/" target="_blank" rel="noopener noreferrer" className="hidden items-center gap-1.5 text-sm sm:inline-flex">
              <ExternalLink className="h-4 w-4" aria-hidden /> Saytni ochish<span className="sr-only"> (yangi oynada)</span>
            </a>
            <span className="hidden text-sm text-muted md:inline" title={session?.user.email}>{session?.user.name} · {session ? ROLE_LABELS[session.user.role].split(' (')[0] : ''}</span>
            <button type="button" onClick={() => void onLogout()} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-line px-3 text-sm font-medium hover:bg-surface">
              <LogOut className="h-4 w-4" aria-hidden /> Chiqish
            </button>
          </div>
        </header>
        <main id="admin-main" tabIndex={-1} className="px-4 py-6 outline-none sm:px-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

