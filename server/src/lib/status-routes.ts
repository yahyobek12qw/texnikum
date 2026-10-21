import type { Request, Router } from 'express';
import type { ContentStatus, Locale } from '@uchkoprik/shared';
import { audit } from './audit.js';
import { badRequest } from './errors.js';
import { param } from './http.js';

interface StatusRouteOptions<Row extends { status: ContentStatus; publishedAt?: Date | null; translations: { locale: Locale }[] }> {
  entity: string;
  /** Audit yozuvi uchun nom, masalan "Yo'nalish" */
  label: string;
  load: (id: string) => Promise<Row>;
  save: (id: string, data: { status: ContentStatus; publishedAt?: Date }) => Promise<unknown>;
  serialize: (id: string) => Promise<unknown>;
  title: (row: Row) => string;
}

/** `POST /:id/publish|unpublish|archive` marshrutlarini qo'shadi (nashr holati o'zgarishi). */
export function addStatusRoutes<Row extends { status: ContentStatus; publishedAt?: Date | null; translations: { locale: Locale }[] }>(
  router: Router,
  opts: StatusRouteOptions<Row>,
) {
  const handle =
    (status: ContentStatus, action: string, verb: string) =>
    async (req: Request, res: import('express').Response) => {
      const id = param(req, 'id');
      const row = await opts.load(id);
      if (status === 'PUBLISHED' && !row.translations.some((t) => t.locale === 'uz')) {
        throw badRequest('Nashr qilish uchun o‘zbekcha versiya mavjud bo‘lishi kerak', 'MISSING_DEFAULT_TRANSLATION');
      }
      await opts.save(id, {
        status,
        ...(status === 'PUBLISHED' && !row.publishedAt ? { publishedAt: new Date() } : {}),
      });
      await audit(req, { action, entity: opts.entity, entityId: id, summary: `${opts.label} ${verb}: ${opts.title(row)}` });
      res.json(await opts.serialize(id));
    };

  router.post('/:id/publish', handle('PUBLISHED', 'PUBLISH', 'nashr qilindi'));
  router.post('/:id/unpublish', handle('DRAFT', 'UNPUBLISH', 'nashrdan qaytarildi'));
  router.post('/:id/archive', handle('ARCHIVED', 'ARCHIVE', 'arxivlandi'));
}
