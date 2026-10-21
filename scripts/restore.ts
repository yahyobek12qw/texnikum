// Tiklash: npm run db:restore -- <backup-papka> --yes
// Mavjud ma'lumotlar to'liq almashtiriladi, shuning uchun --yes tasdig'i talab qilinadi.
import 'dotenv/config';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { restoreBackup } from './backup-lib.ts';

const dir = process.argv[2];
if (!dir || dir.startsWith('--') || !process.argv.includes('--yes')) {
  console.error('Ishlatish: npm run db:restore -- <backup-papka> --yes\nOGOHLANTIRISH: joriy ma’lumotlar bazasi to‘liq almashtiriladi.');
  process.exit(1);
}
const prisma = new PrismaClient();
try {
  const m = await restoreBackup(prisma, path.resolve(dir), path.resolve(process.env.UPLOAD_DIR ?? './uploads'));
  console.log(`Tiklandi (backup sanasi: ${m.createdAt}). Barcha sessiyalar bekor qilingan — qayta kiring.`);
} catch (err) {
  console.error('Tiklash xatosi:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
