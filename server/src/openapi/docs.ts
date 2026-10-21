import type { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { z } from 'zod';
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  changePasswordSchema,
  documentCreateSchema,
  documentUpdateSchema,
  loginSchema,
  mediaUpdateSchema,
  navigationUpdateSchema,
  newsCreateSchema,
  newsUpdateSchema,
  pageCreateSchema,
  pageUpdateSchema,
  programCreateSchema,
  programUpdateSchema,
  restoreVersionSchema,
  settingsPatchSchema,
  staffCreateSchema,
  staffUpdateSchema,
  videoCreateSchema,
  videoUpdateSchema,
  alumnusCreateSchema,
  alumnusUpdateSchema,
  partnerCreateSchema,
  partnerUpdateSchema,
  userCreateSchema,
  userUpdateSchema,
} from '@uchkoprik/shared';

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
interface Operation {
  summary: string;
  tags: string[];
  security?: unknown[];
  parameters?: unknown[];
  requestBody?: unknown;
  responses: Record<string, unknown>;
}

const paths: Record<string, Partial<Record<Method, Operation>>> = {};
const ADMIN_SECURITY = [{ cookieAuth: [], csrfToken: [] }];

const json = (schema: z.ZodType) => ({
  required: true,
  content: {
    'application/json': { schema: z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) },
  },
});

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };
const localeParam = { name: 'locale', in: 'query', schema: { type: 'string', enum: ['uz', 'ru', 'en'], default: 'uz' } };
const pagingParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
];

const ERR = {
  '400': { description: 'Validatsiya xatosi (VALIDATION_ERROR)' },
  '401': { description: 'Tizimga kirilmagan (UNAUTHORIZED)' },
  '403': { description: 'CSRF/Origin tekshiruvi o‘tmadi' },
  '404': { description: 'Topilmadi (NOT_FOUND)' },
  '409': { description: 'Konflikt (masalan, takroriy slug: SLUG_TAKEN)' },
};

function add(
  method: Method,
  path: string,
  tag: string,
  summary: string,
  opts: { admin?: boolean; body?: z.ZodType; params?: unknown[]; status?: string; description?: string } = {},
) {
  const op: Operation = {
    summary,
    tags: [tag],
    parameters: [...(path.includes('{id}') ? [idParam] : []), ...(opts.params ?? [])],
    responses: {
      [opts.status ?? '200']: { description: opts.description ?? 'Muvaffaqiyatli' },
      ...(opts.admin ? { '401': ERR['401'], '403': ERR['403'] } : {}),
      ...(opts.body ? { '400': ERR['400'] } : {}),
      ...(path.includes('{id}') ? { '404': ERR['404'] } : {}),
    },
  };
  if (opts.admin) op.security = ADMIN_SECURITY;
  if (opts.body) op.requestBody = json(opts.body);
  paths[path] ??= {};
  paths[path][method] = op;
}

