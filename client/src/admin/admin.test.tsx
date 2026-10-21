import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast';
import { AuthProvider } from './auth';
import { applyIssues } from './components/form-utils';
import LoginPage from './pages/LoginPage';
import { useForm } from 'react-hook-form';

function mockFetch(handler: (url: string, init?: RequestInit) => { status: number; body?: unknown }) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const r = handler(url, init);
    return new Response(r.body === undefined ? null : JSON.stringify(r.body), { status: r.status, headers: { 'Content-Type': 'application/json' } });
  }));
}

function renderLogin() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={['/admin/login']}>
          <AuthProvider>
            <Routes>
              <Route path="/admin/login" element={<LoginPage />} />
              <Route path="/admin" element={<h1>Boshqaruv</h1>} />
            </Routes>
          </AuthProvider>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it('bo‘sh forma yuborilmaydi: validatsiya xatolari ko‘rsatiladi va serverga so‘rov ketmaydi', async () => {
    const calls: string[] = [];
    mockFetch((url) => { calls.push(url); return { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'x' } } }; });
    renderLogin();
    await userEvent.click(await screen.findByRole('button', { name: 'Kirish' }));
    expect(await screen.findByText('Elektron pochta noto‘g‘ri')).toBeInTheDocument();
    expect(await screen.findByText('Parolni kiriting')).toBeInTheDocument();
    expect(calls.filter((u) => u.includes('/auth/login'))).toHaveLength(0);
  });

  it('noto‘g‘ri parolda umumiy xabar ko‘rsatiladi (foydalanuvchi mavjudligi oshkor etilmaydi)', async () => {
    mockFetch((url) => {
      if (url.includes('/auth/me')) return { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'x' } } };
      return { status: 401, body: { error: { code: 'INVALID_CREDENTIALS', message: 'Elektron pochta yoki parol noto‘g‘ri' } } };
    });
    renderLogin();
    await userEvent.type(await screen.findByLabelText(/Elektron pochta/), 'a@b.uz');
    await userEvent.type(screen.getByLabelText(/Parol/), 'xxxxxxxxxxxx');
    await userEvent.click(screen.getByRole('button', { name: 'Kirish' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Elektron pochta yoki parol noto‘g‘ri.');
    expect(screen.getByLabelText(/Parol/)).toHaveValue(''); // parol tozalanadi, email saqlanadi
    expect(screen.getByLabelText(/Elektron pochta/)).toHaveValue('a@b.uz');
  });

  it('muvaffaqiyatli kirishdan so‘ng boshqaruv sahifasiga o‘tadi', async () => {
    mockFetch((url) => {
      if (url.includes('/auth/me')) return { status: 401, body: { error: { code: 'UNAUTHORIZED', message: 'x' } } };
      return { status: 200, body: { user: { id: '1', email: 'a@b.uz', name: 'A', role: 'ADMIN' }, csrfToken: 'tok' } };
    });
    renderLogin();
    await userEvent.type(await screen.findByLabelText(/Elektron pochta/), 'a@b.uz');
    await userEvent.type(screen.getByLabelText(/Parol/), 'parol-12345678');
    await userEvent.click(screen.getByRole('button', { name: 'Kirish' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Boshqaruv' })).toBeInTheDocument());
  });
});

describe('applyIssues', () => {
  it('server xatoliklarini maydonlarga bog‘laydi va xato bo‘lgan tillarni qaytaradi', () => {
    let result: Set<string> = new Set();
    function Harness() {
      const form = useForm({ defaultValues: { translations: { uz: { title: '' }, ru: { title: '' } } } });
      return (
        <button type="button" onClick={() => { result = applyIssues(form, [{ path: 'translations.ru.title', message: 'Sarlavhani kiriting' }]); }}>
          go {form.formState.errors.translations?.ru?.title?.message}
        </button>
      );
    }
    render(<Harness />);
    return userEvent.click(screen.getByRole('button')).then(() => {
      expect([...result]).toEqual(['ru']);
    });
  });
});
