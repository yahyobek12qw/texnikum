import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicBanner } from '@uchkoprik/shared';
import { Hero } from './HomePage';

const banners: PublicBanner[] = ['Birinchi', 'Ikkinchi', 'Uchinchi'].map((title, i) => ({ id: `b${i}`, image: null, title, text: '', linkUrl: '' }));

function setup() {
  return render(
    <MemoryRouter initialEntries={['/uz']}>
      <Hero banners={banners} settings={undefined} />
    </MemoryRouter>,
  );
}
const tick = (ms: number) => act(() => { vi.advanceTimersByTime(ms); });

describe('Bosh sahifa banneri', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
  });
  afterEach(() => vi.useRealTimers());

  it('o‘zi almashib turadi va oxirgisidan keyin birinchisiga qaytadi', () => {
    setup();
    expect(screen.getByText('Birinchi')).toBeInTheDocument();
    tick(6000);
    expect(screen.getByText('Ikkinchi')).toBeInTheDocument();
    tick(6000);
    expect(screen.getByText('Uchinchi')).toBeInTheDocument();
    tick(6000);
    expect(screen.getByText('Birinchi')).toBeInTheDocument();
  });

  it('sichqoncha ustida va fokusda to‘xtaydi, ketganda davom etadi', () => {
    const { container } = setup();
    const section = container.querySelector('section')!;
    fireEvent.mouseEnter(section);
    tick(20000);
    expect(screen.getByText('Birinchi')).toBeInTheDocument();
    fireEvent.mouseLeave(section);
    tick(6000);
    expect(screen.getByText('Ikkinchi')).toBeInTheDocument();
  });

  it('pauza tugmasi almashishni to‘xtatadi va qayta yoqadi; qo‘lda o‘tish ishlaydi', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'Avtomatik almashishni to‘xtatish' }));
    tick(20000);
    expect(screen.getByText('Birinchi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Keyingi banner' }));
    expect(screen.getByText('Ikkinchi')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Avtomatik almashishni yoqish' }));
    tick(6000);
    expect(screen.getByText('Uchinchi')).toBeInTheDocument();
  });

  it('harakatni kamaytirish yoqilgan bo‘lsa, o‘zi almashmaydi', () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener: () => undefined, removeEventListener: () => undefined, addListener: () => undefined, removeListener: () => undefined, onchange: null, dispatchEvent: () => false })) as typeof window.matchMedia;
    setup();
    tick(20000);
    expect(screen.getByText('Birinchi')).toBeInTheDocument();
  });
});
