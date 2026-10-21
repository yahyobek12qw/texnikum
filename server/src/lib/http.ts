import type { Request } from 'express';
import type { z } from 'zod';
import type { PaginationMeta } from '@uchkoprik/shared';
import { badRequest, HttpError } from './errors.js';

export function parse<S extends z.ZodType>(schema: S, data: unknown): z.output<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      path: i.path.join('.'),
      message: i.message,
    }));
    throw new HttpError(400, 'VALIDATION_ERROR', 'Kiritilgan ma’lumotlar noto‘g‘ri', details);
  }
  return result.data;
}

export function param(req: Request, name: string): string {
  const v = req.params[name];
  if (typeof v !== 'string' || v.length === 0 || v.length > 200) throw badRequest(`"${name}" parametri noto‘g‘ri`);
  return v;
}

export function pageArgs(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function makeMeta(page: number, pageSize: number, total: number): PaginationMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function clientIp(req: Request): string | null {
  return req.ip ?? null;
}

/** HTML'dan teg va ortiqcha bo'sh joylarni olib tashlaydi (snippet va qidiruv uchun). */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function snippet(text: string, q: string, length = 180): string {
  const plain = text;
  if (!plain) return '';
  const idx = plain.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return plain.slice(0, length) + (plain.length > length ? '…' : '');
  const start = Math.max(0, idx - Math.floor(length / 3));
  const end = Math.min(plain.length, start + length);
  return (start > 0 ? '…' : '') + plain.slice(start, end) + (end < plain.length ? '…' : '');
}
