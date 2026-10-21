import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import {
  partnerCreateSchema,
  partnerUpdateSchema,
  type AdminPartner,
  type Locale,
  type PartnerTranslationInput,
  type PublicPartner,
} from '@uchkoprik/shared';
import { audit } from '../../lib/audit.js';
import { notFound } from '../../lib/errors.js';
import { param, parse } from '../../lib/http.js';
import { toAdminMediaRef, toImageRef } from '../../lib/media-urls.js';
import { prisma, type Tx } from '../../lib/prisma.js';
import { addStatusRoutes } from '../../lib/status-routes.js';
import { adminTitle, applyTranslationPatch, resolveTranslation, toTranslationMap, translationStatus } from '../../lib/translations.js';
import { assertEditable } from '../../middleware/auth.js';
import { assertMediaOfKind } from '../media/media.service.js';

export const partnerInclude = {
  translations: true,
  logoMedia: { include: { translations: true } },
} satisfies Prisma.PartnerInclude;
export type PartnerRow = Prisma.PartnerGetPayload<{ include: typeof partnerInclude }>;

const toAdmin = (p: PartnerRow): AdminPartner => ({
  id: p.id,
  websiteUrl: p.websiteUrl,
  logo: toAdminMediaRef(p.logoMedia),
  status: p.status,
  sortOrder: p.sortOrder,
  updatedAt: p.updatedAt.toISOString(),
  title: adminTitle(p.translations, (t) => t.name),
  translationStatus: translationStatus(p.translations),
  translations: toTranslationMap(p.translations, (t) => ({ name: t.name, description: t.description })),
});

export function toPublicPartner(p: PartnerRow, locale: Locale): PublicPartner | null {
  const r = resolveTranslation(p.translations, locale);
  if (!r) return null;
  return {
    id: p.id,
    requestedLocale: locale,
    locale: r.tr.locale,
    isFallback: r.isFallback,
    name: r.tr.name,
    description: r.tr.description,
    websiteUrl: p.websiteUrl,
    logo: toImageRef(p.logoMedia, locale),
  };
}

async function load(id: string): Promise<PartnerRow> {
  const row = await prisma.partner.findUnique({ where: { id }, include: partnerInclude });
  if (!row) throw notFound('Hamkor korxona topilmadi');
  return row;
}

async function applyTranslations(tx: Tx, partnerId: string, patch: Partial<Record<Locale, PartnerTranslationInput | null | undefined>> | undefined) {
  const existing = (await tx.partnerTranslation.findMany({ where: { partnerId }, select: { locale: true } })).map((t) => t.locale);
  await applyTranslationPatch({
    patch,
    existing,
    upsert: (locale, d) =>
      tx.partnerTranslation.upsert({
        where: { partnerId_locale: { partnerId, locale } },
        create: { partnerId, locale, name: d.name, description: d.description },
        update: { name: d.name, description: d.description },
      }),
    remove: (locale) => tx.partnerTranslation.delete({ where: { partnerId_locale: { partnerId, locale } } }),
  });
}

export function adminPartnersRouter() {
  const router = Router();

  router.get('/', async (_req, res) => {
    const rows = await prisma.partner.findMany({ include: partnerInclude, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    res.json({ items: rows.map(toAdmin) });
  });

  router.post('/', async (req, res) => {
    const input = parse(partnerCreateSchema, req.body);
    await assertMediaOfKind(input.logoMediaId, 'IMAGE');
    const id = await prisma.$transaction(async (tx) => {
      const p = await tx.partner.create({ data: { websiteUrl: input.websiteUrl || null, logoMediaId: input.logoMediaId ?? null, sortOrder: input.sortOrder } });
      await applyTranslations(tx, p.id, input.translations);
      return p.id;
    });
    const row = await load(id);
    await audit(req, { action: 'CREATE', entity: 'partner', entityId: id, summary: `Hamkor qo‘shildi: ${toAdmin(row).title}` });
    res.status(201).json(toAdmin(row));
  });

  router.get('/:id', async (req, res) => res.json(toAdmin(await load(param(req, 'id')))));

  router.patch('/:id', async (req, res) => {
    const id = param(req, 'id');
    const input = parse(partnerUpdateSchema, req.body);
    const current = await load(id);
    assertEditable(req, current.status);
    if (input.logoMediaId !== undefined) await assertMediaOfKind(input.logoMediaId, 'IMAGE');
    await prisma.$transaction(async (tx) => {
      await tx.partner.update({
        where: { id },
        data: {
          ...(input.websiteUrl !== undefined ? { websiteUrl: input.websiteUrl || null } : {}),
          ...(input.logoMediaId !== undefined ? { logoMediaId: input.logoMediaId } : {}),
          ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        },
      });
      await applyTranslations(tx, id, input.translations);
    });
    const row = await load(id);
    await audit(req, { action: 'UPDATE', entity: 'partner', entityId: id, summary: `Hamkor tahrirlandi: ${toAdmin(row).title}` });
    res.json(toAdmin(row));
  });

  addStatusRoutes(router, {
    entity: 'partner',
    label: 'Hamkor',
    load,
    save: (id, data) => prisma.partner.update({ where: { id }, data: { status: data.status } }),
    serialize: async (id) => toAdmin(await load(id)),
    title: (row) => toAdmin(row).title,
  });

  router.delete('/:id', async (req, res) => {
    const id = param(req, 'id');
    const row = await load(id);
    await prisma.partner.delete({ where: { id } });
    await audit(req, { action: 'DELETE', entity: 'partner', entityId: id, summary: `Hamkor o‘chirildi: ${toAdmin(row).title}` });
    res.status(204).end();
  });

  return router;
}
