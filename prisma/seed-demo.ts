// DEMO ma'lumotlar: saytni ko'rgazmali qilish uchun. Bu HAQIQIY ma'lumot emas — matnlar, sanalar, nomlar va rasmlar namuna.
//   npm run db:seed:demo            — demo kontentni qo'shadi (avval `npm run db:seed` bajarilgan bo'lishi kerak)
//   npm run db:unseed:demo -- --yes — faqat shu skript qo'shgan demo kontentni olib tashlaydi
// Rasmlar lokal yaratiladi (internetdan yuklanmaydi). Real ma'lumotlarni admin paneldan kiriting.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_SETTINGS, type Locale } from '@uchkoprik/shared';
import { loadConfig } from '../server/src/config/env.ts';
import { ingestUpload, removeMediaFiles } from '../server/src/modules/media/media.service.ts';
import { illustration, logoImage, makePdf, portrait, type Motif } from './demo-assets.ts';

type L3 = Record<Locale, string>;
const prisma = new PrismaClient();
const config = loadConfig();
const MARK = '_demo';
const days = (n: number) => new Date(Date.now() - n * 86_400_000);
const fut = (n: number) => new Date(Date.now() + n * 86_400_000);
const p = (...paras: string[]) => paras.map((t) => `<p>${t}</p>`).join('');

// ───────────── Matnlar ─────────────

const PAGE_CONTENT: Record<string, L3> = {
  about: {
    uz: p('Uchko‘prik 1-sonli texnikumi — o‘rta maxsus kasb-hunar ta’limi muassasasi bo‘lib, yoshlarni zamonaviy kasblarga tayyorlaydi. Texnikumda nazariy bilim amaliy ko‘nikmalar bilan uyg‘unlashtiriladi.', 'Bu sahifa — namunaviy matn. Rasmiy ma’lumotlarni admin panelning “Sahifalar” bo‘limida kiriting.'),
    ru: p('Учкуприкский техникум № 1 — учреждение среднего специального профессионального образования, готовящее молодёжь к современным профессиям. Теоретические знания сочетаются с практическими навыками.', 'Эта страница содержит примерный текст. Официальные сведения вносятся в разделе «Страницы» админ-панели.'),
    en: p('Uchko‘prik Technical School No. 1 is a secondary vocational education institution that prepares young people for modern professions, combining theory with hands-on practice.', 'This page contains sample text. Enter official information in the “Pages” section of the admin panel.'),
  },
  history: {
    uz: p('Texnikum tarixi bo‘limi. Bu yerda muassasaning tashkil topishi, rivojlanish bosqichlari va muhim sanalari haqidagi tasdiqlangan ma’lumotlar joylashtiriladi.'),
    ru: p('Раздел об истории техникума. Здесь размещаются подтверждённые сведения об основании учреждения, этапах развития и важных датах.'),
    en: p('History section. Verified information about the founding, stages of development and key dates of the institution is published here.'),
  },
  mission: {
    uz: p('Texnikumning asosiy maqsadi — mehnat bozori talablariga javob beradigan malakali mutaxassislar tayyorlash.', 'Asosiy vazifalar:') + '<ul><li>sifatli kasbiy ta’lim berish;</li><li>talabalarni amaliyot orqali ish joyiga tayyorlash;</li><li>yoshlarda mas’uliyat va kasbiy axloqni shakllantirish.</li></ul>',
    ru: p('Основная цель техникума — подготовка квалифицированных специалистов, отвечающих требованиям рынка труда.', 'Основные задачи:') + '<ul><li>качественное профессиональное образование;</li><li>подготовка студентов к работе через практику;</li><li>формирование ответственности и профессиональной этики.</li></ul>',
    en: p('The main goal is to train qualified specialists who meet labour-market needs.', 'Key objectives:') + '<ul><li>high-quality vocational education;</li><li>preparing students for work through practice;</li><li>fostering responsibility and professional ethics.</li></ul>',
  },
  structure: {
    uz: p('Texnikum tuzilmasi: rahbariyat, o‘quv-ishlab chiqarish bo‘limi, kafedralar (sikllar), kutubxona va yordamchi xizmatlar.'),
    ru: p('Структура техникума: руководство, учебно-производственный отдел, предметные циклы, библиотека и вспомогательные службы.'),
    en: p('Structure: administration, academic and production department, subject departments, library and support services.'),
  },
  directions: {
    uz: p('Texnikum faoliyati ta’lim, tarbiya, amaliyot va ish beruvchilar bilan hamkorlik yo‘nalishlarida olib boriladi.'),
    ru: p('Деятельность техникума ведётся по направлениям: образование, воспитание, практика и сотрудничество с работодателями.'),
    en: p('The institution works in education, upbringing, practical training and cooperation with employers.'),
  },
  achievements: {
    uz: p('Amalga oshirilgan ishlar: o‘quv laboratoriyalarini yangilash, talabalar uchun ko‘rik-tanlovlar va ish beruvchilar bilan uchrashuvlar.'),
    ru: p('Выполненные работы: обновление учебных лабораторий, конкурсы для студентов и встречи с работодателями.'),
    en: p('Completed work: upgraded teaching laboratories, student competitions and meetings with employers.'),
  },
  'learning-process': {
    uz: p('O‘quv jarayoni o‘quv reja va dasturlar asosida tashkil etiladi. Nazariy mashg‘ulotlar laboratoriya va amaliy darslar bilan almashinadi.'),
    ru: p('Учебный процесс организуется на основе учебных планов и программ. Теоретические занятия чередуются с лабораторными и практическими.'),
    en: p('Studies follow approved curricula; lectures alternate with laboratory and practical classes.'),
  },
  practice: {
    uz: p('Talabalar ishlab chiqarish va xizmat ko‘rsatish korxonalarida amaliyot o‘taydi. Amaliyot shartnomalar asosida tashkil etiladi.'),
    ru: p('Студенты проходят практику на производственных и сервисных предприятиях на основании договоров.'),
    en: p('Students complete internships at production and service enterprises under cooperation agreements.'),
  },
  admission: {
    uz: p('Qabul shartlari va kerakli hujjatlar ro‘yxati shu sahifada e’lon qilinadi. Quyida qabul uchun zarur hujjatlarni yuklab olishingiz mumkin.', 'Namunaviy matn: aniq muddatlar, imtihon shartlari va talablarni admin panelning “Sahifalar” bo‘limida kiriting.') + '<h2>Qabul uchun odatda talab qilinadigan hujjatlar</h2><ul><li>ariza;</li><li>pasport yoki ID-karta nusxasi;</li><li>ta’lim to‘g‘risidagi hujjat (attestat) nusxasi;</li><li>tibbiy ma’lumotnoma;</li><li>fotosuratlar.</li></ul><p>Ro‘yxat namunaviy — haqiqiy talablar bilan almashtiring.</p>',
    ru: p('Условия приёма и список необходимых документов публикуются на этой странице. Ниже можно скачать документы для поступления.', 'Примерный текст: укажите точные сроки, условия экзаменов и требования в разделе «Страницы» админ-панели.') + '<h2>Документы, обычно необходимые для поступления</h2><ul><li>заявление;</li><li>копия паспорта или ID-карты;</li><li>копия документа об образовании (аттестата);</li><li>медицинская справка;</li><li>фотографии.</li></ul><p>Список примерный — замените его реальными требованиями.</p>',
    en: p('Admission requirements and the list of required documents are published on this page. You can download the application documents below.', 'Sample text: enter exact deadlines, exam conditions and requirements in the “Pages” section of the admin panel.') + '<h2>Documents usually required for admission</h2><ul><li>application form;</li><li>copy of passport or ID card;</li><li>copy of the education certificate;</li><li>medical certificate;</li><li>photographs.</li></ul><p>The list is a sample — replace it with the real requirements.</p>',
  },
  'privacy-policy': {
    uz: p('Maxfiylik siyosati: sayt tashrif buyuruvchilarning shaxsiy ma’lumotlarini to‘plamaydi va uchinchi shaxslarga bermaydi. Sayt faqat texnik ishlash uchun zarur cookie fayllaridan foydalanadi.'),
    ru: p('Политика конфиденциальности: сайт не собирает персональные данные посетителей и не передаёт их третьим лицам. Используются только технически необходимые cookie.'),
    en: p('Privacy policy: the site does not collect visitors’ personal data or share it with third parties. Only technically necessary cookies are used.'),
  },
};

