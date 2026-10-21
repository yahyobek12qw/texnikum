# API (REST, `/api/v1`)

Jonli, sxemali hujjat: **Swagger UI** `/api/v1/docs`, **OpenAPI 3.1 JSON** `/api/v1/openapi.json` (dev’da yoqilgan; productionda `ENABLE_API_DOCS=true`). So‘rov tanasi sxemalari `shared/src/schemas.ts` dagi Zod sxemalardan avtomatik hosil qilinadi.

## Umumiy qoidalar
- **Xatolik formati**: `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "path": "translations.uz.title", "message": "…" }] } }`
- **Kodlar**: 400 validatsiya / noto‘g‘ri JSON, 401 sessiya yo‘q, 403 CSRF/Origin, 404, 409 konflikt (`SLUG_TAKEN`, `SLUG_RESERVED`, `MEDIA_IN_USE`, `HAS_CHILDREN`, `CATEGORY_IN_USE`), 413 fayl katta, 415 fayl turi, 429 limit.
- **Pagination**: `?page=1&pageSize=20` → `{ items, meta: { page, pageSize, total, totalPages } }`.
- **Til**: ommaviy endpointlarda `?locale=uz|ru|en` (standart `uz`).
- **Admin**: `sid` cookie (`__Host-sid` productionda) + `X-CSRF-Token` (login / `me` javobidagi `csrfToken`) o‘zgartiruvchi so‘rovlarda.

## Ommaviy (faqat nashr qilingan kontent)
| Metod | Yo‘l |
|---|---|
| GET | `/public/settings` · `/public/navigation` |
| GET | `/public/pages/:slug` — boshqa tildagi slug bilan so‘ralsa, mos tarjima slugi qaytadi; tarjima yo‘q bo‘lsa `isFallback: true` + asl til |
| GET | `/public/news` (`type`, `category`, `q`, `important`, pagination) · `/public/news/:slug` |
| GET | `/public/documents` (`type` vergul bilan, `category`, `q`) · `/public/documents/:id/download` (`?inline=1` faqat PDF) |
| GET | `/public/videos` · `/public/alumni` · `/public/partners` — mos modul o‘chirilgan bo‘lsa 404 `MODULE_DISABLED` |
| POST | `/public/track` — sahifa ko‘rishini qayd etadi (204; cookie/IP saqlanmaydi) |
| GET | `/public/categories` · `/public/education-programs` · `/public/staff` (`kind`) · `/public/gallery` · `/public/search?q=` |

Server HTML marshrutlari: `/sitemap.xml`, `/robots.txt`, `/healthz`, `/uploads/images/*`, `/uploads/thumbs/*`, `/uploads/videos/:nom` (HTTP Range bilan; faqat nashr qilingan videoga biriktirilgan va “Videogalereya” moduli yoqilgan bo‘lsa hamma uchun, aks holda faqat kirgan xodimga, bo‘lmasa 404).

## Admin (`/admin/...`, hammasi autentifikatsiya talab qiladi)
| Resurs | Endpointlar |
|---|---|
| Auth | `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` · `POST /auth/change-password` |
| Pages | `GET/POST /pages` · `GET/PATCH/DELETE /pages/:id` · `POST /pages/:id/publish|unpublish|archive` · `POST /pages/:id/restore-version` · `GET /pages/:id/versions` · `GET /pages/:id/preview` |
| News (yangilik/e’lon/tadbir) | `GET/POST /news` · `GET/PATCH/DELETE /news/:id` · `POST /news/:id/publish|unpublish|archive` · `GET /news/:id/preview` |
| Documents | `GET/POST /documents` · `GET/PATCH/DELETE /documents/:id` (holat `PATCH {status}` orqali) |
| Media | `GET/POST /media` (multipart `file`) · `GET/PATCH/DELETE /media/:id` (`?force=true`) · `GET /media/:id/file` |
| Categories, Education programs, Staff | `GET/POST /…` · `GET/PATCH/DELETE /…/:id` (+ `publish|unpublish|archive` yo‘nalish va xodimlar uchun) |
| Navigation | `GET/PUT /navigation` (to‘liq daraxt almashtiriladi) |
| Settings | `GET/PATCH /settings` (guruhlar: general, topBar, contacts, social, footer, seo, homeAbout, banners, usefulLinks) |
| Video fayl yuklash | `POST /videos/upload` (multipart `file`; mp4/mov/m4v/webm; `media.write`) → `AdminMedia` (kind `VIDEO`); keyin `POST /videos { fileMediaId, … }` yoki `PATCH /videos/:id { fileMediaId }`. Aynan bitta manba: `sourceUrl` YOKI `fileMediaId` |
| Videos, Alumni, Partners | `GET/POST /…` · `GET/PATCH/DELETE /…/:id` · `POST /…/:id/publish|unpublish|archive` |
| Users (faqat `users.manage`) | `GET/POST /users` · `PATCH /users/:id` (rol, faollik, parol) |
| Statistika | `GET /stats?days=` · `GET /reports/views.csv` · `GET /reports/content.csv` |
| Boshqa | `GET /audit-logs` · `GET /dashboard` · `GET /translations` |

## Ruxsatlar va modullar
Har bir admin so‘rovi rolning ruxsatlari bo‘yicha tekshiriladi (`403 PERMISSION_DENIED`). `GET /admin/auth/me` javobida `permissions` va `modules` bor. Modullar `PATCH /admin/settings { "modules": { "search": true } }` (`modules.manage` ruxsati) orqali o‘zgaradi.

## Tarjimali yozuv shakli
```json
{ "template": "DEFAULT", "sortOrder": 0, "parentId": null,
  "translations": { "uz": { "title": "…", "slug": "…", "content": "<p>…</p>", "seoTitle": null, "seoDescription": null },
                    "ru": { … } } }
```
`PATCH`da: berilgan til almashtiriladi, `"ru": null` tarjimani o‘chiradi, berilmagan til o‘zgarmaydi. `uz` majburiy va o‘chirib bo‘lmaydi.
