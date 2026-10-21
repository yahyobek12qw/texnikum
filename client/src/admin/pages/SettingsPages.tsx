import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Controller, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { SETTINGS_SCHEMAS, type SiteSettingsAdmin } from '@uchkoprik/shared';
import { Button } from '../../components/ui/Button';
import { ErrorState, Loading } from '../../components/ui/Feedback';
import { Checkbox, Field, Input, Select, Textarea } from '../../components/ui/Form';
import { Tabs } from '../../components/ui/Tabs';
import { pagesApi, useAdminSettings } from '../api';
import { PageTitle } from '../components/common';
import { MediaField } from '../components/MediaPicker';
import { GroupForm, LocalizedFields, errorOf, newId, type AnyForm } from '../components/settings-forms';

function useSettingsData() {
  const q = useAdminSettings();
  return q;
}

function MediaController({ form, name, label, kind = 'IMAGE', hint }: { form: AnyForm; name: string; label: string; kind?: 'IMAGE'; hint?: string }) {
  return (
    <Controller control={form.control} name={name} render={({ field }) => (
      <MediaField label={label} kind={kind} value={field.value as string | null} onChange={field.onChange} error={errorOf(form, name)} {...(hint ? { hint } : {})} />
    )} />
  );
}

// ───────────── Sayt sozlamalari ─────────────

function GeneralForm({ s }: { s: SiteSettingsAdmin }) {
  return (
    <GroupForm group="general" title="Umumiy ma’lumotlar" schema={SETTINGS_SCHEMAS.general} values={s.general}>
      {(f) => (
        <>
          <LocalizedFields form={f} name="officialName" label="Rasmiy to‘liq nomi" />
          <LocalizedFields form={f} name="shortName" label="Qisqa nomi" hint="Sahifa sarlavhalarida va footerda ishlatiladi" />
          <MediaController form={f} name="logoMediaId" label="Logotip" hint="Logotip berilmasa, neytral belgi ko‘rsatiladi" />
        </>
      )}
    </GroupForm>
  );
}

function ContactsForm({ s }: { s: SiteSettingsAdmin }) {
  const values = { ...s.contacts, phonesText: s.contacts.phones.join('\n') };
  return (
    <GroupForm
      group="contacts"
      title="Aloqa ma’lumotlari"
      schema={SETTINGS_SCHEMAS.contacts.omit({ phones: true }).extend({ phonesText: z.string().max(1000) }) as never}
      values={values as never}
      transform={(v) => {
        const { phonesText, ...rest } = v as typeof values;
        return { ...rest, phones: String(phonesText ?? '').split('\n').map((x) => x.trim()).filter(Boolean) };
      }}
    >
      {(f) => (
        <>
          <LocalizedFields form={f} name="address" label="Manzil" multiline />
          <Field label="Telefon raqamlari" hint="Har bir raqamni alohida qatorga yozing">
            <Textarea rows={3} {...f.register('phonesText')} />
          </Field>
          <Field label="Elektron pochta" error={errorOf(f, 'email')}><Input type="email" {...f.register('email')} /></Field>
          <LocalizedFields form={f} name="workingHours" label="Ish vaqti" multiline />
          <Field label="Xarita havolasi" error={errorOf(f, 'mapUrl')} hint="Masalan, Google Maps yoki Yandex Maps havolasi (https://…)"><Input {...f.register('mapUrl')} /></Field>
        </>
      )}
    </GroupForm>
  );
}

function SocialForm({ s }: { s: SiteSettingsAdmin }) {
  return (
    <GroupForm group="social" title="Ijtimoiy tarmoq havolalari" schema={SETTINGS_SCHEMAS.social} values={s.social}>
      {(f) => (
        <div className="grid gap-4 sm:grid-cols-2">
          {(['telegram', 'instagram', 'facebook', 'youtube'] as const).map((k) => (
            <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} error={errorOf(f, k)} hint="https://… (bo‘sh qoldirish mumkin)"><Input {...f.register(k)} /></Field>
          ))}
        </div>
      )}
    </GroupForm>
  );
}

function FooterForm({ s }: { s: SiteSettingsAdmin }) {
  return (
    <GroupForm group="footer" title="Footer matni" schema={SETTINGS_SCHEMAS.footer} values={s.footer}>
      {(f) => <LocalizedFields form={f} name="text" label="Footer matni" multiline />}
    </GroupForm>
  );
}

function SeoForm({ s }: { s: SiteSettingsAdmin }) {
  return (
    <GroupForm group="seo" title="Asosiy SEO sozlamalari" description="Alohida SEO ma’lumoti kiritilmagan sahifalar uchun standart qiymatlar." schema={SETTINGS_SCHEMAS.seo} values={s.seo}>
      {(f) => (
        <>
          <LocalizedFields form={f} name="defaultTitle" label="Bosh sahifa sarlavhasi (title)" />
          <LocalizedFields form={f} name="defaultDescription" label="Standart tavsif (meta description)" multiline />
          <MediaController form={f} name="ogImageMediaId" label="Ijtimoiy tarmoqlarda ulashish uchun rasm" />
        </>
      )}
    </GroupForm>
  );
}

