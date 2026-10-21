// Mahalliy ishlab chiqish uchun PostgreSQL ni ishga tushiradi (ma'lumotlar .pgdata papkasida saqlanadi).
// Ishlatish: npm run db:dev   (to'xtatish: Ctrl+C)
import { startEmbeddedDb } from './embedded-db.ts';

const port = Number(process.env.DEV_DB_PORT ?? 54320);
const { pg, url } = await startEmbeddedDb({
  dataDir: '.pgdata',
  port,
  database: 'uchkoprik',
});

console.log(`PostgreSQL ishga tushdi: ${url.replace(/:[^:@/]+@/, ':****@')}`);
console.log('To‘xtatish uchun Ctrl+C bosing.');

const shutdown = async () => {
  console.log('\nPostgreSQL to‘xtatilmoqda...');
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
setInterval(() => undefined, 1 << 30);
