// Funksiya modullarini buyruq qatoridan boshqarish (admin paneldagi "Modullar" sahifasiga alternativ).
//   npm run modules                      — holatni ko'rsatadi
//   npm run modules -- enable search     — modulni yoqadi
//   npm run modules -- disable search    — o'chiradi
//   npm run modules -- all-on | defaults — hammasini yoqadi / standart holatga qaytaradi
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { MODULES, MODULE_KEYS, resolveModules, type ModuleKey } from '@uchkoprik/shared';

const prisma = new PrismaClient();
try {
  const [cmd, key] = process.argv.slice(2);
  const row = await prisma.siteSetting.findUnique({ where: { key: 'modules' } });
  const stored = (row?.value ?? {}) as Record<string, boolean>;
  let next = { ...stored };

  if (cmd === 'enable' || cmd === 'disable') {
    if (!key || !(MODULE_KEYS as readonly string[]).includes(key)) throw new Error(`Modul kaliti noto‘g‘ri. Mavjud: ${MODULE_KEYS.join(', ')}`);
    next[key as ModuleKey] = cmd === 'enable';
  } else if (cmd === 'all-on') {
    next = Object.fromEntries(MODULE_KEYS.map((k) => [k, true]));
  } else if (cmd === 'defaults') {
    next = {};
  } else if (cmd) {
    throw new Error('Buyruq: enable <modul> | disable <modul> | all-on | defaults');
  }

  if (cmd) {
    await prisma.siteSetting.upsert({ where: { key: 'modules' }, create: { key: 'modules', value: next }, update: { value: next } });
  }
  const state = resolveModules(next);
  for (const m of MODULES) console.log(`${state[m.key] ? '✔ yoqilgan ' : '✘ o‘chirilgan'}  ${m.key.padEnd(14)} ${m.label}`);
  if (cmd) console.log('\nSaqlandi. Server o‘zgarishni bir necha soniyada oladi.');
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