interface NewsSeed {
  type: 'NEWS' | 'ANNOUNCEMENT' | 'EVENT';
  slug: string;
  cat?: 'news' | 'events' | 'sport';
  important?: boolean;
  age?: number;
  eventIn?: number;
  motif: Motif;
  title: L3;
  excerpt: L3;
  body: L3;
}

const NEWS: NewsSeed[] = [
  { type: 'NEWS', slug: 'yangi-oquv-yili', cat: 'news', age: 3, motif: 'building',
    title: { uz: 'Yangi o‘quv yili tantanali boshlandi', ru: 'Торжественно начался новый учебный год', en: 'The new academic year has begun' },
    excerpt: { uz: 'Talabalar va o‘qituvchilar yangi o‘quv yilini bayram tadbiri bilan kutib oldi.', ru: 'Студенты и преподаватели встретили новый учебный год праздничным мероприятием.', en: 'Students and teachers marked the start of the new academic year with a festive event.' },
    body: { uz: p('Texnikumda yangi o‘quv yili tantanali yig‘ilish bilan boshlandi. Birinchi kurs talabalari bilan tanishuv bo‘lib o‘tdi, o‘quv yilining asosiy vazifalari e’lon qilindi.', 'Bu — namunaviy yangilik matni.'), ru: p('В техникуме новый учебный год начался торжественной линейкой. Состоялось знакомство с первокурсниками, были озвучены основные задачи года.', 'Это примерный текст новости.'), en: p('The academic year opened with a ceremonial assembly. First-year students were welcomed and the main goals of the year were announced.', 'This is a sample news text.') } },
  { type: 'NEWS', slug: 'kasb-hunar-korik-tanlovi', cat: 'events', age: 9, motif: 'trophy',
    title: { uz: 'Kasb-hunar ko‘rik-tanlovi o‘tkazildi', ru: 'Прошёл конкурс профессионального мастерства', en: 'Vocational skills contest held' },
    excerpt: { uz: 'Talabalar o‘z kasbiy mahoratlarini namoyish etdi, g‘oliblar taqdirlandi.', ru: 'Студенты продемонстрировали мастерство, победители получили награды.', en: 'Students showed their skills and the winners were awarded.' },
    body: { uz: p('Ko‘rik-tanlovda turli yo‘nalishlar talabalari qatnashdi. Hakamlar hay’ati nazariy bilim va amaliy topshiriqlarni baholadi.'), ru: p('В конкурсе участвовали студенты разных направлений. Жюри оценивало теоретические знания и практические задания.'), en: p('Students from different programmes took part. The jury assessed theoretical knowledge and practical tasks.') } },
  { type: 'NEWS', slug: 'korxonalarda-amaliyot', cat: 'news', age: 15, motif: 'handshake',
    title: { uz: 'Talabalar korxonalarda amaliyot o‘tamoqda', ru: 'Студенты проходят практику на предприятиях', en: 'Students are doing internships at enterprises' },
    excerpt: { uz: 'Hamkor korxonalarda ishlab chiqarish amaliyoti boshlandi.', ru: 'У партнёров начата производственная практика.', en: 'Production internships have started at partner enterprises.' },
    body: { uz: p('Amaliyot davomida talabalar tajribali mutaxassislar rahbarligida kasbiy ko‘nikmalarini mustahkamlaydi.'), ru: p('В ходе практики студенты под руководством опытных специалистов закрепляют профессиональные навыки.'), en: p('During the internship students consolidate professional skills under experienced specialists.') } },
  { type: 'NEWS', slug: 'it-laboratoriya', cat: 'news', age: 22, motif: 'laptop',
    title: { uz: 'Axborot texnologiyalari laboratoriyasi yangilandi', ru: 'Обновлена лаборатория информационных технологий', en: 'The IT laboratory has been upgraded' },
    excerpt: { uz: 'Laboratoriya zamonaviy kompyuter jihozlari bilan to‘ldirildi.', ru: 'Лаборатория пополнена современным компьютерным оборудованием.', en: 'The laboratory received modern computer equipment.' },
    body: { uz: p('Yangilangan laboratoriyada talabalar dasturlash va tarmoq texnologiyalari bo‘yicha amaliy mashg‘ulotlar o‘tkazadi.'), ru: p('В обновлённой лаборатории студенты проводят практические занятия по программированию и сетевым технологиям.'), en: p('In the upgraded laboratory students hold practical classes in programming and networking.') } },
  { type: 'NEWS', slug: 'sport-musobaqalari', cat: 'sport', age: 30, motif: 'trophy',
    title: { uz: 'Sport musobaqalari g‘oliblari taqdirlandi', ru: 'Награждены победители спортивных соревнований', en: 'Sports competition winners awarded' },
    excerpt: { uz: 'Talabalar o‘rtasidagi sport musobaqalari yakunlandi.', ru: 'Завершились спортивные соревнования между студентами.', en: 'Inter-student sports competitions have concluded.' },
    body: { uz: p('Musobaqalar bir necha sport turlari bo‘yicha o‘tkazildi. Faol ishtirokchilar diplom va esdalik sovg‘alari bilan mukofotlandi.'), ru: p('Соревнования прошли по нескольким видам спорта. Активные участники награждены дипломами и памятными призами.'), en: p('Competitions were held in several sports. Active participants received diplomas and commemorative gifts.') } },
  { type: 'NEWS', slug: 'ota-onalar-yigilishi', cat: 'news', age: 40, motif: 'people',
    title: { uz: 'Ota-onalar yig‘ilishi bo‘lib o‘tdi', ru: 'Состоялось родительское собрание', en: 'Parents’ meeting took place' },
    excerpt: { uz: 'Ota-onalar o‘quv jarayoni va talabalar o‘zlashtirishi bilan tanishdi.', ru: 'Родители ознакомились с учебным процессом и успеваемостью.', en: 'Parents learned about the learning process and student progress.' },
    body: { uz: p('Yig‘ilishda o‘quv intizomi, amaliyot va kelgusi tadbirlar muhokama qilindi.'), ru: p('На собрании обсуждались учебная дисциплина, практика и предстоящие мероприятия.'), en: p('The meeting discussed academic discipline, internships and upcoming events.') } },
  { type: 'ANNOUNCEMENT', slug: 'qabul-hujjatlari', important: true, age: 1, motif: 'book',
    title: { uz: 'Qabul: hujjatlar qabuli boshlandi', ru: 'Приём: начат приём документов', en: 'Admissions: document submission is open' },
    excerpt: { uz: 'Abituriyentlar hujjatlarini belgilangan muddatda topshirishlari mumkin. Aniq muddatlar texnikumda e’lon qilinadi.', ru: 'Абитуриенты могут подать документы в установленные сроки. Точные сроки объявляются в техникуме.', en: 'Applicants can submit documents within the set period. Exact dates are announced by the institution.' },
    body: { uz: p('Qabul qoidalari va kerakli hujjatlar ro‘yxati bilan texnikum qabul komissiyasida tanishish mumkin.', 'Namunaviy e’lon: aniq sana va talablarni admin paneldan kiriting.'), ru: p('С правилами приёма и списком документов можно ознакомиться в приёмной комиссии техникума.', 'Примерное объявление: укажите точные даты и требования в админ-панели.'), en: p('Admission rules and the document list are available from the admissions committee.', 'Sample announcement: enter exact dates and requirements in the admin panel.') } },
  { type: 'ANNOUNCEMENT', slug: 'dars-jadvali-ozgardi', age: 5, motif: 'calendar',
    title: { uz: 'Dars jadvali o‘zgartirildi', ru: 'Изменено расписание занятий', en: 'Class schedule updated' },
    excerpt: { uz: 'Yangilangan dars jadvali bilan tanishib chiqing.', ru: 'Ознакомьтесь с обновлённым расписанием.', en: 'Please review the updated schedule.' },
    body: { uz: p('Dars jadvaliga kiritilgan o‘zgarishlar haqida talabalar guruh rahbarlari orqali xabardor qilinadi.'), ru: p('Об изменениях в расписании студентов информируют кураторы групп.'), en: p('Students are informed of schedule changes by their group tutors.') } },
  { type: 'EVENT', slug: 'ochiq-eshiklar-kuni', cat: 'events', eventIn: 14, age: 2, motif: 'calendar',
    title: { uz: 'Ochiq eshiklar kuni', ru: 'День открытых дверей', en: 'Open day' },
    excerpt: { uz: 'Abituriyentlar va ota-onalar uchun texnikum bilan tanishuv tadbiri.', ru: 'Знакомство с техникумом для абитуриентов и родителей.', en: 'An introduction to the institution for applicants and parents.' },
    body: { uz: p('Tadbir davomida yo‘nalishlar, laboratoriyalar va amaliyot imkoniyatlari bilan tanishish mumkin. Boshlanish vaqti namunaviy.'), ru: p('В ходе мероприятия можно познакомиться с направлениями, лабораториями и возможностями практики. Время начала примерное.'), en: p('Visitors can explore programmes, laboratories and internship opportunities. The start time is a sample.') } },
  { type: 'EVENT', slug: 'kasb-hunar-korgazmasi', cat: 'events', eventIn: 30, age: 4, motif: 'gear',
    title: { uz: 'Kasb-hunar ko‘rgazmasi', ru: 'Выставка профессий', en: 'Vocational exhibition' },
    excerpt: { uz: 'Talabalar ishlari va yangi texnologiyalar ko‘rgazmasi.', ru: 'Выставка студенческих работ и новых технологий.', en: 'An exhibition of student work and new technologies.' },
    body: { uz: p('Ko‘rgazmada talabalar o‘z loyihalari va amaliy ishlarini namoyish etadi.'), ru: p('На выставке студенты представят свои проекты и практические работы.'), en: p('Students will present their projects and practical work at the exhibition.') } },
];

