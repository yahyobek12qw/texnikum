// Dastlabki administratorni xavfsiz yaratadi (yoki parolini tiklaydi).
// Parol kodda yoki .env'da saqlanmaydi: terminalda yashirin kiritiladi yoki bir martalik ADMIN_PASSWORD
// environment o'zgaruvchisi (CI/avtomatlashtirish uchun) orqali beriladi.
//
//   npm run admin:create                 -> savollar beradi
//   npm run admin:create -- --reset      -> mavjud administrator parolini almashtiradi
import 'dotenv/config';
import readline from 'node:readline';
import { PrismaClient } from '@prisma/client';
import { passwordSchema } from '@uchkoprik/shared';
import { hashPassword } from '../server/src/lib/password.ts';

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      const anyRl = rl as unknown as { _writeToOutput: (s: string) => void };
      anyRl._writeToOutput = (s: string) => {
        if (s.includes(question)) process.stdout.write(question);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer);
    });
  });
}

const prisma = new PrismaClient();
try {
  const reset = process.argv.includes('--reset');
  const email = (process.env.ADMIN_EMAIL ?? (await ask('Administrator elektron pochtasi: '))).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Elektron pochta noto‘g‘ri.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !reset) throw new Error('Bu pochta bilan foydalanuvchi mavjud. Parolni almashtirish uchun --reset bering.');

  const name = existing ? existing.name : (process.env.ADMIN_NAME ?? (await ask('Ism (ko‘rsatiladigan nom): '))).trim() || 'Administrator';
  const password = process.env.ADMIN_PASSWORD ?? (await ask('Parol (kamida 12 belgi, harf va raqam): ', true));
  const check = passwordSchema.safeParse(password);
  if (!check.success) throw new Error(check.error.issues[0]?.message ?? 'Parol talabga javob bermaydi.');
  if (!process.env.ADMIN_PASSWORD) {
    const again = await ask('Parolni takrorlang: ', true);
    if (again !== password) throw new Error('Parollar mos kelmadi.');
  }

  const passwordHash = await hashPassword(password);
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, isActive: true } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    console.log(`Administrator paroli yangilandi: ${email} (barcha sessiyalar bekor qilindi).`);
  } else {
    await prisma.user.create({ data: { email, name, passwordHash, role: 'ADMIN' } });
    console.log(`Administrator yaratildi: ${email}`);
  }
  await prisma.auditLog.create({
    data: { userEmail: null, action: existing ? 'RESET_ADMIN_PASSWORD' : 'BOOTSTRAP_ADMIN', entity: 'user', summary: `CLI: ${existing ? 'parol tiklandi' : 'administrator yaratildi'} (${email})` },
  });
} catch (err) {
  console.error(`Xatolik: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
