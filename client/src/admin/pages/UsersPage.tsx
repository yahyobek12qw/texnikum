import { Plus, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  PERMISSIONS, PERMISSION_LABELS, ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS, userCreateSchema, userUpdateSchema,
  type AdminUserRow, type Role,
} from '@uchkoprik/shared';
import { Badge, ErrorState, Loading } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, Input, Select } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { useToast } from '../../components/ui/Toast';
import { usersApi } from '../api';
import { useAuth } from '../auth';
import { Card, DataTable, PageTitle, fmtDate, type Column } from '../components/common';
import { applyIssues, serverIssues } from '../components/form-utils';
import { errorMessage } from '../components/row-actions';

interface FormValues { email: string; name: string; role: Role; isActive: boolean; password: string }

function UserModal({ user, isSelf, onClose }: { user: AdminUserRow | null; isSelf: boolean; onClose: () => void }) {
  const toast = useToast();
  const create = usersApi.useCreate();
  const update = usersApi.useUpdate();
  const form = useForm<FormValues>({ defaultValues: { email: user?.email ?? '', name: user?.name ?? '', role: user?.role ?? 'EDITOR', isActive: user?.isActive ?? true, password: '' } });
  const e = form.formState.errors;
  const role = form.watch('role');
  useEffect(() => form.reset({ email: user?.email ?? '', name: user?.name ?? '', role: user?.role ?? 'EDITOR', isActive: user?.isActive ?? true, password: '' }), [user, form]);

  const submit = async () => {
    const v = form.getValues();
    form.clearErrors();
    const body = user
      ? { name: v.name.trim(), ...(isSelf ? {} : { role: v.role, isActive: v.isActive }), ...(v.password ? { password: v.password } : {}) }
      : { email: v.email.trim(), name: v.name.trim(), role: v.role, password: v.password };
    const parsed = (user ? userUpdateSchema : userCreateSchema).safeParse(body);
    if (!parsed.success) {
      applyIssues(form, parsed.error.issues);
      return;
    }
    try {
      if (user) await update.mutateAsync({ id: user.id, body: body as never });
      else await create.mutateAsync(body as never);
      toast.success(user ? 'Foydalanuvchi saqlandi' : 'Foydalanuvchi yaratildi');
      onClose();
    } catch (err) {
      const issues = serverIssues(err);
      if (issues) applyIssues(form, issues);
      else if (/pochta/i.test(errorMessage(err))) form.setError('email', { message: errorMessage(err) });
      toast.error(errorMessage(err));
    }
  };

  return (
    <Modal open onClose={onClose} title={user ? 'Foydalanuvchini tahrirlash' : 'Yangi foydalanuvchi'}
      footer={<><Button variant="secondary" onClick={onClose}>Bekor qilish</Button><Button loading={create.isPending || update.isPending} onClick={() => void submit()}>Saqlash</Button></>}>
      <form onSubmit={(ev) => { ev.preventDefault(); void submit(); }} noValidate className="space-y-4">
        <Field label="Elektron pochta" required error={e.email?.message}><Input type="email" disabled={Boolean(user)} autoComplete="off" {...form.register('email')} /></Field>
        <Field label="Ism (ko‘rsatiladigan nom)" required error={e.name?.message}><Input {...form.register('name')} /></Field>
        <Field label="Rol" hint={ROLE_DESCRIPTIONS[role]} error={e.role?.message}>
          <Select disabled={isSelf} {...form.register('role')}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</Select>
        </Field>
        <Field label={user ? 'Yangi parol (o‘zgartirish uchun)' : 'Boshlang‘ich parol'} required={!user} error={e.password?.message} hint="Kamida 12 belgi, harf va raqam. Parolni foydalanuvchiga xavfsiz yo‘l bilan yetkazing; u “Hisob va parol” bo‘limida almashtira oladi.">
          <Input type="password" autoComplete="new-password" {...form.register('password')} />
        </Field>
        {user && !isSelf && <Checkbox label="Hisob faol (o‘chirilsa, kira olmaydi va sessiyalari yopiladi)" {...form.register('isActive')} />}
        {isSelf && <p className="text-sm text-muted">O‘zingizning rolingiz va faolligingizni o‘zgartirib bo‘lmaydi.</p>}
      </form>
    </Modal>
  );
}

export default function UsersPage() {
  const { session } = useAuth();
  const query = usersApi.useList<{ items: AdminUserRow[] }>({});
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [creating, setCreating] = useState(false);

  const columns: Column<AdminUserRow>[] = [
    { header: 'Foydalanuvchi', cell: (u) => <div><button type="button" className="text-left font-medium text-primary-600 hover:underline" onClick={() => setEditing(u)}>{u.name}</button><p className="text-xs text-muted">{u.email}</p></div> },
    { header: 'Rol', cell: (u) => <Badge tone={u.role === 'ADMIN' ? 'info' : 'neutral'}>{ROLE_LABELS[u.role]}</Badge> },
    { header: 'Holat', cell: (u) => (u.isActive ? <Badge tone="success">Faol</Badge> : <Badge tone="danger">Bloklangan</Badge>) },
    { header: 'Oxirgi kirish', cell: (u) => <span className="whitespace-nowrap text-muted">{fmtDate(u.lastLoginAt, true)}</span> },
    { header: 'Amallar', cell: (u) => <Button size="sm" variant="secondary" onClick={() => setEditing(u)}>Tahrirlash</Button> },
  ];

  return (
    <>
      <PageTitle title="Foydalanuvchilar va rollar" actions={<Button icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setCreating(true)}>Yangi foydalanuvchi</Button>} />
      {query.isPending ? <Loading /> : query.isError ? <ErrorState title="Foydalanuvchilarni yuklab bo‘lmadi" text={query.error.message} onRetry={() => void query.refetch()} /> : (
        <DataTable columns={columns} rows={query.data.items} rowKey={(u) => u.id} />
      )}

      <Card title="Rollar va ruxsatlar" className="mt-8">
        <p className="mb-4 flex items-start gap-2 text-sm text-muted"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden />Ruxsatlar serverda tekshiriladi: interfeysdagi tugmani yashirish emas, balki so‘rovning o‘zi rad etiladi.</p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <th scope="col" className="py-2 pr-3 font-semibold">Ruxsat</th>
                {ROLES.map((r) => <th key={r} scope="col" className="px-3 py-2 text-center font-semibold">{ROLE_LABELS[r].split(' (')[0]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {PERMISSIONS.map((p) => (
                <tr key={p}>
                  <th scope="row" className="py-2 pr-3 font-normal">{PERMISSION_LABELS[p]}</th>
                  {ROLES.map((r) => (
                    <td key={r} className="px-3 py-2 text-center">{(ROLE_PERMISSIONS[r] as readonly string[]).includes(p) ? <span aria-label="bor" className="font-semibold text-accent-600">✓</span> : <span aria-label="yo‘q" className="text-muted">—</span>}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {(creating || editing) && <UserModal key={editing?.id ?? 'new'} user={editing} isSelf={editing?.id === session?.user.id} onClose={() => { setCreating(false); setEditing(null); }} />}
    </>
  );
}