const PROGRAMS = [
  { motif: 'laptop', title: { uz: 'Axborot texnologiyalari', ru: 'Информационные технологии', en: 'Information technology' }, summary: { uz: 'Dasturiy ta’minot va kompyuter tarmoqlari asoslari.', ru: 'Основы программного обеспечения и компьютерных сетей.', en: 'Software and computer networking fundamentals.' }, duration: { uz: '3 yil (namuna)', ru: '3 года (пример)', en: '3 years (sample)' }, qual: { uz: 'Texnik-dasturchi', ru: 'Техник-программист', en: 'Programmer technician' } },
  { motif: 'book', title: { uz: 'Buxgalteriya hisobi', ru: 'Бухгалтерский учёт', en: 'Accounting' }, summary: { uz: 'Moliyaviy hisob va soliq hisobi asoslari.', ru: 'Основы финансового и налогового учёта.', en: 'Fundamentals of financial and tax accounting.' }, duration: { uz: '2 yil 10 oy (namuna)', ru: '2 года 10 мес. (пример)', en: '2 years 10 months (sample)' }, qual: { uz: 'Buxgalter', ru: 'Бухгалтер', en: 'Accountant' } },
  { motif: 'gear', title: { uz: 'Elektr jihozlariga xizmat ko‘rsatish', ru: 'Обслуживание электрооборудования', en: 'Electrical equipment maintenance' }, summary: { uz: 'Elektr uskunalarini o‘rnatish va ta’mirlash.', ru: 'Монтаж и ремонт электрооборудования.', en: 'Installation and repair of electrical equipment.' }, duration: { uz: '3 yil (namuna)', ru: '3 года (пример)', en: '3 years (sample)' }, qual: { uz: 'Elektromontyor', ru: 'Электромонтёр', en: 'Electrician' } },
  { motif: 'building', title: { uz: 'Qurilish ishlari', ru: 'Строительные работы', en: 'Construction' }, summary: { uz: 'Bino va inshootlar qurilishi asoslari.', ru: 'Основы строительства зданий и сооружений.', en: 'Fundamentals of building construction.' }, duration: { uz: '3 yil (namuna)', ru: '3 года (пример)', en: '3 years (sample)' }, qual: { uz: 'Quruvchi-texnik', ru: 'Техник-строитель', en: 'Construction technician' } },
] as const;