function UsefulLinksForm({ s }: { s: SiteSettingsAdmin }) {
  return (
    <GroupForm
      group="usefulLinks"
      title="Foydali havolalar"
      description="Davlat va ta’lim tashkilotlarining rasmiy resurslariga havolalar."
      schema={z.object({ items: SETTINGS_SCHEMAS.usefulLinks }) as never}
      wrap="items"
      values={{ items: s.usefulLinks } as never}
      transform={(v) => (v as { items: unknown[] }).items}
    >
      {(f) => <LinksFields form={f} />}
    </GroupForm>
  );
}

function LinksFields({ form }: { form: AnyForm }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
  return (
    <>
      {fields.length === 0 && <p className="rounded-md border border-dashed border-line bg-surface p-4 text-center text-sm text-muted">Hozircha havolalar yo‘q.</p>}
      {fields.map((field, i) => (
        <div key={field.id} className="space-y-3 rounded-md border border-line p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Havola {i + 1}</p>
            <Button size="sm" variant="ghost" className="text-danger-600" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => remove(i)}>Olib tashlash</Button>
          </div>
          <LocalizedFields form={form} name={`items.${i}.label`} label="Nomi" />
          <Field label="Manzil" error={errorOf(form, `items.${i}.url`)}><Input {...form.register(`items.${i}.url`)} placeholder="https://…" /></Field>
        </div>
      ))}
      <Button variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => append({ id: newId(), label: { uz: '', ru: '', en: '' }, url: '' })}>Havola qo‘shish</Button>
    </>
  );
}

export function SiteSettingsPage() {
  const q = useSettingsData();
  const [tab, setTab] = useState<'general' | 'contacts' | 'social' | 'footer' | 'links' | 'seo'>('general');
  return (
    <>
      <PageTitle title="Sayt sozlamalari" />
      {q.isPending ? <Loading /> : q.isError ? <ErrorState title="Sozlamalarni yuklab bo‘lmadi" text={q.error.message} onRetry={() => void q.refetch()} /> : (
        <Tabs
          label="Sozlama bo‘limlari"
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'general', label: 'Umumiy' }, { key: 'contacts', label: 'Aloqa' }, { key: 'social', label: 'Ijtimoiy tarmoqlar' },
            { key: 'footer', label: 'Footer' }, { key: 'links', label: 'Foydali havolalar' }, { key: 'seo', label: 'SEO' },
          ]}
        >
          {(k) => (
            <div className="max-w-3xl">
              {k === 'general' && <GeneralForm s={q.data} />}
              {k === 'contacts' && <ContactsForm s={q.data} />}
              {k === 'social' && <SocialForm s={q.data} />}
              {k === 'footer' && <FooterForm s={q.data} />}
              {k === 'links' && <UsefulLinksForm s={q.data} />}
              {k === 'seo' && <SeoForm s={q.data} />}
            </div>
          )}
        </Tabs>
      )}
    </>
  );
}

// ───────────── Bosh sahifa sozlamalari ─────────────

function TopBarForm({ s }: { s: SiteSettingsAdmin }) {
  return (
    <GroupForm group="topBar" title="Yuqori axborot paneli" description="Saytning eng tepasida ko‘rinadigan qisqa xabar (masalan, qabul e’loni)." schema={SETTINGS_SCHEMAS.topBar} values={s.topBar}>
      {(f) => (
        <>
          <Checkbox label="Panel ko‘rsatilsin" {...f.register('isActive')} />
          <LocalizedFields form={f} name="text" label="Xabar matni" />
          <Field label="Havola (ixtiyoriy)" error={errorOf(f, 'linkUrl')} hint="Ichki yo‘l (/uz/news) yoki https://… manzil"><Input {...f.register('linkUrl')} /></Field>
        </>
      )}
    </GroupForm>
  );
}

