import fs from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Router, type Express, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { loadConfig, type Config } from './config/env.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { contentGuard, originGuard, requireSession, requirePermission } from './middleware/auth.js';
import { requireModule } from './lib/modules.js';
import { adminAlumniRouter } from './modules/alumni/alumni.routes.js';
import { adminPartnersRouter } from './modules/partners/partners.routes.js';
import { adminStatsRouter } from './modules/stats/stats.js';
import { adminUsersRouter } from './modules/users/users.routes.js';
import { adminVideosRouter } from './modules/videos/videos.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { adminAuditRouter } from './modules/audit/audit.routes.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { adminCategoriesRouter } from './modules/categories/categories.routes.js';
import { adminDashboardRouter, adminTranslationsRouter } from './modules/dashboard/dashboard.routes.js';
import { adminDocumentsRouter } from './modules/documents/documents.routes.js';
import { adminMediaRouter } from './modules/media/media.routes.js';
import { ensureUploadDirs, mediaDirs } from './modules/media/media.service.js';
import { videoFileHandler } from './modules/media/video-serve.js';
import { adminNavigationRouter } from './modules/navigation/navigation.routes.js';
import { adminNewsRouter } from './modules/news/news.routes.js';
import { adminPagesRouter } from './modules/pages/pages.routes.js';
import { adminProgramsRouter } from './modules/programs/programs.routes.js';
import { publicRouter } from './modules/public/public.routes.js';
import { robotsHandler, sitemapHandler, spaHandler } from './modules/seo/seo.js';
import { adminSettingsRouter } from './modules/settings/settings.routes.js';
import { adminStaffRouter } from './modules/staff/staff.routes.js';
import { mountApiDocs } from './openapi/docs.js';
import './types.js';

const httpsRedirect: RequestHandler = (req, res, next) => {
  if (req.secure || req.path === '/healthz') return next();
  res.redirect(308, `https://${req.get('host')}${req.originalUrl}`);
};

export function createApp(overrides: Partial<Config> = {}): { app: Express; config: Config } {
  const config: Config = { ...loadConfig(), ...overrides };
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  if (config.forceHttps) app.use(httpsRedirect);

  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/healthz' },
      customLogLevel: (_req, res, err) => (err || res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info'),
      serializers: {
        req: (req: { method: string; url: string; id: unknown }) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  if (config.enableApiDocs) mountApiDocs(app);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          // Videogalereya: faqat YouTube/Vimeo pleyerlari (shared/src/video.ts: videoEmbedUrl) iframe'ga joylanadi
          frameSrc: ['https://www.youtube-nocookie.com', 'https://player.vimeo.com'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          upgradeInsecureRequests: config.isProduction ? [] : null,
        },
      },
      strictTransportSecurity: config.isProduction ? { maxAge: 31536000, includeSubDomains: true } : false,
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(compression());

  if (config.corsOrigins.length > 0) {
    app.use(
      cors({
        origin: config.corsOrigins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
      }),
    );
  }
  app.use(cookieParser());
  app.use(express.json({ limit: '4mb' }));

  app.get('/healthz', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });

  // Yuklangan rasmlar (hujjatlar bu yerda xizmat qilinmaydi — ular faqat nashr tekshiruvidan so'ng yuklab olinadi)
  const dirs = mediaDirs(config);
  fs.mkdirSync(dirs.images, { recursive: true });
  fs.mkdirSync(dirs.thumbs, { recursive: true });
  const staticOpts = { index: false, dotfiles: 'deny', fallthrough: false, maxAge: '30d', immutable: true } as const;
  app.use('/uploads/images', express.static(dirs.images, staticOpts));
  app.use('/uploads/thumbs', express.static(dirs.thumbs, staticOpts));
  // Video fayllar: faqat nashr qilingan videoga biriktirilgan bo'lsa ommaviy; qoralama faqat kirgan xodimga. Range (oldinga o'tkazish) qo'llab-quvvatlanadi.
  app.get('/uploads/videos/:name', videoFileHandler(config));
  void ensureUploadDirs(config);

  app.get('/robots.txt', robotsHandler(config));
  app.get('/sitemap.xml', sitemapHandler(config));

  // ───────────── API ─────────────
  const api = Router();
  api.use(
    rateLimit({
      windowMs: 60_000,
      limit: config.apiRateMax,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (_req, res) => {
        res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'So‘rovlar juda ko‘p. Birozdan so‘ng qayta urinib ko‘ring.' } });
      },
    }),
  );
  api.use('/public', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache');
    next();
  });
  api.use('/public', publicRouter(config));

  const admin = Router();
  admin.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  admin.use(originGuard(config));
  admin.use('/auth', authRouter(config));
  admin.use(requireSession(config));
  // Har bir marshrut guruhi uchun ruxsat SERVERDA tekshiriladi (rol → ruxsatlar: shared/src/permissions.ts)
  admin.use('/dashboard', requirePermission('content.read'), adminDashboardRouter());
  admin.use('/translations', requirePermission('content.read'), requireModule('translations'), adminTranslationsRouter());
  admin.use('/pages', contentGuard, adminPagesRouter());
  admin.use('/news', contentGuard, adminNewsRouter());
  admin.use('/documents', contentGuard, requireModule('documents', 'admission'), adminDocumentsRouter());
  admin.use('/categories', contentGuard, adminCategoriesRouter());
  admin.use('/education-programs', contentGuard, requireModule('programs'), adminProgramsRouter());
  admin.use('/staff', contentGuard, requireModule('staff', 'teachers'), adminStaffRouter());
  admin.use('/videos', contentGuard, requireModule('videoGallery'), adminVideosRouter(config));
  admin.use('/alumni', contentGuard, requireModule('alumni'), adminAlumniRouter());
  admin.use('/partners', contentGuard, requireModule('partners'), adminPartnersRouter());
  admin.use('/media', adminMediaRouter(config)); // ruxsatlar marshrut ichida: media.write / media.delete
  admin.use('/navigation', requirePermission('navigation.manage'), adminNavigationRouter());
  admin.use('/settings', adminSettingsRouter()); // GET: settings.manage yoki modules.manage; PATCH: guruhga qarab
  admin.use('/users', requirePermission('users.manage'), requireModule('users'), adminUsersRouter());
  admin.use('/audit-logs', requirePermission('audit.view'), adminAuditRouter());
  admin.use('/', requireModule('statistics'), adminStatsRouter()); // /stats, /reports/*
  api.use('/admin', admin);

  app.use('/api/v1', api);
  app.use('/api', notFoundHandler);

  // ───────────── Frontend (production) ─────────────
  if (fs.existsSync(path.join(config.clientDistDir, 'index.html'))) {
    app.use(
      '/assets',
      express.static(path.join(config.clientDistDir, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }),
    );
    app.use(express.static(config.clientDistDir, { index: false, maxAge: '1h' }));
    app.get(/.*/, spaHandler(config));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, config };
}