const STAFF = [
  { kind: 'LEADERSHIP', init: 'D', pos: { uz: 'Texnikum direktori', ru: 'Директор техникума', en: 'Director' } },
  { kind: 'LEADERSHIP', init: 'O', pos: { uz: 'O‘quv ishlari bo‘yicha direktor o‘rinbosari', ru: 'Заместитель директора по учебной работе', en: 'Deputy Director for Academic Affairs' } },
  { kind: 'LEADERSHIP', init: 'M', pos: { uz: 'Ma’naviy-ma’rifiy ishlar bo‘yicha o‘rinbosar', ru: 'Заместитель по воспитательной работе', en: 'Deputy Director for Student Affairs' } },
  { kind: 'TEACHER', init: 'A', pos: { uz: 'Axborot texnologiyalari o‘qituvchisi', ru: 'Преподаватель информационных технологий', en: 'IT teacher' } },
  { kind: 'TEACHER', init: 'B', pos: { uz: 'Buxgalteriya hisobi o‘qituvchisi', ru: 'Преподаватель бухгалтерского учёта', en: 'Accounting teacher' } },
] as const;

const DOCS = [
  { type: 'CHARTER', number: '1', date: -400, title: { uz: 'Texnikum nizomi (namuna)', ru: 'Устав техникума (образец)', en: 'Charter (sample)' }, desc: { uz: 'Muassasa faoliyatining asosiy qoidalari.', ru: 'Основные положения деятельности учреждения.', en: 'Core rules of the institution.' } },
  { type: 'REGULATION', number: '12', date: -200, title: { uz: 'Ichki tartib qoidalari (namuna)', ru: 'Правила внутреннего распорядка (образец)', en: 'Internal regulations (sample)' }, desc: { uz: 'Talabalar va xodimlar uchun ichki tartib.', ru: 'Внутренний распорядок для студентов и сотрудников.', en: 'Internal rules for students and staff.' } },
  { type: 'PLAN', number: '5', date: -120, title: { uz: 'Yillik ish rejasi (namuna)', ru: 'Годовой план работы (образец)', en: 'Annual work plan (sample)' }, desc: { uz: 'O‘quv yili uchun tasdiqlangan reja.', ru: 'Утверждённый план на учебный год.', en: 'Approved plan for the academic year.' } },
  { type: 'REPORT', number: '8', date: -60, title: { uz: 'Faoliyat hisoboti (namuna)', ru: 'Отчёт о деятельности (образец)', en: 'Activity report (sample)' }, desc: { uz: 'Yil davomidagi faoliyat natijalari.', ru: 'Итоги деятельности за год.', en: 'Results of the year’s activity.' } },
  { type: 'OPEN_DATA', number: '', date: -30, title: { uz: 'Ochiq ma’lumotlar to‘plami (namuna)', ru: 'Набор открытых данных (образец)', en: 'Open dataset (sample)' }, desc: { uz: 'Ommaga ochiq statistik ma’lumotlar.', ru: 'Открытые статистические данные.', en: 'Publicly available statistics.' } },
  { type: 'ADMISSION', number: '', date: -20, title: { uz: 'Qabul qoidalari (namuna)', ru: 'Правила приёма (образец)', en: 'Admission rules (sample)' }, desc: { uz: 'Qabul tartibi va muddatlari.', ru: 'Порядок и сроки приёма.', en: 'Admission procedure and deadlines.' } },
  { type: 'ADMISSION', number: '', date: -19, title: { uz: 'Ariza shakli (namuna)', ru: 'Форма заявления (образец)', en: 'Application form (sample)' }, desc: { uz: 'To‘ldirish uchun ariza blankasi.', ru: 'Бланк заявления для заполнения.', en: 'Application form to fill in.' } },
  { type: 'ANTICORRUPTION', number: '3', date: -90, title: { uz: 'Korrupsiyaga qarshi kurashish dasturi (namuna)', ru: 'Программа противодействия коррупции (образец)', en: 'Anti-corruption programme (sample)' }, desc: { uz: 'Korrupsiyaning oldini olish chora-tadbirlari.', ru: 'Меры по предупреждению коррупции.', en: 'Corruption prevention measures.' } },
] as const;

