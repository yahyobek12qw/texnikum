# Uchko‘prik 1-sonli texnikumi — rasmiy web-portal

Uch tilli (uz / ru / en) rasmiy axborot portali va unga bog‘langan kontent boshqaruv tizimi (admin panel).
Stek: **React 19 + Vite + Tailwind 4 · Express 5 · Prisma 6 · PostgreSQL · Zod · Vitest · Playwright**.

Tuzilma va rejalar: [docs/PROJECT_PLAN.md](docs/PROJECT_PLAN.md) · API: [docs/API.md](docs/API.md) · Baza: [docs/DATABASE.md](docs/DATABASE.md) ·
Xavfsizlik: [docs/SECURITY.md](docs/SECURITY.md) · Joylashtirish: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) · Admin qo‘llanmasi: [docs/ADMIN_GUIDE.md](docs/ADMIN_GUIDE.md)

## Imkoniyatlar

| Bo‘lim | Holat |
|---|---|
| Kollej haqida, tarix, tuzilma, **rahbariyat** | ✅ |
| **Yo‘nalishlar va mutaxassisliklar** | ✅ |
| **Qabul shartlari va qabul hujjatlari** (`/admission`) | ✅ |
| Yangiliklar, **tadbirlar** va **e’lonlar** | ✅ |
| **Foto va video galereya** (video: kompyuter/telefondan fayl yuklash yoki YouTube/Vimeo havolasi; bosilganda yuklanadi) | ✅ |
| **Manzil, telefon, ish vaqti, aloqa** | ✅ |
| **Bitiruvchilar** va **hamkor korxonalar** | ✅ |
| Sayt sahifalari va yangiliklarni boshqarish (admin panel) | ✅ |
| **Statistika va hisobotlar** (ko‘rishlar, “Raqamlarda”, CSV) | ✅ |
| **Foydalanuvchilar, rollar va ruxsatlar** (Administrator / Bosh muharrir / Muharrir) | ✅ |
| Qidiruv, foydali havolalar, ochiqlik/shaffoflik, faoliyat bo‘limi, o‘qituvchilar ro‘yxati, tarjimalar sahifasi | ⏸ hozircha **o‘chirilgan** — admin paneldagi **Modullar** sahifasida (yoki `npm run modules`) yoqiladi |

## Modullarni yoqish/o‘chirish
Admin panel → **Modullar**. O‘chirilgan bo‘lim saytda, menyuda, sitemap’da, API’da va admin panelda yashiriladi; **ma’lumotlar o‘chmaydi**. Buyruq qatori:

```bash
npm run modules                      # holatni ko‘rsatadi
npm run modules -- enable search     # yoqish
npm run modules -- disable search    # o‘chirish
npm run modules -- all-on            # hammasini yoqish   (defaults — standart holatga qaytarish)
```

## Talablar
- Node.js ≥ 20 (24 da sinalgan), npm ≥ 10
- PostgreSQL ≥ 15 (UTF-8 kodirovkada). PostgreSQL o‘rnatilmagan bo‘lsa, ishlab chiqish uchun `npm run db:dev` real PostgreSQL 17 binarilarini npm orqali ishga tushiradi.

## Tez boshlash (ishlab chiqish)

```bash
npm install                      # bog‘liqliklar + Prisma client generatsiyasi
cp .env.example .env             # Windows: copy .env.example .env  (qiymatlarni ko‘rib chiqing)
npm run db:dev                   # 1-terminal: mahalliy PostgreSQL (.pgdata, port 54320). O‘z PostgreSQL’ingiz bo‘lsa, kerak emas
npm run db:deploy                # migratsiyalarni qo‘llash
npm run db:seed                  # sayt tuzilmasi (sahifalar + menyu), soxta kontentsiz; yangilanganda ham xavfsiz qayta ishga tushiriladi
npm run admin:create             # administrator yaratish (parol terminalda yashirin so‘raladi)
npm run dev                      # server http://localhost:4000, sayt http://localhost:5173
```

Admin panel: `http://localhost:5173/admin` · Swagger: `http://localhost:4000/api/v1/docs` (faqat dev).

## Administratorni xavfsiz yaratish
Standart parol yo‘q, ro‘yxatdan o‘tish endpointi yo‘q. Administrator faqat serverda buyruq bilan yaratiladi:

```bash
npm run admin:create             # interaktiv (email, ism, parol ×2)
npm run admin:create -- --reset  # mavjud administrator parolini tiklash (barcha sessiyalar yopiladi)
```
Parol ≥ 12 belgi, harf va raqam. CI uchun `ADMIN_EMAIL`, `ADMIN_PASSWORD` bir martalik environment sifatida berilishi mumkin (faylga yozmang).

## Buyruqlar

| Buyruq | Vazifa |
|---|---|
| `npm run dev` | server (tsx watch) + Vite dev server |
| `npm run build` | client (tsc + vite) va server (tsup) production build |
| `npm start` | production serverni ishga tushirish (`server/dist/server.js`, `client/dist` ni ham xizmat qiladi) |
| `npm test` | server (Vitest + real PostgreSQL) va client (Vitest + RTL) testlari |
| `npm run test:e2e` | Playwright (Edge) — avval `npm run build` kerak |
| `npm run typecheck` / `npm run lint` | TypeScript va ESLint |
| `npm run db:migrate:dev` | yangi migratsiya yaratish (dev) |
| `npm run db:deploy` | migratsiyalarni qo‘llash (production) |
| `npm run db:backup` / `db:restore -- <papka> --yes` | zaxira nusxa va tiklash |
| `npm run modules` | funksiya modullarini boshqarish |
| `npm run db:seed:demo` / `db:unseed:demo -- --yes` | namunaviy (demo) kontent qo‘shish / olib tashlash |

## Environment o‘zgaruvchilari
Hammasi [.env.example](.env.example) da izohlangan. Muhimlari: `DATABASE_URL`, `PUBLIC_URL` (https), `COOKIE_SECURE=true`, `FORCE_HTTPS`, `TRUST_PROXY`, `CORS_ORIGINS`, `UPLOAD_DIR`, `MAX_UPLOAD_MB` (standart 20), `MAX_VIDEO_MB` (video, standart 300), `LOGIN_RATE_*`, `API_RATE_MAX`.
Production’da `PUBLIC_URL` https:// bo‘lmasa yoki `COOKIE_SECURE=false` bo‘lsa, server ishga tushmaydi.

## Test natijalari
Oxirgi to‘liq ishga tushirish natijalari uchun `docs/PROJECT_PLAN.md` va yakuniy hisobotga qarang. Testlar:
- `server/tests` — auth, sahifalar, uch tillilik, yangiliklar, hujjatlar/media, sayt (menyu, sozlamalar, qidiruv, SEO, audit), backup/restore, xavfsizlik (real PostgreSQL, migratsiyalar bo‘sh bazaga qo‘llanadi).
- `client/src/**/*.test.tsx` — komponent va forma testlari.
- `e2e/` — production build ustida brauzer testlari (desktop, mobil, 320–1920 px).

## Litsenziya va ramzlar
Logotip berilmagan: neytral vaqtincha belgi ishlatiladi. Davlat ramzlari qo‘llanmagan; logotipni admin paneldan (Sayt sozlamalari → Umumiy) yuklang.
