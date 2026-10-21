# Ma’lumotlar bazasi (PostgreSQL + Prisma)

Manba: [`prisma/schema.prisma`](../prisma/schema.prisma); migratsiyalar: `prisma/migrations/`. Jadval nomlari spetsifikatsiyadagidek (`@@map`), ustunlar camelCase (Prisma maydon nomlari).

**Kodirovka:** baza UTF-8 bo‘lishi shart. Katta/kichik harfga befarq qidiruv (`ILIKE`) kirill harflari bilan ishlashi uchun Unicode’ni biladigan locale kerak (Linux’da `en_US.UTF-8` yoki `C.UTF-8`; PG 17+ da `builtin` provider). Yaratish: `CREATE DATABASE uchkoprik ENCODING 'UTF8' TEMPLATE template0 LOCALE 'en_US.UTF-8';`

## Jadvallar
| Guruh | Jadvallar |
|---|---|
| Kirish | `users`, `sessions` (id = token SHA-256 xeshi, `csrfToken`, `expiresAt`) |
| Sahifalar | `pages` (parent, template, options, status), `page_translations`, `page_versions` (snapshot JSON) |
| Axborot | `news` (type: NEWS/ANNOUNCEMENT/EVENT, status, `isImportant`, `publishedAt`, `scheduledAt`, `eventAt`), `news_translations` |
| Tasnif | `categories` (scope: NEWS/DOCUMENT), `category_translations` |
| Hujjatlar | `documents` (type, status, `fileMediaId` → media, `docDate`, `number`), `document_translations` |
| Media | `media` (storedName tasodifiy, sha256, kind IMAGE/DOCUMENT/VIDEO), `media_translations` (alt, caption) |
| Menyu | `navigation_menus` (`main`, `footer`), `navigation_items` (PAGE/ROUTE/EXTERNAL, daraxt), `navigation_item_translations` |
| Ta’lim va xodimlar | `education_programs` + `_translations`, `staff` + `_translations` |
| Galereya, bitiruvchilar, hamkorlar | `gallery_videos` + `_translations` (provider YOUTUBE/VIMEO/UPLOAD, externalId, `fileMediaId` → yuklangan video), `alumni` + `_translations`, `partners` + `_translations` |
| Statistika | `page_views` (kun + yo‘l → soni; shaxsiy ma’lumot yo‘q) |
| Tizim | `site_settings` (kalit → JSON guruh), `audit_logs` |

## Qoidalar
- Har bir `*_translations`: `UNIQUE(entityId, locale)`; sahifa/yangilik/kategoriya uchun `UNIQUE(locale, slug)`.
- Statuslar: `DRAFT | PUBLISHED | ARCHIVED`. Ommaviy API faqat `PUBLISHED` (yangilik uchun `publishedAt ≤ now`).
- O‘chirish: tarjimalar `CASCADE`; ota sahifa `RESTRICT` (ichki sahifasi bor sahifa o‘chmaydi); hujjat → fayl `RESTRICT`; muqova/foto/kategoriya `SET NULL`; menyu bandi sahifa o‘chsa `CASCADE`.
- Indekslar: `(status, publishedAt)`, `(type, status)`, `scheduledAt`, `expiresAt`, audit `createdAt` va h.k.
- `users.role`: `ADMIN | PUBLISHER | EDITOR`. `pages.module` — sahifa qaysi funksiya moduliga tegishli (modul o‘chirilsa, sahifa saytda yashiriladi).
- Rich-text HTML bazaga **sanitizatsiya qilingan** holda yoziladi.

## Migratsiya va tiklash
```bash
npm run db:deploy        # bo‘sh bazaga barcha migratsiyalar (test global-setup shuni tekshiradi)
npm run db:seed          # tuzilma (idempotent)
npm run db:backup        # backups/<vaqt>/ (JSON + uploads)
npm run db:restore -- backups/<vaqt> --yes
```
