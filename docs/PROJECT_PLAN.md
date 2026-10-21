# Loyiha rejasi — Uchko‘prik 1-sonli texnikumi rasmiy web-portali

Holat belgilari: ✅ bajarilgan va tekshirilgan · ⚠️ cheklangan/qisman · ❌ bajarilmagan

## 1. Arxitektura

Modulli monolit (npm workspaces):

```
uchkoprik-portal/
├── shared/    # Zod sxemalar, enumlar, API turlari, slug/til yordamchilari (client va server uchun yagona manba)
├── server/    # Express 5 REST API (TypeScript), modullar: auth, pages, news, documents, media, categories,
│              #   programs, staff, navigation, settings, search (public), audit, dashboard, seo, scheduler
├── client/    # React 19 + Vite + Tailwind 4: ommaviy sayt (/uz /ru /en) va admin panel (/admin, lazy chunk)
├── prisma/    # schema.prisma, migrations/, seed.ts (faqat tuzilma)
├── scripts/   # dev-db (embedded PostgreSQL), create-admin, backup/restore
├── e2e/       # Playwright (Edge) — production build ustida
└── docs/
```

Asosiy qarorlar:
- **Til**: URL boshida (`/uz/...`); kontent `*_translations` jadvallarida, `(entity_id, locale)` va `(locale, slug)` takrorlanmas.
- **CMS sahifalar**: `pages` + `template` (DEFAULT, SECTION, DOCUMENTS, STAFF, PROGRAMS). Hujjatlar, rahbariyat, yo‘nalishlar ro‘yxatlari sahifa shabloni orqali chiqadi, shuning uchun menyu va URL’lar to‘liq admin tomonidan boshqariladi.
- **Autentifikatsiya**: serverda saqlanadigan sessiya (token xeshi bazada), HttpOnly + SameSite=Strict cookie, CSRF token sarlavhasi, Origin tekshiruvi.
- **SEO**: SPA; production’da Express HTML qobig‘iga sahifa uchun `title/description/canonical/hreflang/robots` joylaydi, `sitemap.xml`, `robots.txt`, to‘g‘ri 404 status.
- **Media**: rasmlar `uploads/images` (ommaviy), hujjatlar `uploads/documents` (faqat nashr tekshiruvidan so‘ng endpoint orqali).

## 2. Bosqichlar va holat

| Bosqich | Holat |
|---|---|
| 1. Audit va rejalashtirish (katalog bo‘sh edi, noldan yaratildi) | ✅ |
| 2. Loyiha asosi: workspaces, TS, ESLint/Prettier, env, error handler, logging, test infratuzilmasi | ✅ |
| 3. Baza (22 jadval + migratsiya), login/logout, sessiyalar, audit, himoyalangan route’lar | ✅ |
| 4. Dizayn tizimi (tokenlar, UI komponentlar, header/footer, responsive) | ✅ |
| 5. Ommaviy sayt: bosh, CMS sahifalar, yangiliklar/e’lonlar/tadbirlar, hujjatlar, galereya, foydali havolalar, aloqa, qidiruv, 404 | ✅ |
| 6. Admin panel: dashboard, sahifalar (+versiyalar), yangiliklar, hujjatlar, media, kategoriyalar, yo‘nalishlar, xodimlar, menyu, sozlamalar, tarjimalar holati, audit, parol | ✅ |
| 7. Integratsiya (hamma forma real API bilan) | ✅ |
| 8. Xavfsizlik va testlar | ✅ (6-bo‘limga qarang) |
| 9. Hujjatlar va ishga tushirish | ✅ |

## 3. Ma’lumotlar bazasi
`docs/DATABASE.md`. Spetsifikatsiyadagi 22 jadvalning hammasi yaratilgan; qo‘shimcha jadval kiritilmagan.

## 4. API
`docs/API.md`; jonli Swagger UI: `/api/v1/docs` (faqat dev yoki `ENABLE_API_DOCS=true`).

## 5. Ma’lum cheklovlar / bajarilmagan ishlar