// ───────────── Yordamchilar ─────────────

const tr3 = <T,>(f: (l: Locale) => T) => (['uz', 'ru', 'en'] as const).map((l) => ({ l, v: f(l) }));
const created: Record<string, string[]> = { media: [], news: [], documents: [], categories: [], programs: [], staff: [], pages: [], alumni: [], partners: [] };

async function upload(buffer: Buffer, name: string, opts: { gallery?: boolean; alt?: L3; caption?: L3 } = {}) {
  const { media } = await ingestUpload(config, { buffer, originalname: name, size: buffer.length }, 'demo-seed');
  created.media!.push(media.id);
  if (opts.alt || opts.gallery) {
    await prisma.media.update({ where: { id: media.id }, data: { showInGallery: opts.gallery ?? false } });
    for (const { l, v } of tr3((x) => ({ alt: opts.alt?.[x] ?? '', caption: opts.caption?.[x] ?? '' }))) {
      await prisma.mediaTranslation.create({ data: { mediaId: media.id, locale: l, alt: v.alt, caption: v.caption } });
    }
  }
  return media.id;
}

async function main() {
  if (await prisma.siteSetting.findUnique({ where: { key: MARK } })) {
    console.log('Demo ma’lumotlar allaqachon qo‘shilgan. Avval `npm run db:unseed:demo -- --yes` ni bajaring.');
    return;
  }
  if ((await prisma.page.count()) === 0) throw new Error('Avval `npm run db:seed` ni bajaring (sayt tuzilmasi kerak).');

  console.log('Rasmlar yaratilmoqda…');
  const logoId = await upload(await logoImage(), 'logo.png', { alt: { uz: 'Texnikum logotipi (namuna)', ru: 'Логотип техникума (образец)', en: 'Logo (sample)' } });

  // Bannerlar
  const bannerData = [
    { motif: 'building' as Motif, title: { uz: 'Zamonaviy kasblar — kelajak poydevori', ru: 'Современные профессии — основа будущего', en: 'Modern professions build the future' }, text: { uz: 'Nazariya va amaliyot uyg‘unligi', ru: 'Сочетание теории и практики', en: 'Theory meets practice' } },
    { motif: 'laptop' as Motif, title: { uz: 'Qabul: yangi o‘quv yili uchun', ru: 'Приём на новый учебный год', en: 'Admissions for the new academic year' }, text: { uz: 'Yo‘nalishlar bilan tanishing', ru: 'Познакомьтесь с направлениями', en: 'Explore our programmes' } },
    { motif: 'handshake' as Motif, title: { uz: 'Ish beruvchilar bilan hamkorlik', ru: 'Сотрудничество с работодателями', en: 'Partnership with employers' }, text: { uz: 'Amaliyot va ish o‘rinlari', ru: 'Практика и рабочие места', en: 'Internships and jobs' } },
  ];
  const banners = [];
  for (const [i, b] of bannerData.entries()) {
    const id = await upload(await illustration({ width: 1600, height: 600, motif: b.motif, palette: i }), `banner-${i + 1}.png`, { alt: b.title });
    banners.push({ id: `demo-banner-${i + 1}`, imageMediaId: id, title: b.title, text: b.text, linkUrl: i === 1 ? '/uz/programs' : '', isActive: true });
  }

  // Kategoriyalar
  const catDefs = [
    { key: 'news', scope: 'NEWS', name: { uz: 'Yangiliklar', ru: 'Новости', en: 'News' }, slug: { uz: 'yangiliklar', ru: 'novosti', en: 'news-cat' } },
    { key: 'events', scope: 'NEWS', name: { uz: 'Tadbirlar', ru: 'События', en: 'Events' }, slug: { uz: 'tadbirlar', ru: 'sobytiya', en: 'events-cat' } },
    { key: 'sport', scope: 'NEWS', name: { uz: 'Sport', ru: 'Спорт', en: 'Sport' }, slug: { uz: 'sport', ru: 'sport', en: 'sport' } },
    { key: 'docs', scope: 'DOCUMENT', name: { uz: 'Asosiy hujjatlar', ru: 'Основные документы', en: 'Core documents' }, slug: { uz: 'asosiy-hujjatlar', ru: 'osnovnye-dokumenty', en: 'core-documents' } },
  ] as const;
  const cats: Record<string, string> = {};
  for (const [i, c] of catDefs.entries()) {
    const row = await prisma.category.create({
      data: { scope: c.scope, sortOrder: i, translations: { create: tr3((l) => l).map(({ l }) => ({ locale: l, name: c.name[l], slug: c.slug[l] })) } },
    });
    cats[c.key] = row.id;
    created.categories!.push(row.id);
  }

  // Yangiliklar
  console.log('Yangiliklar qo‘shilmoqda…');
  for (const [i, n] of NEWS.entries()) {
    const cover = await upload(await illustration({ width: 1200, height: 675, motif: n.motif, palette: i, title: n.title.uz }), `${n.slug}.png`, { alt: n.title });
    const row = await prisma.news.create({
      data: {
        type: n.type, status: 'PUBLISHED', isImportant: Boolean(n.important), coverMediaId: cover,
        categoryId: n.cat ? cats[n.cat] : null,
        publishedAt: days(n.age ?? i), eventAt: n.eventIn ? fut(n.eventIn) : null,
        translations: { create: tr3((l) => l).map(({ l }) => ({ locale: l, title: n.title[l], slug: `${n.slug}${l === 'uz' ? '' : `-${l}`}`, excerpt: n.excerpt[l], content: n.body[l] })) },
      },
    });
    created.news!.push(row.id);
  }

  // Galereya
  const gallery: [string, Motif, L3][] = [
    ['gallery-1', 'building', { uz: 'Texnikum binosi (namuna)', ru: 'Здание техникума (образец)', en: 'Main building (sample)' }],
    ['gallery-2', 'laptop', { uz: 'Kompyuter laboratoriyasi (namuna)', ru: 'Компьютерная лаборатория (образец)', en: 'Computer lab (sample)' }],
    ['gallery-3', 'gear', { uz: 'Amaliy mashg‘ulot (namuna)', ru: 'Практическое занятие (образец)', en: 'Practical class (sample)' }],
    ['gallery-4', 'trophy', { uz: 'Musobaqa g‘oliblari (namuna)', ru: 'Победители соревнований (образец)', en: 'Contest winners (sample)' }],
    ['gallery-5', 'people', { uz: 'Talabalar hayoti (namuna)', ru: 'Студенческая жизнь (образец)', en: 'Student life (sample)' }],
    ['gallery-6', 'book', { uz: 'Kutubxona (namuna)', ru: 'Библиотека (образец)', en: 'Library (sample)' }],
  ];
  for (const [i, [name, motif, cap]] of gallery.entries()) {
    await upload(await illustration({ width: 1200, height: 900, motif, palette: i + 1, title: cap.uz }), `${name}.png`, { gallery: true, alt: cap, caption: cap });
  }

  // Yo'nalishlar
  for (const [i, pr] of PROGRAMS.entries()) {
    const row = await prisma.educationProgram.create({
      data: {
        status: 'PUBLISHED', sortOrder: i, publishedAt: new Date(),
        translations: { create: tr3((l) => l).map(({ l }) => ({ locale: l, title: pr.title[l], summary: pr.summary[l], duration: pr.duration[l], qualification: pr.qual[l], description: p(pr.summary[l]) })) },
      },
    });
    created.programs!.push(row.id);
  }

  // Bitiruvchilar va hamkor korxonalar (nomlar ataylab namunaviy)
  const alumniSample = [
    { year: 2022, init: 'B', program: { uz: 'Axborot texnologiyalari', ru: 'Информационные технологии', en: 'Information technology' }, work: { uz: 'IT-kompaniya, dasturchi (namuna)', ru: 'IT-компания, программист (образец)', en: 'IT company, developer (sample)' }, story: { uz: 'Texnikumda olgan amaliy bilimlar ishga joylashishda yordam berdi. (Namunaviy fikr.)', ru: 'Практические знания, полученные в техникуме, помогли с трудоустройством. (Примерный отзыв.)', en: 'The practical skills gained at the college helped me find a job. (Sample testimonial.)' } },
    { year: 2021, init: 'T', program: { uz: 'Buxgalteriya hisobi', ru: 'Бухгалтерский учёт', en: 'Accounting' }, work: { uz: 'Xususiy korxona, buxgalter (namuna)', ru: 'Частное предприятие, бухгалтер (образец)', en: 'Private company, accountant (sample)' }, story: { uz: '', ru: '', en: '' } },
    { year: 2020, init: 'S', program: { uz: 'Qurilish ishlari', ru: 'Строительные работы', en: 'Construction' }, work: { uz: 'Qurilish tashkiloti, usta (namuna)', ru: 'Строительная организация, мастер (образец)', en: 'Construction firm, foreman (sample)' }, story: { uz: '', ru: '', en: '' } },
  ];
  const alumniName = { uz: 'Familiya Ism (namuna)', ru: 'Фамилия Имя (образец)', en: 'Full Name (sample)' };
  for (const [i, a] of alumniSample.entries()) {
    const photo = await upload(await portrait(a.init, i + 2), `alumni-${i + 1}.png`, { alt: alumniName });
    const row = await prisma.alumnus.create({
      data: {
        graduationYear: a.year, status: 'PUBLISHED', sortOrder: i, photoMediaId: photo,
        translations: { create: tr3((l) => l).map(({ l }) => ({ locale: l, fullName: alumniName[l], program: a.program[l], workplace: a.work[l], story: a.story[l] })) },
      },
    });
    created.alumni!.push(row.id);
  }
  const partnerSample = [
    { init: 'A', motif: 'laptop' as Motif, name: { uz: 'Hamkor korxona A (namuna)', ru: 'Предприятие-партнёр A (образец)', en: 'Partner company A (sample)' } },
    { init: 'B', motif: 'gear' as Motif, name: { uz: 'Hamkor korxona B (namuna)', ru: 'Предприятие-партнёр B (образец)', en: 'Partner company B (sample)' } },
    { init: 'C', motif: 'building' as Motif, name: { uz: 'Hamkor korxona C (namuna)', ru: 'Предприятие-партнёр C (образец)', en: 'Partner company C (sample)' } },
    { init: 'D', motif: 'handshake' as Motif, name: { uz: 'Hamkor korxona D (namuna)', ru: 'Предприятие-партнёр D (образец)', en: 'Partner company D (sample)' } },
  ];
  for (const [i, pt] of partnerSample.entries()) {
    const logo = await upload(await illustration({ width: 400, height: 240, motif: pt.motif, palette: i }), `partner-${i + 1}.png`, { alt: pt.name });
    const row = await prisma.partner.create({
      data: {
        status: 'PUBLISHED', sortOrder: i, logoMediaId: logo,
        translations: { create: tr3((l) => l).map(({ l }) => ({ locale: l, name: pt.name[l], description: { uz: 'Amaliyot va ishga joylashtirishda hamkor (namuna).', ru: 'Партнёр по практике и трудоустройству (образец).', en: 'Partner for internships and employment (sample).' }[l] })) },
      },
    });
    created.partners!.push(row.id);
  }

  // Xodimlar (ismlar ataylab namunaviy)
  const sample = { uz: 'Familiya Ism (namuna)', ru: 'Фамилия Имя (образец)', en: 'Full Name (sample)' };
  for (const [i, s] of STAFF.entries()) {
    const photo = await upload(await portrait(s.init, i), `staff-${i + 1}.png`, { alt: sample });
    const row = await prisma.staff.create({
      data: {
        kind: s.kind, status: 'PUBLISHED', sortOrder: i, photoMediaId: photo,
        translations: { create: tr3((l) => l).map(({ l }) => ({ locale: l, fullName: sample[l], position: s.pos[l], bio: '' })) },
      },
    });
    created.staff!.push(row.id);
  }

  // Hujjatlar (haqiqiy PDF fayllar)
  console.log('Hujjatlar qo‘shilmoqda…');
  for (const [i, d] of DOCS.entries()) {
    const pdf = makePdf(d.title.uz, ['DEMO document - sample content only.', 'Replace with the real approved document in the admin panel.', `Type: ${d.type}`, `Number: ${d.number || '-'}`]);
    const fileId = await upload(pdf, `demo-hujjat-${i + 1}.pdf`);
    const row = await prisma.document.create({
      data: {
        type: d.type, status: 'PUBLISHED', fileMediaId: fileId, number: d.number || null, docDate: days(-d.date), publishedAt: new Date(),
        categoryId: i < 2 ? cats.docs : null,
        translations: { create: tr3((l) => l).map(({ l }) => ({ locale: l, title: d.title[l], description: d.desc[l] })) },
      },
    });
    created.documents!.push(row.id);
  }

  // Sahifa matnlari
  for (const [slug, content] of Object.entries(PAGE_CONTENT)) {
    if ((await prisma.pageTranslation.count({ where: { slug, content: '' } })) === 0) continue;
    for (const l of ['uz', 'ru', 'en'] as const) await prisma.pageTranslation.updateMany({ where: { slug, locale: l, content: '' }, data: { content: content[l] } });
    created.pages!.push(slug);
  }

  // Sozlamalar: faqat hali to'ldirilmagan guruhlar
  const existing = new Map((await prisma.siteSetting.findMany()).map((r) => [r.key, JSON.stringify(r.value)]));
  const wanted: Record<string, unknown> = {
    general: { officialName: { uz: 'Uchko‘prik 1-sonli texnikumi', ru: 'Учкуприкский техникум № 1', en: 'Uchko‘prik Technical School No. 1' }, shortName: { uz: 'Uchko‘prik 1-texnikum', ru: 'Учкуприк техникум № 1', en: 'Uchko‘prik TS-1' }, logoMediaId: logoId },
    topBar: { isActive: true, text: { uz: 'Qabul: hujjatlar qabuli boshlandi', ru: 'Приём: начат приём документов', en: 'Admissions: document submission is open' }, linkUrl: '/uz/announcements' },
    contacts: { address: { uz: 'Farg‘ona viloyati, Uchko‘prik tumani (namunaviy manzil — haqiqiyini kiriting)', ru: 'Ферганская область, Учкуприкский район (примерный адрес — укажите настоящий)', en: 'Fergana region, Uchko‘prik district (sample address — enter the real one)' }, phones: ['+998 00 000 00 00'], email: 'info@example.uz', workingHours: { uz: 'Dushanba–Juma: 09:00–18:00', ru: 'Пн–Пт: 09:00–18:00', en: 'Mon–Fri: 09:00–18:00' }, mapUrl: '' },
    footer: { text: { uz: 'Rasmiy axborot portali. Ma’lumotlar namunaviy.', ru: 'Официальный информационный портал. Данные примерные.', en: 'Official information portal. Data shown is sample content.' } },
    seo: { defaultTitle: { uz: 'Uchko‘prik 1-sonli texnikumi — rasmiy sayt', ru: 'Учкуприкский техникум № 1 — официальный сайт', en: 'Uchko‘prik Technical School No. 1 — official website' }, defaultDescription: { uz: 'Uchko‘prik 1-sonli texnikumining rasmiy veb-portali: yangiliklar, hujjatlar, ta’lim yo‘nalishlari.', ru: 'Официальный портал техникума: новости, документы, направления обучения.', en: 'Official portal: news, documents and study programmes.' }, ogImageMediaId: null },
    homeAbout: { title: { uz: 'Texnikum haqida', ru: 'О техникуме', en: 'About the college' }, text: { uz: 'Texnikum yoshlarni zamonaviy kasblarga tayyorlaydi: nazariy bilim amaliy ko‘nikmalar bilan uyg‘unlashtiriladi.', ru: 'Техникум готовит молодёжь к современным профессиям, сочетая теорию с практикой.', en: 'The college prepares young people for modern professions, combining theory with practice.' }, pageId: (await prisma.pageTranslation.findFirst({ where: { slug: 'about', locale: 'uz' } }))?.pageId ?? null },
    banners,
    usefulLinks: [
      { id: 'demo-link-1', label: { uz: 'O‘zbekiston Respublikasi hukumat portali', ru: 'Правительственный портал РУз', en: 'Government portal of Uzbekistan' }, url: 'https://gov.uz' },
      { id: 'demo-link-2', label: { uz: 'Milliy qonunchilik ma’lumotlari bazasi', ru: 'Национальная база законодательства', en: 'National legislation database' }, url: 'https://lex.uz' },
      { id: 'demo-link-3', label: { uz: 'Oliy ta’lim, fan va innovatsiyalar vazirligi', ru: 'Министерство высшего образования, науки и инноваций', en: 'Ministry of Higher Education, Science and Innovation' }, url: 'https://edu.uz' },
      { id: 'demo-link-4', label: { uz: 'Maktabgacha va maktab ta’limi vazirligi', ru: 'Министерство дошкольного и школьного образования', en: 'Ministry of Preschool and School Education' }, url: 'https://uzedu.uz' },
    ],
  };
  const applied: string[] = [];
  for (const [key, value] of Object.entries(wanted)) {
    const cur = existing.get(key);
    const def = JSON.stringify((DEFAULT_SETTINGS as unknown as Record<string, unknown>)[key]);
    if (cur && cur !== def) continue; // foydalanuvchi allaqachon to'ldirgan
    await prisma.siteSetting.upsert({ where: { key }, create: { key, value: value as never }, update: { value: value as never } });
    applied.push(key);
  }

  await prisma.siteSetting.create({ data: { key: MARK, value: { ...created, settings: applied } as never } });
  console.log(`Tayyor: ${created.news!.length} ta yangilik/e’lon/tadbir, ${created.documents!.length} ta hujjat, ${created.alumni!.length} ta bitiruvchi, ${created.partners!.length} ta hamkor, ${created.programs!.length} ta yo‘nalish, ${created.staff!.length} ta xodim, ${created.media!.length} ta fayl, ${created.pages!.length} ta sahifa matni.`);
  console.log('Sozlamalar to‘ldirildi:', applied.join(', '));
}

