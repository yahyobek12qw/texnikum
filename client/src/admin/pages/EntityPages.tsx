import {
  alumnusCreateSchema, alumnusUpdateSchema, partnerCreateSchema, partnerUpdateSchema, videoCreateSchema, videoUpdateSchema,
  type AdminAlumnus, type AdminPartner, type AdminVideo,
} from '@uchkoprik/shared';
import { Alert } from '../../components/ui/Feedback';
import { alumniApi, partnersApi, videosApi } from '../api';
import { EntityManager, type EntityConfig } from '../components/EntityManager';
import { VideoSourceField } from '../components/VideoSourceField';

const formatSize = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const num = (v: unknown) => (v === '' || v === null || v === undefined ? 0 : Number(v) || 0);
const nullableNum = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v));
const str = (v: unknown) => String(v ?? '').trim();

const videoConfig: EntityConfig<AdminVideo> = {
  title: 'Videogalereya',
  noun: 'Video',
  addLabel: 'Yangi video',
  emptyTitle: 'Hozircha videolar qo‘shilmagan',
  emptyText: 'Video faylni kompyuter yoki telefondan yuklang, yoki YouTube/Vimeo havolasini qo‘shing.',
  api: videosApi,
  createSchema: videoCreateSchema,
  updateSchema: videoUpdateSchema,
  base: [
    { name: 'sourceUrl', label: 'Video', type: 'custom', render: ({ form, item, error }) => <VideoSourceField form={form} item={item as AdminVideo | null} error={error} /> },
    { name: 'thumbMediaId', label: 'Ko‘rsatkich rasmi (ixtiyoriy)', type: 'media', hint: 'Bo‘sh qolsa, YouTube videolarida YouTube’ning o‘z rasmi ishlatiladi; yuklangan videoda esa oddiy fon ko‘rinadi' },
    { name: 'sortOrder', label: 'Tartib raqami', type: 'number' },
  ],
  trFields: [
    { name: 'title', label: 'Sarlavha', type: 'text' },
    { name: 'description', label: 'Qisqa tavsif', type: 'textarea' },
  ],
  toBase: (i) => ({ sourceUrl: i?.provider === 'UPLOAD' ? '' : (i?.sourceUrl ?? ''), fileMediaId: i?.file?.id ?? null, thumbMediaId: i?.thumb?.id ?? null, sortOrder: i?.sortOrder ?? 0 }),
  fromBase: (v) => {
    const url = str(v.sourceUrl);
    const file = (v.fileMediaId as string | null) ?? null;
    // Aynan bitta manba yuboriladi: havola kiritilgan bo'lsa u, aks holda yuklangan fayl
    return { ...(url ? { sourceUrl: url } : file ? { fileMediaId: file } : { sourceUrl: '' }), thumbMediaId: (v.thumbMediaId as string | null) ?? null, sortOrder: num(v.sortOrder) };
  },
  mediaInitial: (i) => i?.thumb,
  subtitle: (i) => (
    <p className="text-xs text-muted">
      {i.provider === 'UPLOAD' ? `Yuklangan fayl · ${i.file?.originalName ?? ''} · ${formatSize(i.file?.size ?? 0)}` : `${i.provider === 'YOUTUBE' ? 'YouTube' : 'Vimeo'} · ${i.externalId}`}
    </p>
  ),
};

const alumniConfig: EntityConfig<AdminAlumnus> = {
  title: 'Bitiruvchilar',
  noun: 'Bitiruvchi',
  addLabel: 'Yangi bitiruvchi',
  emptyTitle: 'Hozircha bitiruvchilar kiritilmagan',
  emptyText: 'Faqat o‘zi roziligi bilan va haqiqiy ma’lumotlarni kiriting.',
  api: alumniApi,
  createSchema: alumnusCreateSchema,
  updateSchema: alumnusUpdateSchema,
  base: [
    { name: 'graduationYear', label: 'Bitirgan yili', type: 'number', placeholder: '2022' },
    { name: 'sortOrder', label: 'Tartib raqami', type: 'number' },
    { name: 'photoMediaId', label: 'Fotosurat', type: 'media' },
  ],
  trFields: [
    { name: 'fullName', label: 'F.I.Sh.', type: 'text' },
    { name: 'program', label: 'Mutaxassisligi', type: 'text' },
    { name: 'workplace', label: 'Hozirgi ish joyi va lavozimi', type: 'text' },
    { name: 'story', label: 'Qisqa hikoya yoki fikr', type: 'textarea' },
  ],
  toBase: (i) => ({ graduationYear: i?.graduationYear ?? '', sortOrder: i?.sortOrder ?? 0, photoMediaId: i?.photo?.id ?? null }),
  fromBase: (v) => ({ graduationYear: nullableNum(v.graduationYear), sortOrder: num(v.sortOrder), photoMediaId: (v.photoMediaId as string | null) ?? null }),
  mediaInitial: (i) => i?.photo,
  subtitle: (i) => <p className="text-xs text-muted">{i.graduationYear ? `${i.graduationYear}-yil bitiruvchisi` : ''}{i.translations.uz?.workplace ? ` · ${i.translations.uz.workplace}` : ''}</p>,
};

const partnerConfig: EntityConfig<AdminPartner> = {
  title: 'Hamkor korxonalar',
  noun: 'Hamkor',
  addLabel: 'Yangi hamkor',
  emptyTitle: 'Hozircha hamkor korxonalar kiritilmagan',
  emptyText: 'Amaliyot va ishga joylashtirishda hamkorlik qiladigan korxonalarni qo‘shing.',
  api: partnersApi,
  createSchema: partnerCreateSchema,
  updateSchema: partnerUpdateSchema,
  base: [
    { name: 'websiteUrl', label: 'Veb-sayt (ixtiyoriy)', type: 'text', placeholder: 'https://…' },
    { name: 'sortOrder', label: 'Tartib raqami', type: 'number' },
    { name: 'logoMediaId', label: 'Logotip', type: 'media' },
  ],
  trFields: [
    { name: 'name', label: 'Korxona nomi', type: 'text' },
    { name: 'description', label: 'Hamkorlik haqida qisqacha', type: 'textarea' },
  ],
  toBase: (i) => ({ websiteUrl: i?.websiteUrl ?? '', sortOrder: i?.sortOrder ?? 0, logoMediaId: i?.logo?.id ?? null }),
  fromBase: (v) => ({ websiteUrl: str(v.websiteUrl) || null, sortOrder: num(v.sortOrder), logoMediaId: (v.logoMediaId as string | null) ?? null }),
  mediaInitial: (i) => i?.logo,
  subtitle: (i) => (i.websiteUrl ? <p className="text-xs text-muted">{i.websiteUrl}</p> : null),
};

export const VideosAdminPage = () => (
  <EntityManager cfg={{ ...videoConfig, note: <Alert tone="info">Foto galereya “Media kutubxonasi”da boshqariladi: rasmni oching va “Fotogalereyada ko‘rsatish” belgisini qo‘ying.</Alert> }} />
);
export const AlumniAdminPage = () => <EntityManager cfg={alumniConfig} />;
export const PartnersAdminPage = () => <EntityManager cfg={partnerConfig} />;