- ⚠️ **Video fayl yuklash**: MP4, MOV, WebM (chegara `MAX_VIDEO_MB`, standart 300 MB). Server videoni **qayta kodlamaydi** va ko‘rsatkich rasm yaratmaydi (ffmpeg yo‘q): ijro brauzerning kodek qo‘llab-quvvatlashiga bog‘liq (masalan, iPhone HEVC videosi Chrome/Edge’ning ba’zi versiyalarida ijro etilmasligi mumkin — H.264 tavsiya etiladi). Yuklash to‘xtab qolsa, qayta boshlanmaydi (resume yo‘q). Video kuchli trafik hosil qiladi: ko‘p tashrif uchun CDN yoki YouTube/Vimeo havolasi afzal. YouTube/Vimeo havolasi ham qo‘llab-quvvatlanadi (pleyer bosilganda tashqi serverga ulanadi).
- ⚠️ **Statistika taxminiy**: har bir sahifa ko‘rilishi sanaladi (cookie/IP saqlanmaydi), noyob tashrif ajratilmaydi.
- ⚠️ **Rollar** uchta (Administrator, Bosh muharrir, Muharrir); individual ruxsatlar sozlanmaydi, rolga biriktirilgan to‘plam ishlaydi. Parolni administrator belgilaydi; email orqali tiklash yo‘q.
- ⚠️ **Modul o‘chirilganda** bog‘liq admin API ham 404 qaytaradi; CMS sahifalari modulga seed orqali biriktiriladi (admin panelda biriktirib bo‘lmaydi).
- ⚠️ **To‘liq SSR yo‘q**: JS ishlamaydigan qidiruv botlari faqat meta-teglarni (title, description, canonical, hreflang) ko‘radi, sahifa tanasini emas. Yechim: prerender/SSR (tavsiya, 12-bo‘lim).
- ⚠️ Nashr holati **butun material** darajasida (barcha tillar birga). Tarjima bo‘yicha alohida nashr qilinmaydi; til mavjudligi tarjima yozuvi bor-yo‘qligidan aniqlanadi.
- ⚠️ **Rejalashtirilgan nashr** faqat yangiliklar/e’lonlar/tadbirlar uchun (server ichidagi scheduler). Sahifa va hujjatlar uchun yo‘q.
- ⚠️ Qidiruv — PostgreSQL `ILIKE` (tanlangan til doirasida, relevantlik reytingi sodda). Katta hajmda FTS (tsvector) tavsiya etiladi.
- ⚠️ Rate limit xotirada (bitta server nusxasi uchun). Ko‘p nusxada umumiy store (Redis) kerak.
- ⚠️ Parol tiklash faqat server buyrug‘i orqali (`npm run admin:create -- --reset`); email orqali tiklash yo‘q (ataylab: ochiq tiklash endpointi xavfi).
- ⚠️ Admin interfeysi faqat o‘zbek tilida. Ommaviy sayt UI matnlari uch tilda.
- ⚠️ Backup — mantiqiy (JSON) usul sinovdan o‘tgan; `pg_dump` yo‘riqnomasi hujjatlashtirilgan, lekin bu muhitda `pg_dump` yo‘qligi sababli bajarib ko‘rilmagan.
- ⚠️ Docker fayllari (`Dockerfile`, `docker-compose.yml`) yozilgan, lekin bu muhitda Docker yo‘qligi sababli ishga tushirib sinalmagan.
- ⚠️ Haqiqiy HTTPS (TLS) bu muhitda sinalmagan: HTTPS majburlash, HSTS va Secure cookie mantig‘i test qilingan, TLS reverse proxy (Nginx/Caddy) zimmasida.
- ⚠️ Avtomatik accessibility auditi (axe/Lighthouse) ishga tushirilmagan; semantik HTML, label’lar, fokus, ARIA qo‘lda ta’minlangan.
- ⚠️ Mobil testlar Edge’ning qurilma emulyatsiyasi (Pixel 5) va 320–1920 px viewport’larda bajarilgan; real qurilmalarda tekshirilmagan.

## 5.1 Funksiya modullari, rollar va statistika
- `shared/src/modules.ts` — modullar ro‘yxati va standart holat (20 ta; 14 tasi yoqilgan). Holat `site_settings.modules` da; server `lib/modules.ts` (3 soniyalik kesh) orqali tekshiradi.
- `shared/src/permissions.ts` — rol → ruxsat jadvali; server tekshiruvi `middleware/auth.ts` (`contentGuard`, `requirePermission`, `assertEditable`).
- Statistika: `page_views(day, path, count)`; faqat mavjud, nashr qilingan sahifalar sanaladi; botlar va DNT hisobga olinmaydi.

## 6. Bajarilgan testlar
Natijalar `README.md` va yakuniy hisobotda. Ishga tushirish: `npm test`, `npm run test:e2e`.

## 7. Seed haqida
Seed faqat sayt **tuzilmasi**ni (20 sahifa sarlavhasi uch tilda va ikki menyu) yaratadi. Mazmun bo‘sh: yangilik, hujjat, statistika, aloqa ma’lumoti o‘ylab topilmagan. Bo‘sh holatlar saytda halol ko‘rsatiladi. Sarlavhalar tarjimalari (ru/en) texnik yorliqlar sifatida berilgan — nashrdan oldin tekshirib chiqing.
