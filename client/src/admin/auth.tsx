import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { defaultModules, type AdminSession, type ModuleKey, type ModulesState, type Permission } from '@uchkoprik/shared';
import { ApiError, setCsrfToken, setUnauthorizedHandler } from '../api/client';
import { authApi } from './api';

interface AuthState {
  status: 'loading' | 'authenticated' | 'anonymous';
  session: AdminSession | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        const s = await authApi.me();
        setCsrfToken(s.csrfToken);
        return s;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const clear = useCallback(() => {
    setCsrfToken(null);
    qc.setQueryData(['auth', 'me'], null);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' && q.queryKey[0] !== 'public' });
  }, [qc]);

  // Boshqa so'rovda sessiya tugasa, login sahifasiga yo'naltiramiz
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clear();
      navigate('/admin/login', { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [clear, navigate]);

  const login = useCallback(
    async (email: string, password: string) => {
      const s = await authApi.login(email, password);
      setCsrfToken(s.csrfToken);
      qc.setQueryData(['auth', 'me'], s);
    },
    [qc],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      clear();
    }
  }, [clear]);

  const value = useMemo<AuthState>(
    () => ({
      status: me.isPending ? 'loading' : me.data ? 'authenticated' : 'anonymous',
      session: me.data ?? null,
      login,
      logout,
    }),
    [me.isPending, me.data, login, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth faqat AuthProvider ichida ishlatiladi');
  return v;
}

/** Interfeys uchun ruxsat tekshiruvi (haqiqiy tekshiruv serverda bajariladi). */
export function useCan(permission: Permission): boolean {
  const { session } = useAuth();
  return Boolean(session?.permissions.includes(permission));
}

export function useAdminModules(): ModulesState {
  const { session } = useAuth();
  return session?.modules ?? defaultModules();
}

export function useModuleOn(...keys: ModuleKey[]): boolean {
  const modules = useAdminModules();
  return keys.some((k) => modules[k]);
}
