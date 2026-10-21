# Administrator qo‘llanmasi

Kirish: `https://<domen>/admin`. Sessiya 12 soat; chiqish — yuqori o‘ngdagi “Chiqish”.

## Asosiy tushunchalar
- **Qoralama / Nashr qilingan / Arxivlangan.** Faqat “Nashr qilingan” ommaviy saytda ko‘rinadi. Nashr qilingan materialni tahrirlab saqlasangiz, o‘zgarish darhol saytda chiqadi.
- **Uch til.** Har bir materialda O‘zbekcha (majburiy), Русский va English (ixtiyoriy) varaqlari bor. Tarjima yo‘q tilda sayt o‘zbekcha matnni ko‘rsatadi va “asl til” haqida ogohlantiradi. Tarjimalar **avtomatik yaratilmaydi**: rasmiy matnni o‘zingiz kiriting va tekshiring. Holat — “Uch tilli tarjimalar” bo‘limida.
- **Slug** — manzil qismi (`/uz/<slug>`). Har til uchun alohida; shu tilda takrorlanmaydi; “Sehrli tayoqcha” tugmasi sarlavhadan yaratadi.

## Sahifalar
Sahifalar → “Yangi sahifa”. **Ota sahifa** — bo‘lim ierarxiyasi (yo‘l ko‘rsatkichi va “Bo‘lim” shabloni uchun). **Shablon:** Oddiy / Bo‘lim (ichki sahifalar kartochkalari) / Hujjatlar (tanlangan turdagi hujjatlar ro‘yxati) / Xodimlar (rahbariyat yoki o‘qituvchilar) / Yo‘nalishlar. “Versiyalar tarixi”dan oldingi holatni tiklash mumkin. “Oldindan ko‘rish” — qoralamani ham ko‘rsatadi (faqat administratorga).

## Yangiliklar, e’lonlar, tadbirlar
Bir xil muharrir; “Turi” maydoni bilan ajratiladi. **Muhim** belgisi bosh sahifadagi “Muhim e’lonlar”da chiqaradi. **Rejalashtirilgan nashr:** kelajak sanani kiriting va “Rejalashtirib saqlash” bosing — server o‘sha vaqtda o‘zi nashr qiladi.

## Hujjatlar va media
Hujjatlar → “Yangi hujjat” → fayl tanlang yoki shu yerning o‘zida yuklang (PDF, DOCX, XLSX, PPTX; rasmlar JPG/PNG/WEBP; hajm ≤ 20 MB). Media kutubxonasida rasmga **alt matn** (uch tilda) kiriting — ko‘zi ojizlar va SEO uchun muhim. Ishlatilayotgan fayl o‘chirilmaydi (kontentdagi rasm faqat tasdiq bilan).

## Menyu
Menyu boshqaruvi: band qo‘shish (sahifa / saytning tayyor bo‘limi / tashqi havola), tartib — o‘q tugmalari, ichki band — “ichiga kiritish”. **Saqlash** bosilmaguncha sayt o‘zgarmaydi. Qoralama sahifaga bog‘langan band saytda ko‘rinmaydi.

## Sozlamalar
- **Sayt sozlamalari**: rasmiy nom, logotip, manzil, telefonlar, ish vaqti, ijtimoiy tarmoqlar, footer, foydali havolalar, SEO.
- **Bosh sahifa sozlamalari**: yuqori axborot paneli, bannerlar, “Texnikum haqida” qisqa bloki.
Faqat haqiqiy, tasdiqlangan ma’lumot kiriting: bo‘sh qolgan bo‘limlar saytda “hali kiritilmagan” deb halol ko‘rsatiladi.

## Xavfsizlik
Parolni “Hisob va parol”da almashtiring (≥ 12 belgi). Parol unutilsa, server administratori `npm run admin:create -- --reset` ni ishga tushiradi. Barcha amallar “Audit jurnali”da qayd etiladi.

## Yangi bo‘limlar
- **Videogalereya**: “Videogalereya” → “Yangi video”. Ikki usul: **Fayl yuklash** (kompyuterdan yoki telefondan MP4/MOV/WebM; telefonda “Kamerada yozish” tugmasi ham bor) yoki **Havola** (YouTube/Vimeo). Yuklash jarayoni foizda ko‘rinadi; tugagach “Saqlash”ni bosing. Hajm chegarasi serverda `MAX_VIDEO_MB` (standart 300 MB). Telefon videolari uchun: iPhone’da “Sozlamalar → Kamera → Formatlar → Eng mos” (H.264) tanlang, aks holda ba’zi brauzerlarda ijro etilmasligi mumkin. Ko‘rsatkich rasm ixtiyoriy (yuklangan videoda berilmasa, oddiy fon ko‘rinadi). Saqlanmay qolgan yuklashlar 24 soatdan keyin avtomatik o‘chadi. Video bosilgandagina yuklanadi.
- **Bitiruvchilar** va **Hamkor korxonalar**: tegishli bo‘limda yozuv yarating (tillar, foto/logotip), so‘ng “Nashr qilish”. Bitiruvchi ma’lumotlarini uning roziligi bilan kiriting.
- **Qabul**: “Sahifalar → Qabul” sahifasiga qabul shartlarini yozing; “Hujjatlar”da turi “Qabul hujjati” bo‘lgan fayllar o‘sha sahifada ro‘yxat bo‘ladi.
- **“Raqamlarda”**: Bosh sahifa sozlamalari → ko‘rsatkichlar (faqat haqiqiy raqamlar).
- **Statistika va hisobotlar**: ko‘rishlar grafigi, eng ko‘p ko‘rilgan sahifalar; “CSV” tugmalari Excel’da ochiladigan hisobotlarni yuklaydi.

## Rollar
| Rol | Nima qila oladi |
|---|---|
| Administrator | Hamma narsa: foydalanuvchilar, modullar, sozlamalar, menyu, audit |
| Bosh muharrir | Kontent yaratish/tahrirlash, **nashr qilish**, o‘chirish, media, statistika va hisobotlar |
| Muharrir | Qoralama yaratish/tahrirlash, media yuklash. Nashr qila olmaydi; nashr qilingan materialni tahrirlay olmaydi |

Foydalanuvchini “Foydalanuvchilar va rollar” bo‘limida yarating (parolni unga xavfsiz yo‘l bilan bering). Faolsizlantirilgan yoki roli o‘zgargan foydalanuvchi darhol tizimdan chiqariladi.

## Modullar (funksiyalarni yoqish/o‘chirish)
“Modullar” sahifasida har bir funksiya alohida yoqiladi/o‘chiriladi. Hozir **o‘chirilgan** (kerak bo‘lsa yoqing): sayt ichida qidiruv, foydali havolalar, ochiqlik va shaffoflik, faoliyat bo‘limi, o‘qituvchilar ro‘yxati, tarjimalar holati sahifasi. O‘chirish ma’lumotlarni o‘chirmaydi — faqat yashiradi.
