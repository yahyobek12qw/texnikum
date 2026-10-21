import { zodResolver } from '@hookform/resolvers/zod';
import { Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { loginSchema, type LoginInput } from '@uchkoprik/shared';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { Field, Input } from '../../components/ui/Form';
import { useAuth } from '../auth';

export default function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } });

  useEffect(() => {
    document.title = 'Kirish — Boshqaruv paneli';
  }, []);

  if (status === 'authenticated') return <Navigate to="/admin" replace />;

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    try {
      await login(values.email, values.password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from && from.startsWith('/admin') ? from : '/admin', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError('Juda ko‘p urinish bo‘ldi. Birozdan so‘ng qayta urinib ko‘ring.');
      else if (err instanceof ApiError && err.status === 401) setError('Elektron pochta yoki parol noto‘g‘ri.');
      else setError(err instanceof ApiError ? err.message : 'Kirishda xatolik yuz berdi.');
      form.setValue('password', '');
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-6 shadow-card sm:p-8">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary-700 text-white"><Shield className="h-7 w-7" aria-hidden /></span>
          <h1 className="text-2xl">Boshqaruv paneliga kirish</h1>
          <p className="mt-1 text-sm text-muted">Uchko‘prik 1-sonli texnikumi rasmiy portali</p>
        </div>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field label="Elektron pochta" error={form.formState.errors.email?.message} required>
            <Input type="email" autoComplete="username" autoFocus {...form.register('email')} />
          </Field>
          <Field label="Parol" error={form.formState.errors.password?.message} required>
            <Input type="password" autoComplete="current-password" {...form.register('password')} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={form.formState.isSubmitting}>Kirish</Button>
        </form>
      </div>
    </div>
  );
}
