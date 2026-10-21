import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// .env ni joriy papkadan, so'ng loyiha ildizidan (workspace ichidan ishga tushirilganda) o'qiydi.
// Mavjud environment o'zgaruvchilari ustidan yozilmaydi.
for (const file of ['.env', '../.env']) dotenv.config({ path: path.resolve(process.cwd(), file), quiet: true });

const bool = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .optional()
    .transform((v) => (v === undefined ? def : v === 'true' || v === '1'));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL ko‘rsatilmagan'),
  PUBLIC_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default(''),
  SESSION_TTL_HOURS: z.coerce.number().min(1).max(24 * 30).default(12),
  COOKIE_SECURE: bool(false),
  FORCE_HTTPS: bool(false),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  LOGIN_RATE_MAX: z.coerce.number().int().min(1).default(5),
  API_RATE_MAX: z.coerce.number().int().min(1).default(600),
  LOGIN_RATE_WINDOW_MINUTES: z.coerce.number().min(0.01).default(15),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().min(0.1).max(200).default(20),
  MAX_VIDEO_MB: z.coerce.number().min(1).max(4096).default(300),
  SCHEDULER_INTERVAL_SECONDS: z.coerce.number().min(1).default(60),
  ENABLE_API_DOCS: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  CLIENT_DIST_DIR: z.string().default('./client/dist'),
});

export interface Config {
  nodeEnv: 'development' | 'test' | 'production';
  isProduction: boolean;
  port: number;
  logLevel: string;
  publicUrl: string;
  corsOrigins: string[];
  sessionTtlMs: number;
  cookieSecure: boolean;
  forceHttps: boolean;
  trustProxy: number;
  loginRateMax: number;
  /** Bitta IP uchun daqiqasiga umumiy API so'rovlari limiti */
  apiRateMax: number;
  loginRateWindowMs: number;
  uploadDir: string;
  maxUploadBytes: number;
  maxVideoBytes: number;
  schedulerIntervalMs: number;
  enableApiDocs: boolean;
  clientDistDir: string;
}

/** Loyiha ildizi (workspaces bor package.json). Nisbiy yo'llar (UPLOAD_DIR, CLIENT_DIST_DIR) shunga nisbatan hal qilinadi, shuning uchun server qaysi papkadan ishga tushirilishi muhim emas. */
export function projectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) as { workspaces?: unknown };
      if (pkg.workspaces) return dir;
    } catch {
      // bu papkada package.json yo'q
    }
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Environment sozlamalari noto‘g‘ri:\n${msg}`);
  }
  const e = parsed.data;
  const isProduction = e.NODE_ENV === 'production';
  const publicUrl = e.PUBLIC_URL.replace(/\/+$/, '');

  if (isProduction) {
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(publicUrl);
    if (!publicUrl.startsWith('https://') && !isLocal) {
      throw new Error('Production rejimida PUBLIC_URL https:// bilan boshlanishi shart.');
    }
    if (!e.COOKIE_SECURE) {
      throw new Error('Production rejimida COOKIE_SECURE=true bo‘lishi shart (HTTPS talab qilinadi).');
    }
  }

  return {
    nodeEnv: e.NODE_ENV,
    isProduction,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    publicUrl,
    corsOrigins: e.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    sessionTtlMs: e.SESSION_TTL_HOURS * 3600 * 1000,
    cookieSecure: e.COOKIE_SECURE,
    forceHttps: e.FORCE_HTTPS,
    trustProxy: e.TRUST_PROXY,
    loginRateMax: e.LOGIN_RATE_MAX,
    apiRateMax: e.API_RATE_MAX,
    loginRateWindowMs: Math.round(e.LOGIN_RATE_WINDOW_MINUTES * 60 * 1000),
    uploadDir: path.resolve(projectRoot(), e.UPLOAD_DIR),
    maxUploadBytes: Math.round(e.MAX_UPLOAD_MB * 1024 * 1024),
    maxVideoBytes: Math.round(e.MAX_VIDEO_MB * 1024 * 1024),
    schedulerIntervalMs: Math.round(e.SCHEDULER_INTERVAL_SECONDS * 1000),
    enableApiDocs: e.ENABLE_API_DOCS ?? !isProduction,
    clientDistDir: path.resolve(projectRoot(), e.CLIENT_DIST_DIR),
  };
}
