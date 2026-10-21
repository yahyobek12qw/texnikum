import type { RequestHandler } from 'express';
import { resolveModules, type ModuleKey, type ModulesState, type NewsType } from '@uchkoprik/shared';
import { HttpError } from './errors.js';
import { prisma } from './prisma.js';

const TTL_MS = 3000;
let cache: { at: number; value: ModulesState } | null = null;

/** Yoqilgan/o'chirilgan modullar (qisqa muddatli xotira keshi; sozlama o'zgarganda tozalanadi). */
export async function getModules(): Promise<ModulesState> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const row = await prisma.siteSetting.findUnique({ where: { key: 'modules' } });
  const value = resolveModules((row?.value ?? null) as Partial<Record<string, boolean>> | null);
  cache = { at: Date.now(), value };
  return value;
}

export function invalidateModules() {
  cache = null;
}

/** Modul o'chirilgan bo'lsa 404 MODULE_DISABLED qaytaradi. Bir nechta kalit berilsa, kamida bittasi yoqilgan bo'lishi kerak. */
export function requireModule(...keys: ModuleKey[]): RequestHandler {
  return async (_req, _res, next) => {
    const modules = await getModules();
    if (!keys.some((k) => modules[k])) {
      throw new HttpError(404, 'MODULE_DISABLED', 'Bu bo‘lim hozircha o‘chirilgan');
    }
    next();
  };
}

export const NEWS_TYPE_MODULE: Record<NewsType, ModuleKey> = { NEWS: 'news', ANNOUNCEMENT: 'announcements', EVENT: 'events' };

export function enabledNewsTypes(modules: ModulesState): NewsType[] {
  return (Object.keys(NEWS_TYPE_MODULE) as NewsType[]).filter((t) => modules[NEWS_TYPE_MODULE[t]]);
}

/** Hujjat turi ko'rinishi uchun talab qilinadigan modul. */
export function documentTypeAllowed(type: string, modules: ModulesState): boolean {
  if (!modules.documents) return false;
  if (type === 'ADMISSION') return modules.admission;
  if (type === 'OPEN_DATA' || type === 'ANTICORRUPTION') return modules.transparency;
  return true;
}

export function enabledDocumentTypes(modules: ModulesState): string[] {
  return ['REGULATION', 'CHARTER', 'PLAN', 'REPORT', 'OPEN_DATA', 'ANTICORRUPTION', 'ADMISSION', 'OTHER'].filter((t) => documentTypeAllowed(t, modules));
}

export function staffKindAllowed(kind: string, modules: ModulesState): boolean {
  return kind === 'TEACHER' ? modules.teachers : modules.staff;
}

export function pageModuleEnabled(module: string | null, modules: ModulesState): boolean {
  if (!module) return true;
  return modules[module as ModuleKey] ?? true;
}
