import { Lock, ToggleLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { MODULES, type ModuleKey, type Permission } from '@uchkoprik/shared';
import { useAdminModules, useCan } from '../auth';
import { PageTitle } from './common';

interface Props {
  permission?: Permission;
  modules?: ModuleKey[];
  children: ReactNode;
}

/** Interfeys himoyasi: ruxsat yo'q yoki modul o'chirilgan bo'lsa, tushunarli xabar. (Server API'ni baribir alohida yopadi.) */
export function Guard({ permission, modules, children }: Props) {
  const allowed = useCan(permission ?? 'content.read');
  const state = useAdminModules();
  const canManageModules = useCan('modules.manage');
  if (permission && !allowed) {
    return (
      <>
        <PageTitle title="Ruxsat yo‘q" />
        <div role="alert" className="max-w-xl rounded-lg border border-line bg-white p-6 shadow-card">
          <Lock className="mb-2 h-6 w-6 text-muted" aria-hidden />
          <p>Bu bo‘limga kirish uchun rolingizda ruxsat yo‘q. Kerak bo‘lsa, administratorga murojaat qiling.</p>
        </div>
      </>
    );
  }
  if (modules && !modules.some((k) => state[k])) {
    const names = modules.map((k) => MODULES.find((m) => m.key === k)?.label ?? k).join(' / ');
    return (
      <>
        <PageTitle title="Bo‘lim o‘chirilgan" />
        <div className="max-w-xl rounded-lg border border-line bg-white p-6 shadow-card">
          <ToggleLeft className="mb-2 h-6 w-6 text-muted" aria-hidden />
          <p>“{names}” moduli hozircha o‘chirilgan. Ma’lumotlar saqlanib turibdi.</p>
          {canManageModules && <p className="mt-3"><Link to="/admin/modules">Modullar sahifasida yoqish →</Link></p>}
        </div>
      </>
    );
  }
  return <>{children}</>;
}
