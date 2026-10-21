# Xavfsizlik

Har bir band kodda joyi va tekshiruvchi test bilan ko‘rsatilgan.

| Talab | Amalga oshirilishi | Test |
|---|---|---|
| Parol xeshi | Argon2id (m=64 MiB, t=3) — `server/src/lib/password.ts` | `auth.test.ts` |
| Server sessiyalari | `sessions` jadvali, cookie’da tasodifiy token, bazada faqat SHA-256 xeshi; muddat `SESSION_TTL_HOURS`; login’da eski sessiya almashtiriladi | `auth.test.ts` |
| Cookie | `HttpOnly`, `SameSite=Strict`, `Secure` (production’da majburiy, `__Host-` prefiksi) | `auth.test.ts`, `security.test.ts` |
| CSRF | `X-CSRF-Token` (sessiyaga bog‘liq, `timingSafeEqual`) + `Origin` tekshiruvi + SameSite=Strict | `auth.test.ts` |
| Rate limiting | Login: IP bo‘yicha (`LOGIN_RATE_MAX`/oyna, faqat muvaffaqiyatsiz urinishlar) va email bo‘yicha; umumiy API: `API_RATE_MAX`/daqiqa | `auth.test.ts`, `security.test.ts` |
| Foydalanuvchi mavjudligini oshkor qilmaslik | Bir xil xabar/kod + soxta xesh bilan vaqtni tenglashtirish | `auth.test.ts` |
| Server tomonida huquq tekshiruvi | Barcha `/admin/*` (login’dan tashqari) `requireSession` ortida; rol → ruxsat jadvali bo‘yicha har bir marshrut guruhi tekshiriladi | `auth.test.ts`, `roles.test.ts` |
| Rollar | Administrator / Bosh muharrir / Muharrir; muharrir nashr qila olmaydi va nashr qilingan materialni tahrirlay olmaydi; o‘zini bloklash va oxirgi administratorni yo‘qotish taqiqlangan; rol/parol o‘zgarsa sessiyalar yopiladi | `roles.test.ts` |
| Modullar | O‘chirilgan modul API’da ham yopiladi (404), faqat `modules.manage` o‘zgartiradi | `modules.test.ts` |
| Statistika maxfiyligi | Cookie, IP, user-agent saqlanmaydi; faqat (kun, yo‘l, soni); DNT va botlar hisobga olinmaydi; tasodifiy yo‘llar bilan jadvalni to‘ldirib bo‘lmaydi | `extras.test.ts` |
| CSV hisobotlar | UTF-8 BOM, formula in’ektsiyasidan himoya (`=`,`+`,`-`,`@` apostrof bilan), audit’ga yoziladi | `extras.test.ts` |
| Video (havola) | Faqat YouTube/Vimeo havolalari; iframe `sandbox` bilan, bosilgandagina yuklanadi | `extras.test.ts`, e2e |
| Video (fayl) | Faqat `media.write` ruxsati; tarkib sarlavhasi (magic bytes) bo‘yicha MP4/MOV/WebM, kengaytma mos bo‘lishi shart; hajm `MAX_VIDEO_MB`, diskka oqim bilan yoziladi (xotiraga to‘liq o‘qilmaydi); tasodifiy nom; qoralama/arxiv video begonalarga berilmaydi (404); yetim va vaqtinchalik fayllar avtomatik tozalanadi | `video-upload.test.ts`, e2e |
| Validatsiya | Zod (server va client bir xil sxemalar) | barcha testlar |
| XSS | Rich-text server’da `sanitize-html` allowlist’i bilan tozalanadi (script, on*, javascript:, iframe olib tashlanadi); brauzerda yana DOMPurify; React matnni escape qiladi; CSP `script-src 'self'` | `pages.test.ts`, `components.test.tsx`, e2e |
| SQL injection | Faqat Prisma parametrlangan so‘rovlari (raw SQL faqat o‘zgarmas jadval nomlari bilan — backup) | — |
| Fayl yuklash | Haqiqiy tarkib (magic bytes, `file-type`), kengaytma-tarkib mosligi, hajm limiti (`MAX_UPLOAD_MB`), SVG/HTML/EXE rad etiladi, rasmlar `sharp` bilan qayta kodlanadi (EXIF olib tashlanadi), tasodifiy server nomi, foydalanuvchi nomi yo‘l sifatida ishlatilmaydi, hujjatlar statik katalogdan tashqarida va faqat nashr tekshiruvi bilan beriladi | `documents.test.ts`, `news.test.ts` |
| HTTPS | `FORCE_HTTPS` (308 yo‘naltirish, `TRUST_PROXY` bilan), HSTS, production’da `PUBLIC_URL=https` va `COOKIE_SECURE=true` majburiy | `security.test.ts` |
| CORS | Faqat `CORS_ORIGINS` ro‘yxati; bo‘sh bo‘lsa cross-origin yo‘q | `security.test.ts` |
| Headerlar | Helmet: CSP, nosniff, frame-ancestors none, referrer-policy, COOP/CORP. `frame-src` faqat `youtube-nocookie.com` va `player.vimeo.com` (videogalereya) | `security.test.ts`, e2e (CSP buzilishi yo‘qligi) |
| Loglar | `pino` + redaksiya (cookie, parol, token); audit `meta`ga maxfiy ma’lumot yozilmaydi | `auth.test.ts` |
| Sirlar | `.env` Git’da yo‘q; standart parol yo‘q; administrator CLI orqali | — |
| Audit | Barcha o‘zgartirishlar, login/logout/muvaffaqiyatsiz kirish | `site.test.ts` |
| O‘chirishdan himoya | Ishlatilayotgan media tasdiqsiz o‘chirilmaydi; majburiy bog‘langan (hujjat, sozlama) umuman o‘chirilmaydi | `documents.test.ts` |
| Backup | `npm run db:backup` / `db:restore` | `backup.test.ts` |

## Ma’lum xavf va tavsiyalar
- Yuklangan **rasmlar** `/uploads/images/<uuid>` orqali ommaviy (nomi taxmin qilib bo‘lmaydi, lekin havolani bilgan kishi ko‘ra oladi — nashr qilinmagan muqova ham).
- Yuklangan videoning **kodeki/mazmuni tekshirilmaydi** (faqat konteyner turi): xodim ishonchli deb faraz qilinadi. Video fayllar nashr qilingach, havolasini bilgan har kim yuklab olishi mumkin.
- Login rate limit **xotirada** — bir nechta server nusxasida har biri alohida hisoblaydi (Redis store tavsiya).
- Reverse proxy’da `TRUST_PROXY` to‘g‘ri qo‘yilmasa, IP bo‘yicha limit proxy IP’iga qo‘llanadi.
- 2FA yo‘q. Administrator parolini kuchli saqlang, `ENABLE_API_DOCS` productionda o‘chiq tursin.
- Bog‘liqliklarni muntazam `npm audit` bilan tekshiring. Holat: `npm audit --omit=dev` — 0 zaiflik. `prisma` CLI ichidagi `deepmerge-ts` `package.json` → `overrides` orqali 8.x ga ko‘tarilgan (Prisma 7 ga o‘tmasdan). To‘liq `npm audit` faqat test vositasi `vitest/tinypool` dagi zaifliklarni ko‘rsatadi (serverga tushmaydi; vitest 5 ga o‘tish katta o‘zgarish).
