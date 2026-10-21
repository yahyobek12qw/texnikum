// Zaxira nusxa: npm run db:backup [-- <papka>]   (standart: backups/<sana-vaqt>)
import 'dotenv/config';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createBackup } from './backup-lib.ts';

const prisma = new PrismaClient();
try {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(process.argv[2] ?? path.join('backups', stamp));
  const uploads = path.resolve(process.env.UPLOAD_DIR ?? './uploads');
  const m = await createBackup(prisma, out, uploads);
  console.log(`Backup tayyor: ${out}`);
  console.log(`Jadvallar: ${Object.entries(m.tables).map(([t, n]) => `${t}=${n}`).join(', ')}; fayllar: ${m.uploadFiles}`);
  console.log('Eslatma: backup papkasida foydalanuvchi parol xeshlari bor — uni xavfsiz joyda saqlang.');
} catch (err) {
  console.error('Backup xatosi:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