// ───────────── Ommaviy ─────────────
add('get', '/public/settings', 'Public', 'Sayt sozlamalari (tilga moslangan)', { params: [localeParam] });
add('get', '/public/navigation', 'Public', 'Asosiy va footer menyusi', { params: [localeParam] });
add('get', '/public/pages/{slug}', 'Public', 'Nashr qilingan sahifa (slug bo‘yicha)', {
  params: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }, localeParam],
});
add('get', '/public/news', 'Public', 'Yangiliklar/e’lonlar/tadbirlar ro‘yxati', {
  params: [localeParam, ...pagingParams, { name: 'type', in: 'query', schema: { type: 'string', enum: ['NEWS', 'ANNOUNCEMENT', 'EVENT'] } }, { name: 'category', in: 'query', schema: { type: 'string' } }, { name: 'q', in: 'query', schema: { type: 'string' } }, { name: 'important', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } }],
});
add('get', '/public/news/{slug}', 'Public', 'Yangilik (slug bo‘yicha)', { params: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }, localeParam] });
add('get', '/public/documents', 'Public', 'Hujjatlar ro‘yxati', { params: [localeParam, ...pagingParams, { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Vergul bilan ajratilgan hujjat turlari' }, { name: 'category', in: 'query', schema: { type: 'string' } }, { name: 'q', in: 'query', schema: { type: 'string' } }] });
add('get', '/public/documents/{id}/download', 'Public', 'Nashr qilingan hujjat faylini yuklab olish');
add('get', '/public/categories', 'Public', 'Kategoriyalar', { params: [localeParam, { name: 'scope', in: 'query', schema: { type: 'string', enum: ['NEWS', 'DOCUMENT'] } }] });
add('get', '/public/education-programs', 'Public', 'Ta’lim yo‘nalishlari', { params: [localeParam] });
add('get', '/public/staff', 'Public', 'Rahbariyat va xodimlar', { params: [localeParam, { name: 'kind', in: 'query', schema: { type: 'string', enum: ['LEADERSHIP', 'TEACHER', 'STAFF'] } }] });
add('get', '/public/gallery', 'Public', 'Fotogalereya', { params: [localeParam, ...pagingParams] });
add('get', '/public/videos', 'Public', 'Videogalereya', { params: [localeParam, ...pagingParams] });
add('get', '/public/alumni', 'Public', 'Bitiruvchilar', { params: [localeParam, ...pagingParams] });
add('get', '/public/partners', 'Public', 'Hamkor korxonalar', { params: [localeParam] });
add('post', '/public/track', 'Public', 'Sahifa ko‘rilganini qayd etish (cookie va IP saqlanmaydi)', { status: '204' });
add('get', '/public/search', 'Public', 'Sayt ichida qidiruv', { params: [localeParam, { name: 'q', in: 'query', required: true, schema: { type: 'string', minLength: 2 } }, ...pagingParams] });

// ───────────── Auth ─────────────
add('post', '/admin/auth/login', 'Auth', 'Tizimga kirish (sessiya cookie\'si va CSRF token qaytariladi)', { body: loginSchema });
add('post', '/admin/auth/logout', 'Auth', 'Chiqish', { admin: true, status: '204' });
add('get', '/admin/auth/me', 'Auth', 'Joriy administrator va CSRF token', { admin: true });
add('post', '/admin/auth/change-password', 'Auth', 'Parolni almashtirish', { admin: true, body: changePasswordSchema, status: '204' });

// ───────────── Admin CRUD ─────────────
function crud(
  base: string,
  tag: string,
  label: string,
  create: z.ZodType,
  update: z.ZodType,
  opts: { status?: boolean; versions?: boolean; preview?: boolean; paged?: boolean } = {},
) {
  add('get', base, tag, `${label}: ro‘yxat`, { admin: true, params: opts.paged === false ? [] : pagingParams });
  add('post', base, tag, `${label}: yaratish`, { admin: true, body: create, status: '201' });
  add('get', `${base}/{id}`, tag, `${label}: bittasini olish`, { admin: true });
  add('patch', `${base}/{id}`, tag, `${label}: tahrirlash`, { admin: true, body: update });
  add('delete', `${base}/{id}`, tag, `${label}: o‘chirish`, { admin: true, status: '204' });
  if (opts.status) {
    add('post', `${base}/{id}/publish`, tag, `${label}: nashr qilish`, { admin: true });
    add('post', `${base}/{id}/unpublish`, tag, `${label}: nashrdan qaytarish`, { admin: true });
    add('post', `${base}/{id}/archive`, tag, `${label}: arxivlash`, { admin: true });
  }
  if (opts.preview) add('get', `${base}/{id}/preview`, tag, `${label}: oldindan ko‘rish`, { admin: true, params: [localeParam] });
}

crud('/admin/pages', 'Pages', 'Sahifa', pageCreateSchema, pageUpdateSchema, { status: true, preview: true });
add('get', '/admin/pages/{id}/versions', 'Pages', 'Sahifa versiyalari tarixi', { admin: true });
add('post', '/admin/pages/{id}/restore-version', 'Pages', 'Oldingi versiyani tiklash', { admin: true, body: restoreVersionSchema });
crud('/admin/news', 'News', 'Yangilik/e’lon/tadbir', newsCreateSchema, newsUpdateSchema, { status: true, preview: true });
crud('/admin/documents', 'Documents', 'Hujjat', documentCreateSchema, documentUpdateSchema);
crud('/admin/categories', 'Categories', 'Kategoriya', categoryCreateSchema, categoryUpdateSchema, { paged: false });
crud('/admin/education-programs', 'Education', 'Ta’lim yo‘nalishi', programCreateSchema, programUpdateSchema, { status: true, paged: false });
crud('/admin/staff', 'Staff', 'Xodim', staffCreateSchema, staffUpdateSchema, { status: true, paged: false });

crud('/admin/videos', 'Videos', 'Video', videoCreateSchema, videoUpdateSchema, { status: true, paged: false });
crud('/admin/alumni', 'Alumni', 'Bitiruvchi', alumnusCreateSchema, alumnusUpdateSchema, { status: true, paged: false });
crud('/admin/partners', 'Partners', 'Hamkor korxona', partnerCreateSchema, partnerUpdateSchema, { status: true, paged: false });
add('get', '/admin/users', 'Users', 'Foydalanuvchilar ro‘yxati', { admin: true });
add('post', '/admin/users', 'Users', 'Foydalanuvchi yaratish', { admin: true, body: userCreateSchema, status: '201' });
add('patch', '/admin/users/{id}', 'Users', 'Rol, faollik, parolni o‘zgartirish', { admin: true, body: userUpdateSchema });
add('get', '/admin/stats', 'Stats', 'Ko‘rishlar statistikasi va kontent soni', { admin: true, params: [{ name: 'days', in: 'query', schema: { type: 'integer', minimum: 7, maximum: 365, default: 30 } }] });
add('get', '/admin/reports/views.csv', 'Stats', 'Ko‘rishlar hisoboti (CSV)', { admin: true });
add('get', '/admin/reports/content.csv', 'Stats', 'Kontent ro‘yxati hisoboti (CSV)', { admin: true });
add('get', '/admin/media', 'Media', 'Media kutubxonasi', { admin: true, params: pagingParams });
add('post', '/admin/media', 'Media', 'Fayl yuklash (multipart/form-data, maydon: file)', { admin: true, status: '201' });
add('get', '/admin/media/{id}', 'Media', 'Fayl va uning ishlatilish joylari', { admin: true });
add('patch', '/admin/media/{id}', 'Media', 'Alt matn, sarlavha, galereya belgisi', { admin: true, body: mediaUpdateSchema });
add('get', '/admin/media/{id}/file', 'Media', 'Fayl kontentini yuklab olish (admin)', { admin: true });
add('delete', '/admin/media/{id}', 'Media', 'Faylni o‘chirish (ishlatilayotgan bo‘lsa ?force=true kerak)', { admin: true, status: '204', params: [{ name: 'force', in: 'query', schema: { type: 'string', enum: ['true'] } }] });

add('get', '/admin/navigation', 'Navigation', 'Menyular', { admin: true });
add('put', '/admin/navigation', 'Navigation', 'Menyularni to‘liq almashtirish', { admin: true, body: navigationUpdateSchema });
add('get', '/admin/settings', 'Settings', 'Sayt sozlamalari', { admin: true });
add('patch', '/admin/settings', 'Settings', 'Sozlama guruhlarini yangilash', { admin: true, body: settingsPatchSchema });
add('get', '/admin/audit-logs', 'Audit', 'Audit jurnali', { admin: true, params: pagingParams });
add('get', '/admin/dashboard', 'Dashboard', 'Dashboard statistikasi', { admin: true });
add('get', '/admin/translations', 'Translations', 'Tarjimalar holati', { admin: true, params: pagingParams });

export function buildOpenApi() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Uchko‘prik 1-sonli texnikumi portali API',
      version: '1.0.0',
      description:
        'Xatolik formati: `{ "error": { "code": string, "message": string, "details"?: any } }`.\n' +
        'Admin endpointlari `sid` cookie va `X-CSRF-Token` sarlavhasini talab qiladi (token login/me javobida qaytariladi).',
    },
    servers: [{ url: '/api/v1' }],
    paths,
    components: {
      securitySchemes: {
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'sid' },
        csrfToken: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
      },
    },
  };
}

export function mountApiDocs(app: Express) {
  const spec = buildOpenApi();
  app.get('/api/v1/openapi.json', (_req, res) => res.json(spec));
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(spec, { customSiteTitle: 'Portal API' }));
}
