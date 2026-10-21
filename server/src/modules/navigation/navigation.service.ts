import type { Prisma } from '@prisma/client';
import {
  LOCALES,
  isRouteEnabled,
  type ModulesState,
  type AdminNavItem,
  type AdminNavigation,
  type Locale,
  type NavItemInput,
  type PublicNavItem,
  type PublicNavigation,
} from '@uchkoprik/shared';
import { badRequest } from '../../lib/errors.js';
import { getModules, pageModuleEnabled } from '../../lib/modules.js';
import { prisma } from '../../lib/prisma.js';
import { adminTitle, resolveTranslation } from '../../lib/translations.js';

const MENU_KEYS = ['main', 'footer'] as const;
type MenuKey = (typeof MENU_KEYS)[number];

const itemInclude = {
  translations: true,
  page: { include: { translations: true } },
} satisfies Prisma.NavigationItemInclude;
type ItemRow = Prisma.NavigationItemGetPayload<{ include: typeof itemInclude }>;

async function ensureMenus() {
  for (const key of MENU_KEYS) {
    await prisma.navigationMenu.upsert({ where: { key }, create: { key }, update: {} });
  }
}

function buildTree<R extends { id: string; parentId: string | null; sortOrder: number }>(rows: R[]) {
  const byParent = new Map<string | null, R[]>();
  for (const r of rows) {
    const list = byParent.get(r.parentId) ?? [];
    list.push(r);
    byParent.set(r.parentId, list);
  }
  for (const list of byParent.values()) list.sort((a, b) => a.sortOrder - b.sortOrder);
  return (parentId: string | null): R[] => byParent.get(parentId) ?? [];
}

// ───────────── Admin ─────────────

function toAdminItem(row: ItemRow, children: (id: string | null) => ItemRow[]): AdminNavItem {
  const labels = Object.fromEntries(
    LOCALES.map((l) => [l, row.translations.find((t) => t.locale === l)?.label ?? '']),
  ) as Record<Locale, string>;
  return {
    id: row.id,
    kind: row.kind,
    pageId: row.pageId,
    pageTitle: row.page ? adminTitle(row.page.translations, (t) => t.title) : null,
    route: row.route,
    url: row.url,
    newTab: row.newTab,
    labels,
    children: children(row.id).map((c) => toAdminItem(c, children)),
  };
}

export async function getAdminNavigation(): Promise<AdminNavigation> {
  await ensureMenus();
  const menus = await prisma.navigationMenu.findMany({
    include: { items: { include: itemInclude } },
  });
  return {
    menus: MENU_KEYS.map((key) => {
      const menu = menus.find((m) => m.key === key)!;
      const childrenOf = buildTree(menu.items);
      return { key, items: childrenOf(null).map((r) => toAdminItem(r, childrenOf)) };
    }),
  };
}

const MAX_DEPTH = 3;

function assertDepth(items: NavItemInput[], depth = 1) {
  if (depth > MAX_DEPTH) throw badRequest(`Menyu ${MAX_DEPTH} darajadan chuqur bo‘lmasligi kerak`, 'NAV_TOO_DEEP');
  for (const i of items) assertDepth(i.children, depth + 1);
}

/** Menyu daraxtini to'liq almashtiradi (tartib massiv indeksidan olinadi). */
export async function replaceNavigation(menus: { key: MenuKey; items: NavItemInput[] }[]) {
  for (const m of menus) assertDepth(m.items);

  const pageIds = new Set<string>();
  const collect = (items: NavItemInput[]) => {
    for (const i of items) {
      if (i.kind === 'PAGE' && i.pageId) pageIds.add(i.pageId);
      collect(i.children);
    }
  };
  menus.forEach((m) => collect(m.items));
  if (pageIds.size > 0) {
    const found = await prisma.page.count({ where: { id: { in: [...pageIds] } } });
    if (found !== pageIds.size) throw badRequest('Menyuda mavjud bo‘lmagan sahifa tanlangan', 'PAGE_NOT_FOUND');
  }

  await ensureMenus();
  await prisma.$transaction(async (tx) => {
    for (const m of menus) {
      const menu = await tx.navigationMenu.findUniqueOrThrow({ where: { key: m.key } });
      await tx.navigationItem.deleteMany({ where: { menuId: menu.id } });
      const create = async (items: NavItemInput[], parentId: string | null) => {
        for (const [index, item] of items.entries()) {
          const row = await tx.navigationItem.create({
            data: {
              menuId: menu.id,
              parentId,
              sortOrder: index,
              kind: item.kind,
              pageId: item.kind === 'PAGE' ? (item.pageId ?? null) : null,
              route: item.kind === 'ROUTE' ? (item.route ?? null) : null,
              url: item.kind === 'EXTERNAL' ? (item.url ?? null) : null,
              newTab: item.kind === 'EXTERNAL' ? item.newTab : false,
              translations: {
                create: LOCALES.filter((l) => item.labels[l].trim() !== '').map((l) => ({
                  locale: l,
                  label: item.labels[l].trim(),
                })),
              },
            },
          });
          await create(item.children, row.id);
        }
      };
      await create(m.items, null);
    }
  });
}

// ───────────── Ommaviy ─────────────

function publicItem(
  row: ItemRow,
  children: (id: string | null) => ItemRow[],
  locale: Locale,
  modules: ModulesState,
): PublicNavItem | null {
  const label = resolveTranslation(row.translations, locale)?.tr.label;
  if (!label) return null;

  let href = '';
  let external = false;
  if (row.kind === 'PAGE') {
    if (!row.page || row.page.status !== 'PUBLISHED' || !pageModuleEnabled(row.page.module, modules)) return null;
    const tr = resolveTranslation(row.page.translations, locale)?.tr;
    if (!tr) return null;
    href = `/${locale}/${tr.slug}`;
  } else if (row.kind === 'ROUTE') {
    if (!isRouteEnabled(row.route ?? '', modules)) return null;
    href = row.route === '/' ? `/${locale}` : `/${locale}${row.route ?? ''}`;
  } else {
    href = row.url ?? '';
    external = true;
    if (!href) return null;
  }

  return {
    id: row.id,
    label,
    href,
    newTab: row.newTab,
    external,
    children: children(row.id)
      .map((c) => publicItem(c, children, locale, modules))
      .filter((c): c is PublicNavItem => c !== null),
  };
}

export async function getPublicNavigation(locale: Locale): Promise<PublicNavigation> {
  await ensureMenus();
  const modules = await getModules();
  const menus = await prisma.navigationMenu.findMany({ include: { items: { include: itemInclude } } });
  const build = (key: MenuKey): PublicNavItem[] => {
    const menu = menus.find((m) => m.key === key);
    if (!menu) return [];
    const childrenOf = buildTree(menu.items);
    return childrenOf(null)
      .map((r) => publicItem(r, childrenOf, locale, modules))
      .filter((r): r is PublicNavItem => r !== null);
  };
  return { main: build('main'), footer: build('footer') };
}
