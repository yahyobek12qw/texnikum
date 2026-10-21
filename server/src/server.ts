import { createApp } from './app.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { purgeStaleUploads } from './modules/media/media.service.js';
import { startScheduler } from './modules/news/scheduler.js';

const { app, config } = createApp();

const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'server ishga tushdi');
});
// Katta video yuklash sekin mobil tarmoqda uzoq davom etishi mumkin (standart 5 daqiqa yetmaydi)
server.requestTimeout = 30 * 60 * 1000;
const stopScheduler = startScheduler(config.schedulerIntervalMs, () => purgeStaleUploads(config));

async function shutdown(signal: string) {
  logger.info({ signal }, 'server to‘xtatilmoqda');
  stopScheduler();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
