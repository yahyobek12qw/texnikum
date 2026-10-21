# Joylashtirish (production)

Arxitektura: **Nginx/Caddy (TLS)** → **Node server** (`server/dist/server.js`, `client/dist` ni ham xizmat qiladi) → **PostgreSQL** (internetdan yopiq, faqat server ko‘radi). Yuklangan fayllar `UPLOAD_DIR` da (doimiy disk).

## 1. Server tayyorlash
- Node.js ≥ 20, PostgreSQL ≥ 15, reverse proxy (TLS sertifikat — Let’s Encrypt).
- PostgreSQL: UTF-8 baza (`docs/DATABASE.md`), alohida foydalanuvchi, tashqaridan ulanish yopiq (`listen_addresses=localhost` yoki private tarmoq).

## 2. O‘rnatish
```bash
git clone <repo> && cd uchkoprik-portal
npm ci
cp .env.example .env     # quyidagi production qiymatlarini kiriting
npm run build
npm run db:deploy        # migratsiyalar
npm run db:seed          # (faqat birinchi marta) sayt tuzilmasi
npm run admin:create     # birinchi administrator
npm start
```

## 3. Production `.env`
```
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://portal:<kuchli-parol>@localhost:5432/uchkoprik?schema=public
PUBLIC_URL=https://<domen>
COOKIE_SECURE=true
FORCE_HTTPS=true
TRUST_PROXY=1               # Nginx/Caddy ortida
CORS_ORIGINS=               # bitta domenda bo‘sh qoldiring
UPLOAD_DIR=/var/lib/uchkoprik/uploads
MAX_UPLOAD_MB=20
MAX_VIDEO_MB=300
ENABLE_API_DOCS=false
```
Production’da `PUBLIC_URL` `https://` bo‘lmasa yoki `COOKIE_SECURE=false` bo‘lsa, server ishga tushishdan bosh tortadi.

## 4. Nginx namunasi
```nginx
server {
  listen 443 ssl http2;
  server_name <domen>;
  client_max_body_size 25m;           # MAX_UPLOAD_MB dan biroz katta
  location / {
    proxy_pass http://127.0.0.1:4000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
server { listen 80; server_name <domen>; return 301 https://$host$request_uri; }
```

## 5. Jarayon boshqaruvi
`systemd` yoki `pm2` bilan `npm start` (ish papkasi — loyiha ildizi). Server SIGTERM’da to‘g‘ri to‘xtaydi. Salomatlik tekshiruvi: `GET /healthz`. **Scheduler** (rejalashtirilgan nashr) server jarayoni ichida ishlaydi — jarayon ishlab turishi shart; bir nechta nusxada ham material ikki marta nashr qilinmaydi.

## 6. Docker (sinalmagan)
`Dockerfile` va `docker-compose.yml` yozilgan, lekin bu muhitda Docker bo‘lmagani uchun ishga tushirib tekshirilmagan:
```bash
docker compose up -d --build
docker compose exec app npm run admin:create
```

## 7. Backup va tiklash
**Kunlik** (cron): `npm run db:backup -- /backups/$(date +%F)` — barcha jadvallar JSON + `uploads` nusxasi. Papkani serverdan tashqariga ko‘chiring (parol xeshlari bor).
Tiklash (bo‘sh yoki mavjud bazada, ma’lumotlar almashtiriladi):
```bash
npm run db:deploy
npm run db:restore -- /backups/2026-10-20 --yes
```
Qo‘shimcha (tavsiya): `pg_dump -Fc uchkoprik > db.dump` / `pg_restore -d uchkoprik db.dump` — bu muhitda `pg_dump` yo‘qligi sababli sinalmagan.
Tiklashni kamida oyiga bir marta alohida bazada mashq qiling.

## 8. Yangilash
`git pull && npm ci && npm run build && npm run db:deploy` → jarayonni qayta ishga tushiring.

## 9. Tekshiruv ro‘yxati
- [ ] HTTPS ishlaydi, HTTP → HTTPS yo‘naltiradi
- [ ] `curl -I https://<domen>/` da `strict-transport-security`, `content-security-policy` bor
- [ ] `/admin` login ishlaydi, `/api/v1/admin/pages` sessiyasiz 401
- [ ] `/sitemap.xml`, `/robots.txt` to‘g‘ri domenni ko‘rsatadi
- [ ] Backup cron va tiklash sinab ko‘rilgan
- [ ] PostgreSQL portiga internetdan kirib bo‘lmaydi

## Video yuklash uchun proxy sozlamasi
Nginx’da `client_max_body_size` ni `MAX_VIDEO_MB` dan katta qiling (masalan, `client_max_body_size 350m;`), `proxy_request_buffering off;` va `proxy_read_timeout 1800s;` tavsiya etiladi. Diskda video uchun yetarli joy ajrating (`UPLOAD_DIR/videos`); zaxira nusxa (`db:backup`) videolarni ham nusxalaydi, shuning uchun hajmi katta bo‘ladi.
