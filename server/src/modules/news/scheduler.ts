import { auditSystem } from '../../lib/audit.js';
import { logger } from '../../lib/logger.js';
import { prisma } from '../../lib/prisma.js';
import { purgeExpiredSessions } from '../auth/session.js';

/**
 * Rejalashtirilgan nashr: scheduledAt vaqti kelgan qoralamalarni nashr qiladi.
 * Har bir yozuv `status = DRAFT` sharti bilan yangilanadi, shuning uchun bir nechta
 * server nusxasi bir vaqtda ishlasa ham material ikki marta nashr qilinmaydi.
 */
export async function publishDueNews(now = new Date()): Promise<number> {
  const due = await prisma.news.findMany({
    where: { status: 'DRAFT', scheduledAt: { lte: now } },
    include: { translations: { select: { locale: true, title: true } } },
  });
  let published = 0;
  for (const item of due) {
    const res = await prisma.news.updateMany({
      where: { id: item.id, status: 'DRAFT', scheduledAt: { not: null, lte: now } },
      data: { status: 'PUBLISHED', publishedAt: item.scheduledAt ?? now, scheduledAt: null },
    });
    if (res.count === 1) {
      published += 1;
      const title = item.translations.find((t) => t.locale === 'uz')?.title ?? item.id;
      await auditSystem({
        action: 'SCHEDULED_PUBLISH',
        entity: 'news',
        entityId: item.id,
        summary: `Rejalashtirilgan nashr bajarildi: ${title}`,
      });
    }
  }
  return published;
}

export function startScheduler(intervalMs: number, extra?: () => Promise<void>): () => void {
  const tick = async () => {
    try {
      await extra?.();
      const n = await publishDueNews();
      if (n > 0) logger.info({ count: n }, 'rejalashtirilgan materiallar nashr qilindi');
      await purgeExpiredSessions();
    } catch (err) {
      logger.error({ err }, 'scheduler xatosi');
    }
  };
  void tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
