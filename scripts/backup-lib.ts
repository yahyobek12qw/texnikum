// Mantiqiy backup/restore: barcha jadvallar JSON ko'rinishida + yuklangan fayllar nusxasi.
// pg_dump talab qilinmaydi (Windows/dev uchun qulay). Productionda qo'shimcha ravishda pg_dump tavsiya etiladi (docs/DEPLOYMENT.md).
import fs from 'node:fs';
import path from 'node:path';
import type { PrismaClient } from '@prisma/client';

/** Tashqi kalit tartibi: ota jadvallar oldin. `sessions` ataylab kiritilmagan (tiklashdan so'ng qayta kiriladi). */
export const TABLES = [
  'users', 'media', 'media_translations', 'categories', 'category_translations',
  'pages', 'page_translations', 'page_versions',
  'news', 'news_translations', 'documents', 'document_translations',
  'navigation_menus', 'navigation_items', 'navigation_item_translations',
  'education_programs', 'education_program_translations', 'staff', 'staff_translations',
  'gallery_videos', 'gallery_video_translations', 'alumni', 'alumni_translations', 'partners', 'partner_translations',
  'site_settings', 'audit_logs', 'page_views',
] as const;

const SELF_REFERENCING: Record<string, string> = { pages: 'parentId', navigation_items: 'parentId' };

export interface BackupManifest {
  version: 1;
  createdAt: string;
  tables: Record<string, number>;
  uploadFiles: number;
}

function copyDir(src: string, dest: string): number {
  if (!fs.existsSync(src)) return 0;
  let count = 0;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) count += copyDir(s, d);
    else {
      fs.copyFileSync(s, d);
      count += 1;
    }
  }
  return count;
}

export async function createBackup(prisma: PrismaClient, outDir: string, uploadDir: string): Promise<BackupManifest> {
  fs.mkdirSync(outDir, { recursive: true });
  const tables: Record<string, number> = {};
  // Izchil holat uchun bitta tranzaksiyada o'qiladi
  await prisma.$transaction(
    async (tx) => {
      for (const t of TABLES) {
        const rows = await tx.$queryRawUnsafe<{ data: unknown[] }[]>(`SELECT COALESCE(json_agg(t), '[]'::json) AS data FROM "${t}" t`);
        const data = rows[0]?.data ?? [];
        tables[t] = data.length;
        fs.writeFileSync(path.join(outDir, `${t}.json`), JSON.stringify(data));
      }
    },
    { isolationLevel: 'RepeatableRead', timeout: 120_000 },
  );
  const uploadFiles = copyDir(uploadDir, path.join(outDir, 'uploads'));
  const manifest: BackupManifest = { version: 1, createdAt: new Date().toISOString(), tables, uploadFiles };
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return manifest;
}

function orderParentsFirst(rows: Record<string, unknown>[], parentKey: string): Record<string, unknown>[] {
  const byId = new Map(rows.map((r) => [r.id as string, r]));
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const visit = (r: Record<string, unknown>) => {
    const id = r.id as string;
    if (seen.has(id)) return;
    seen.add(id);
    const parent = r[parentKey] as string | null;
    if (parent && byId.has(parent)) visit(byId.get(parent)!);
    out.push(r);
  };
  rows.forEach(visit);
  return out;
}

/** DIQQAT: mavjud ma'lumotlarni to'liq almashtiradi. */
export async function restoreBackup(prisma: PrismaClient, inDir: string, uploadDir: string): Promise<BackupManifest> {
  const manifest = JSON.parse(fs.readFileSync(path.join(inDir, 'manifest.json'), 'utf8')) as BackupManifest;
  if (manifest.version !== 1) throw new Error(`Qo'llab-quvvatlanmaydigan backup versiyasi: ${manifest.version}`);

  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`TRUNCATE ${['sessions', ...TABLES].map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
      for (const t of TABLES) {
        let rows = JSON.parse(fs.readFileSync(path.join(inDir, `${t}.json`), 'utf8')) as Record<string, unknown>[];
        if (rows.length === 0) continue;
        const parentKey = SELF_REFERENCING[t];
        if (parentKey) rows = orderParentsFirst(rows, parentKey);
        // Ota-ona oldin yoziladi (RESTRICT tashqi kalitlar uchun), shuning uchun tartib saqlangan holda bo'laklab kiritiladi
        const CHUNK = 200;
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          await tx.$executeRawUnsafe(`INSERT INTO "${t}" SELECT * FROM json_populate_recordset(null::"${t}", $1::json)`, JSON.stringify(chunk));
        }
      }
    },
    { timeout: 300_000 },
  );

  const src = path.join(inDir, 'uploads');
  if (fs.existsSync(src)) copyDir(src, uploadDir);
  return manifest;
}