async function unseed() {
  if (!process.argv.includes('--yes')) {
    console.error('Bu buyruq demo kontentni o‘chiradi. Tasdiqlash: npm run db:unseed:demo -- --yes');
    process.exitCode = 1;
    return;
  }
  const row = await prisma.siteSetting.findUnique({ where: { key: MARK } });
  if (!row) return void console.log('Demo ma’lumotlar topilmadi.');
  const d = row.value as unknown as Record<string, string[]>;
  await prisma.news.deleteMany({ where: { id: { in: d.news ?? [] } } });
  await prisma.document.deleteMany({ where: { id: { in: d.documents ?? [] } } });
  await prisma.educationProgram.deleteMany({ where: { id: { in: d.programs ?? [] } } });
  await prisma.staff.deleteMany({ where: { id: { in: d.staff ?? [] } } });
  await prisma.category.deleteMany({ where: { id: { in: d.categories ?? [] } } });
  await prisma.alumnus.deleteMany({ where: { id: { in: d.alumni ?? [] } } });
  await prisma.partner.deleteMany({ where: { id: { in: d.partners ?? [] } } });
  for (const key of d.settings ?? []) {
    const value = (DEFAULT_SETTINGS as unknown as Record<string, unknown>)[key] as never;
    await prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
  }
  for (const slug of d.pages ?? []) await prisma.pageTranslation.updateMany({ where: { slug }, data: { content: '' } });
  const media = await prisma.media.findMany({ where: { id: { in: d.media ?? [] } } });
  await prisma.media.deleteMany({ where: { id: { in: media.map((m) => m.id) } } });
  for (const m of media) await removeMediaFiles(config, m);
  await prisma.siteSetting.delete({ where: { key: MARK } });
  console.log('Demo ma’lumotlar o‘chirildi.');
}

(process.argv.includes('--unseed') ? unseed() : main())
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
