import type { Prisma } from '@prisma/client';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEYS,
  SETTINGS_SCHEMAS,
  pickLocalized,
  type Locale,
  type PublicSettings,
  type SettingsKey,
  type SettingsPatchInput,
  type SiteSettingsAdmin,
} from '@uchkoprik/shared';
import { getModules, invalidateModules } from '../../lib/modules.js';
import { toImageRef } from '../../lib/media-urls.js';
import { prisma } from '../../lib/prisma.js';
import { resolveTranslation } from '../../lib/translations.js';

/** Bazadagi guruhlarni o'qiydi; yo'q yoki yaroqsiz guruh o'rniga standart qiymat qaytariladi. */
export async function getAdminSettings(): Promise<SiteSettingsAdmin> {
  const rows = await prisma.siteSetting.findMany();
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (!(SETTINGS_KEYS as string[]).includes(row.key)) continue;
    const key = row.key as SettingsKey;
    const parsed = SETTINGS_SCHEMAS[key].safeParse(row.value);
    if (parsed.success) out[key] = parsed.data;
  }
  return out as SiteSettingsAdmin;
}

export async function patchSettings(patch: SettingsPatchInput): Promise<SiteSettingsAdmin> {
  const entries = Object.entries(patch) as [SettingsKey, unknown][];
  await prisma.$transaction(
    entries
      .filter(([, v]) => v !== undefined)
      .map(([key, value]) =>
        prisma.siteSetting.upsert({
          where: { key },
          create: { key, value: value as Prisma.InputJsonValue },
          update: { value: value as Prisma.InputJsonValue },
        }),
      ),
  );
  if (patch.modules !== undefined) invalidateModules();
  return getAdminSettings();
}

export async function getPublicSettings(locale: Locale): Promise<PublicSettings> {
  const s = await getAdminSettings();
  const modules = await getModules();

  const mediaIds = [
    s.general.logoMediaId,
    s.seo.ogImageMediaId,
    ...s.banners.filter((b) => b.isActive).map((b) => b.imageMediaId),
  ].filter((v): v is string => Boolean(v));

  const media = mediaIds.length
    ? await prisma.media.findMany({ where: { id: { in: mediaIds } }, include: { translations: true } })
    : [];
  const byId = new Map(media.map((m) => [m.id, m]));
  const image = (id: string | null) => (id ? toImageRef(byId.get(id), locale) : null);

  let pageHref: string | null = null;
  if (s.homeAbout.pageId) {
    const page = await prisma.page.findFirst({
      where: { id: s.homeAbout.pageId, status: 'PUBLISHED' },
      include: { translations: true },
    });
    const tr = page ? resolveTranslation(page.translations, locale)?.tr : null;
    if (tr) pageHref = `/${locale}/${tr.slug}`;
  }

  return {
    officialName: pickLocalized(s.general.officialName, locale),
    shortName: pickLocalized(s.general.shortName, locale),
    logo: image(s.general.logoMediaId),
    topBar:
      s.topBar.isActive && pickLocalized(s.topBar.text, locale)
        ? { text: pickLocalized(s.topBar.text, locale), linkUrl: s.topBar.linkUrl }
        : null,
    address: pickLocalized(s.contacts.address, locale),
    phones: s.contacts.phones,
    email: s.contacts.email,
    workingHours: pickLocalized(s.contacts.workingHours, locale),
    mapUrl: s.contacts.mapUrl,
    social: s.social,
    footerText: pickLocalized(s.footer.text, locale),
    seo: {
      defaultTitle: pickLocalized(s.seo.defaultTitle, locale),
      defaultDescription: pickLocalized(s.seo.defaultDescription, locale),
      ogImage: image(s.seo.ogImageMediaId),
    },
    homeAbout: {
      title: pickLocalized(s.homeAbout.title, locale),
      text: pickLocalized(s.homeAbout.text, locale),
      pageHref,
    },
    banners: s.banners
      .filter((b) => b.isActive)
      .map((b) => ({
        id: b.id,
        image: image(b.imageMediaId),
        title: pickLocalized(b.title, locale),
        text: pickLocalized(b.text, locale),
        linkUrl: b.linkUrl,
      })),
    usefulLinks: modules.usefulLinks ? s.usefulLinks.map((l) => ({ id: l.id, label: pickLocalized(l.label, locale), url: l.url })) : [],
    modules,
    statistics: modules.statistics
      ? s.statistics.map((x) => ({ id: x.id, value: x.value, label: pickLocalized(x.label, locale) })).filter((x) => x.label)
      : [],
  };
}
