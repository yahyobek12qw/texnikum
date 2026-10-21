import type { ReactNode } from 'react';
import { defaultModules, type ModuleKey, type ModulesState } from '@uchkoprik/shared';
import { useSettings } from '../api/public';
import { Loading } from '../components/ui/Feedback';
import NotFoundPage from '../pages/NotFoundPage';
import { useLocale } from '../i18n/locale';

/** Yoqilgan modullar (sozlamalar yuklanguncha standart holat ishlatiladi). */
export function useModules(): { modules: ModulesState; ready: boolean } {
  const locale = useLocale();
  const q = useSettings(locale);
  return { modules: q.data?.modules ?? defaultModules(), ready: !q.isPending };
}

/** Modul o'chirilgan bo'lsa, sahifa o'rniga 404 ko'rsatadi (server ham API'ni 404 bilan yopadi). */
export function ModuleGate({ keys, children }: { keys: ModuleKey[]; children: ReactNode }) {
  const { modules, ready } = useModules();
  if (!ready) return <Loading />;
  if (!keys.some((k) => modules[k])) return <NotFoundPage />;
  return <>{children}</>;
}
