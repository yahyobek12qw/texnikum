import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { LanguageSwitcher } from './LanguageSwitcher';
import { RichContent, isEmptyHtml } from './RichContent';
import { Pagination } from './ui/Pagination';
import { AlternatesProvider, useRegisterAlternates } from '../i18n/locale';
import { dictionaries, translate, type DictKey } from '../i18n/dictionary';
import { formatAdminDate, formatPublicDate } from '../utils/date';

function Registrar({ items, prefix }: { items: { locale: 'uz' | 'ru' | 'en'; slug: string | null; available: boolean }[]; prefix?: string }) {
  useRegisterAlternates(items, prefix);
  return null;
}

function renderSwitcher(path: string, alternates?: Parameters<typeof Registrar>[0]) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AlternatesProvider>
        {alternates && <Registrar {...alternates} />}
        <Routes>
          <Route path="/:locale/*" element={<LanguageSwitcher />} />
        </Routes>
      </AlternatesProvider>
    </MemoryRouter>,
  );
}

describe('LanguageSwitcher', () => {
  it('tarjima slugi bo‘yicha mos sahifaga havola beradi', () => {
    renderSwitcher('/uz/news/birinchi', {
      prefix: 'news/',
      items: [
        { locale: 'uz', slug: 'birinchi', available: true },
        { locale: 'ru', slug: 'pervaya', available: true },
        { locale: 'en', slug: null, available: false },
      ],
    });
    expect(screen.getByRole('link', { name: /Русский/ })).toHaveAttribute('href', '/ru/news/pervaya');
    expect(screen.getByRole('link', { name: /O‘zbekcha/ })).toHaveAttribute('aria-current', 'true');
  });

  it('tarjima mavjud bo‘lmagan tilni belgilaydi, lekin mavjud bo‘lgan tarjimani "bor" deb ko‘rsatmaydi', () => {
    renderSwitcher('/uz/about', { items: [{ locale: 'uz', slug: 'about', available: true }, { locale: 'ru', slug: null, available: false }, { locale: 'en', slug: null, available: false }] });
    const en = screen.getByRole('link', { name: /English/ });
    expect(en).toHaveAccessibleName(/tarjima mavjud emas/);
    expect(en).toHaveAttribute('href', '/en/about'); // asl slug orqali; server fallback + ogohlantirish beradi
  });

  it('qat‘iy marshrutlarda yo‘l va qidiruv parametrlarini saqlaydi', () => {
    renderSwitcher('/uz/documents');
    expect(screen.getByRole('link', { name: /English/ })).toHaveAttribute('href', '/en/documents');
  });
});

describe('RichContent', () => {
  it('xavfli teg va atributlarni olib tashlaydi', () => {
    const { container } = render(<RichContent html={'<p onclick="x()">Salom</p><script>alert(1)</script><img src="a.png" onerror="alert(1)"><a href="javascript:alert(1)">h</a>'} />);
    expect(container.innerHTML).not.toMatch(/script|onclick|onerror|javascript:/i);
    expect(screen.getByText('Salom')).toBeInTheDocument();
  });
  it('bo‘sh HTML’ni aniqlaydi', () => {
    expect(isEmptyHtml('')).toBe(true);
    expect(isEmptyHtml('<p></p>')).toBe(true);
    expect(isEmptyHtml('<p>&nbsp;</p>')).toBe(true);
    expect(isEmptyHtml('<p>Matn</p>')).toBe(false);
    expect(isEmptyHtml('<p><img src="a.png"></p>')).toBe(false);
  });
});

describe('Pagination', () => {
  it('joriy sahifani belgilaydi va tanlangan sahifani qaytaradi', async () => {
    const onPage = vi.fn();
    render(<Pagination meta={{ page: 3, pageSize: 10, total: 100, totalPages: 10 }} onPage={onPage} />);
    const nav = screen.getByRole('navigation', { name: 'Sahifalash' });
    expect(within(nav).getByRole('button', { name: /^3-sahifa/ })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(within(nav).getByRole('button', { name: /^4-sahifa/ }));
    expect(onPage).toHaveBeenCalledWith(4);
  });
  it('bitta sahifa bo‘lsa chizilmaydi', () => {
    const { container } = render(<Pagination meta={{ page: 1, pageSize: 10, total: 5, totalPages: 1 }} onPage={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('i18n lug‘ati va sana', () => {
  it('uch tilda ham bir xil kalitlar mavjud va bo‘sh qiymat yo‘q', () => {
    const keys = Object.keys(dictionaries.uz) as DictKey[];
    for (const l of ['ru', 'en'] as const) {
      expect(Object.keys(dictionaries[l]).sort()).toEqual([...keys].sort());
      for (const k of keys) expect(dictionaries[l][k].trim(), `${l}.${k}`).not.toBe('');
    }
  });
  it('o‘zgaruvchilarni qo‘yadi', () => {
    expect(translate('ru', 'pageOf', { page: 2, total: 5 })).toBe('Страница 2, всего 5');
    expect(translate('en', 'translationNotice', { requested: 'English', actual: 'Русский' })).toContain('Русский');
  });
  it('sanani tilga mos formatlaydi (o‘zbekcha oy nomlari qo‘lda)', () => {
    const iso = new Date(2026, 9, 20, 17, 7).toISOString();
    expect(formatPublicDate(iso, 'uz')).toBe('20-oktabr 2026');
    expect(formatPublicDate(iso, 'ru')).toMatch(/20 октября 2026/);
    expect(formatPublicDate(iso, 'en')).toMatch(/20 October 2026/);
    expect(formatAdminDate(iso, true)).toBe('20.10.2026 17:07');
    expect(formatAdminDate(null)).toBe('—');
  });
});
