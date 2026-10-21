import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { HttpError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Yo‘nalish topilmadi: ${req.method} ${req.path}` } });
};

function send(res: Parameters<ErrorRequestHandler>[2], status: number, code: string, message: string, details?: unknown) {
  res.status(status).json({ error: { code, message, ...(details !== undefined ? { details } : {}) } });
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) return send(res, err.status, err.code, err.message, err.details);

  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return send(res, 400, 'VALIDATION_ERROR', 'Kiritilgan ma’lumotlar noto‘g‘ri', details);
  }

  if (err instanceof MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return send(res, 413, 'PAYLOAD_TOO_LARGE', 'Fayl hajmi ruxsat etilgan chegaradan katta');
    return send(res, 400, 'UPLOAD_ERROR', 'Fayl yuklashda xatolik');
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = JSON.stringify(err.meta?.target ?? '');
      const isSlug = target.includes('slug');
      return send(
        res,
        409,
        isSlug ? 'SLUG_TAKEN' : 'CONFLICT',
        isSlug ? 'Bu slug shu tilda allaqachon band' : 'Bunday yozuv allaqachon mavjud',
      );
    }
    if (err.code === 'P2025') return send(res, 404, 'NOT_FOUND', 'Yozuv topilmadi');
    if (err.code === 'P2003') return send(res, 409, 'IN_USE', 'Yozuv boshqa ma’lumotlar bilan bog‘langan');
  }

  const e = err as { type?: string; status?: number };
  if (e.type === 'entity.parse.failed') return send(res, 400, 'INVALID_JSON', 'JSON formati noto‘g‘ri');
  if (e.type === 'entity.too.large') return send(res, 413, 'PAYLOAD_TOO_LARGE', 'So‘rov hajmi katta');
  // express.static kabi http-errors bergan 4xx xatolar (masalan, fayl topilmadi)
  if (typeof e.status === 'number' && e.status >= 400 && e.status < 500) {
    return send(res, e.status, e.status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST', e.status === 404 ? 'Topilmadi' : 'So‘rov noto‘g‘ri');
  }

  logger.error({ err, path: req.path, method: req.method }, 'kutilmagan xatolik');
  return send(res, 500, 'INTERNAL_ERROR', 'Serverda xatolik yuz berdi. Keyinroq qayta urinib ko‘ring.');
};
