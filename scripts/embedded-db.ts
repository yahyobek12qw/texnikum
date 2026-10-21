// Dev va test uchun embedded-postgres (real PostgreSQL binarilari) yordamchisi.
// Productionda ishlatilmaydi: productionda oddiy PostgreSQL serveri kerak.
import EmbeddedPostgres from 'embedded-postgres';
import fs from 'node:fs';
import path from 'node:path';

export interface EmbeddedDbOptions {
  dataDir: string;
  port: number;
  user?: string;
  password?: string;
  database: string;
  persistent?: boolean;
}

export async function startEmbeddedDb(opts: EmbeddedDbOptions) {
  const user = opts.user ?? 'postgres';
  const password = opts.password ?? 'postgres';
  const dataDir = path.resolve(opts.dataDir);
  const initialised = fs.existsSync(path.join(dataDir, 'PG_VERSION'));

  const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user,
    password,
    port: opts.port,
    persistent: opts.persistent ?? true,
    // UTF-8 shart (kirill harflari). builtin C.UTF-8 Unicode'ga mos katta/kichik harf solishtirishni (ILIKE) beradi.
    initdbFlags: ['--encoding=UTF8', '--locale-provider=builtin', '--builtin-locale=C.UTF-8', '--locale=C'],
    onLog: () => undefined,
    onError: (e) => {
      if (process.env.PG_DEBUG) console.error(e);
    },
  });

  if (!initialised) await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase(opts.database);
  } catch {
    // baza allaqachon mavjud
  }
  const url = `postgresql://${user}:${password}@localhost:${opts.port}/${opts.database}?schema=public`;
  return { pg, url };
}