function AboutForm({ s }: { s: SiteSettingsAdmin }) {
  const pages = pagesApi.useList({ pageSize: 100, status: 'PUBLISHED' });
  return (
    <GroupForm group="homeAbout" title="Texnikum haqida (bosh sahifadagi qisqacha blok)" schema={SETTINGS_SCHEMAS.homeAbout.extend({ pageId: z.string() }) as never} values={{ ...s.homeAbout, pageId: s.homeAbout.pageId ?? '' } as never} transform={(v) => ({ ...(v as object), pageId: (v as { pageId: string | null }).pageId || null })}>
      {(f) => (
        <>
          <LocalizedFields form={f} name="title" label="Sarlavha" />
          <LocalizedFields form={f} name="text" label="Qisqacha matn" multiline />
          <Field label="“Batafsil” tugmasi qaysi sahifaga olib borsin">
            <Select {...f.register('pageId')}>
              <option value="">— Tugma ko‘rsatilmasin —</option>
              {pages.data?.items.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </Field>
        </>
      )}
    </GroupForm>
  );
}

function BannersForm({ s }: { s: SiteSettingsAdmin }) {
  return (
    <GroupForm
      group="banners"
      title="Bosh sahifa bannerlari"
      description="Bannerlar bo‘lmasa, bosh sahifada texnikum nomi bilan oddiy sarlavha bloki ko‘rsatiladi."
      schema={z.object({ items: SETTINGS_SCHEMAS.banners }) as never}
      wrap="items"
      values={{ items: s.banners } as never}
      transform={(v) => (v as { items: unknown[] }).items}
    >
      {(f) => <BannerFields form={f} />}
    </GroupForm>
  );
}

function BannerFields({ form }: { form: AnyForm }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
  return (
    <>
      {fields.length === 0 && <p className="rounded-md border border-dashed border-line bg-surface p-4 text-center text-sm text-muted">Bannerlar qo‘shilmagan.</p>}
      {fields.map((field, i) => (
        <div key={field.id} className="space-y-3 rounded-md border border-line p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Banner {i + 1}</p>
            <Button size="sm" variant="ghost" className="text-danger-600" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => remove(i)}>Olib tashlash</Button>
          </div>
          <Checkbox label="Faol (saytda ko‘rsatiladi)" {...form.register(`items.${i}.isActive`)} />
          <MediaController form={form} name={`items.${i}.imageMediaId`} label="Banner rasmi" hint="Tavsiya: kengligi 1600 px dan kam bo‘lmagan rasm" />
          <LocalizedFields form={form} name={`items.${i}.title`} label="Sarlavha" />
          <LocalizedFields form={form} name={`items.${i}.text`} label="Qisqa matn" />
          <Field label="Havola (ixtiyoriy)" error={errorOf(form, `items.${i}.linkUrl`)}><Input {...form.register(`items.${i}.linkUrl`)} placeholder="/uz/news yoki https://…" /></Field>
        </div>
      ))}
      <Button variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => append({ id: newId(), imageMediaId: null, title: { uz: '', ru: '', en: '' }, text: { uz: '', ru: '', en: '' }, linkUrl: '', isActive: true })}>Banner qo‘shish</Button>
    </>
  );
}

function StatisticsForm({ s }: { s: SiteSettingsAdmin }) {
  return (
    <GroupForm
      group="statistics"
      title="“Raqamlarda” ko‘rsatkichlari"
      description="Bosh sahifadagi raqamlar bloki (masalan: talabalar soni, o‘qituvchilar soni). Faqat HAQIQIY, tasdiqlangan raqamlarni kiriting; ro‘yxat bo‘sh bo‘lsa, blok ko‘rsatilmaydi."
      schema={z.object({ items: SETTINGS_SCHEMAS.statistics }) as never}
      wrap="items"
      values={{ items: s.statistics } as never}
      transform={(v) => (v as { items: unknown[] }).items}
    >
      {(f) => <StatisticsFields form={f} />}
    </GroupForm>
  );
}

function StatisticsFields({ form }: { form: AnyForm }) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'items' });
  return (
    <>
      {fields.length === 0 && <p className="rounded-md border border-dashed border-line bg-surface p-4 text-center text-sm text-muted">Ko‘rsatkichlar qo‘shilmagan.</p>}
      {fields.map((field, i) => (
        <div key={field.id} className="space-y-3 rounded-md border border-line p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Ko‘rsatkich {i + 1}</p>
            <Button size="sm" variant="ghost" className="text-danger-600" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => remove(i)}>Olib tashlash</Button>
          </div>
          <Field label="Qiymat" error={errorOf(form, `items.${i}.value`)} hint="Masalan: 1200 yoki 25+"><Input {...form.register(`items.${i}.value`)} /></Field>
          <LocalizedFields form={form} name={`items.${i}.label`} label="Izoh (masalan: “Talabalar”)" />
        </div>
      ))}
      {fields.length < 8 && <Button variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => append({ id: newId(), value: '', label: { uz: '', ru: '', en: '' } })}>Ko‘rsatkich qo‘shish</Button>}
    </>
  );
}

export function HomeSettingsPage() {
  const q = useSettingsData();
  return (
    <>
      <PageTitle title="Bosh sahifa sozlamalari" />
      {q.isPending ? <Loading /> : q.isError ? <ErrorState title="Sozlamalarni yuklab bo‘lmadi" text={q.error.message} onRetry={() => void q.refetch()} /> : (
        <div className="grid max-w-3xl gap-6">
          <TopBarForm s={q.data} />
          <BannersForm s={q.data} />
          <StatisticsForm s={q.data} />
          <AboutForm s={q.data} />
          <p className="text-sm text-muted">Yangiliklar, hujjatlar va ta’lim yo‘nalishlari bloklari tegishli bo‘limlardan avtomatik olinadi. Foydali havolalar va aloqa ma’lumotlari “Sayt sozlamalari” bo‘limida tahrirlanadi.</p>
        </div>
      )}
    </>
  );
}
