import { ArrowDown, ArrowUp, CornerDownRight, CornerLeftUp, ExternalLink, FileText, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  FIXED_ROUTES, LOCALES, LOCALE_LABELS, NAV_ITEM_KINDS, navigationUpdateSchema,
  type AdminNavItem, type AdminNavigation, type Locale, type NavItemInput, type NavItemKind,
} from '@uchkoprik/shared';
import { Button } from '../../components/ui/Button';
import { Alert, ErrorState, Loading } from '../../components/ui/Feedback';
import { Checkbox, Field, Input, Select } from '../../components/ui/Form';
import { Modal } from '../../components/ui/Modal';
import { Tabs } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import { pagesApi, useAdminNavigation, useSaveNavigation } from '../api';
import { Card, PageTitle } from '../components/common';
import { IconButton, errorMessage } from '../components/row-actions';

const MAX_DEPTH = 3;
type MenuKey = 'main' | 'footer';

interface Node {
  uid: string;
  kind: NavItemKind;
  pageId: string;
  route: string;
  url: string;
  newTab: boolean;
  labels: Record<Locale, string>;
  children: Node[];
}

let uidCounter = 0;
const uid = () => `n${++uidCounter}`;

function fromAdmin(item: AdminNavItem): Node {
  return {
    uid: uid(),
    kind: item.kind,
    pageId: item.pageId ?? '',
    route: item.route ?? '',
    url: item.url ?? '',
    newTab: item.newTab,
    labels: item.labels,
    children: item.children.map(fromAdmin),
  };
}

function toInput(n: Node): NavItemInput {
  return {
    kind: n.kind,
    pageId: n.kind === 'PAGE' ? n.pageId || null : null,
    route: n.kind === 'ROUTE' ? n.route || null : null,
    url: n.kind === 'EXTERNAL' ? n.url.trim() || null : null,
    newTab: n.kind === 'EXTERNAL' ? n.newTab : false,
    labels: { uz: n.labels.uz.trim(), ru: n.labels.ru.trim(), en: n.labels.en.trim() },
    children: n.children.map(toInput),
  };
}

const emptyNode = (): Node => ({ uid: uid(), kind: 'PAGE', pageId: '', route: '', url: '', newTab: false, labels: { uz: '', ru: '', en: '' }, children: [] });

function listAt(root: Node[], path: number[]): Node[] {
  let list = root;
  for (const i of path) list = list[i]!.children;
  return list;
}
const depthOf = (n: Node): number => 1 + Math.max(0, ...n.children.map(depthOf));
const clone = (t: Node[]): Node[] => structuredClone(t);

function describe(n: Node, pageTitle: (id: string) => string): string {
  if (n.kind === 'PAGE') return n.pageId ? `Sahifa: ${pageTitle(n.pageId)}` : 'Sahifa tanlanmagan';
  if (n.kind === 'ROUTE') return `Bo‘lim: ${FIXED_ROUTES.find((r) => r.route === n.route)?.label ?? (n.route || 'tanlanmagan')}`;
  return `Tashqi havola: ${n.url || 'kiritilmagan'}`;
}

function ItemModal({ node, pages, onSave, onClose }: { node: Node; pages: { id: string; title: string }[]; onSave: (n: Node) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<Node>(node);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (patch: Partial<Node>) => setDraft((d) => ({ ...d, ...patch }));

  const save = () => {
    const e: Record<string, string> = {};
    if (!draft.labels.uz.trim() && !draft.labels.ru.trim() && !draft.labels.en.trim()) e.labels = 'Kamida bitta tilda nom kiriting';
    if (draft.kind === 'PAGE' && !draft.pageId) e.target = 'Sahifani tanlang';
    if (draft.kind === 'ROUTE' && !draft.route) e.target = 'Bo‘limni tanlang';
    if (draft.kind === 'EXTERNAL' && !/^https?:\/\/\S+$/i.test(draft.url.trim())) e.target = 'To‘g‘ri http(s) manzil kiriting';
    setErrors(e);
    if (Object.keys(e).length === 0) onSave(draft);
  };

  return (
    <Modal open onClose={onClose} title="Menyu bandi" footer={<><Button variant="secondary" onClick={onClose}>Bekor qilish</Button><Button onClick={save}>Qo‘llash</Button></>}>
      <div className="space-y-4">
        <Field label="Band turi">
          <Select value={draft.kind} onChange={(e) => set({ kind: e.target.value as NavItemKind })}>
            {NAV_ITEM_KINDS.map((k) => <option key={k} value={k}>{k === 'PAGE' ? 'Ichki sahifa' : k === 'ROUTE' ? 'Saytning tayyor bo‘limi (yangiliklar, aloqa…)' : 'Tashqi havola'}</option>)}
          </Select>
        </Field>
        {draft.kind === 'PAGE' && (
          <Field label="Sahifa" error={errors.target} required>
            <Select value={draft.pageId} onChange={(e) => set({ pageId: e.target.value })}>
              <option value="">— Tanlang —</option>
              {pages.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </Field>
        )}
        {draft.kind === 'ROUTE' && (
          <Field label="Bo‘lim" error={errors.target} required>
            <Select value={draft.route} onChange={(e) => set({ route: e.target.value })}>
              <option value="">— Tanlang —</option>
              {FIXED_ROUTES.map((r) => <option key={r.route} value={r.route}>{r.label}</option>)}
            </Select>
          </Field>
        )}
        {draft.kind === 'EXTERNAL' && (
          <>
            <Field label="Havola manzili" error={errors.target} required hint="https://… ko‘rinishida"><Input value={draft.url} onChange={(e) => set({ url: e.target.value })} /></Field>
            <Checkbox label="Yangi oynada ochilsin" checked={draft.newTab} onChange={(e) => set({ newTab: e.target.checked })} />
          </>
        )}
        <fieldset className="space-y-3 rounded-md border border-line p-3">
          <legend className="px-1 text-sm font-semibold">Menyudagi nomi</legend>
          {errors.labels && <p role="alert" className="text-sm font-medium text-danger-600">{errors.labels}</p>}
          {LOCALES.map((l) => (
            <Field key={l} label={LOCALE_LABELS[l]}>
              <Input value={draft.labels[l]} maxLength={100} onChange={(e) => set({ labels: { ...draft.labels, [l]: e.target.value } })} />
            </Field>
          ))}
          <p className="text-xs text-muted">Nom kiritilmagan tilda band ko‘rsatilmaydi yoki boshqa tildagi nomi ishlatiladi (o‘zbekcha → ruscha → inglizcha).</p>
        </fieldset>
      </div>
    </Modal>
  );
}

function Tree({ nodes, path, depth, pageTitle, onAction }: {
  nodes: Node[]; path: number[]; depth: number; pageTitle: (id: string) => string;
  onAction: (a: 'up' | 'down' | 'in' | 'out' | 'edit' | 'delete' | 'add', path: number[]) => void;
}) {
  return (
    <ul className={depth > 1 ? 'ml-4 border-l-2 border-line pl-3 sm:ml-8' : ''}>
      {nodes.map((n, i) => {
        const p = [...path, i];
        const label = n.labels.uz || n.labels.ru || n.labels.en || '(nomsiz)';
        const Icon = n.kind === 'PAGE' ? FileText : n.kind === 'ROUTE' ? Link2 : ExternalLink;
        return (
          <li key={n.uid} className="mt-2">
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-white p-2.5">
              <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{label}</p>
                <p className="truncate text-xs text-muted">{describe(n, pageTitle)}</p>
              </div>
              <div className="flex flex-wrap gap-1">
                <IconButton label={`${label}: yuqoriga`} disabled={i === 0} onClick={() => onAction('up', p)}><ArrowUp className="h-4 w-4" aria-hidden /></IconButton>
                <IconButton label={`${label}: pastga`} disabled={i === nodes.length - 1} onClick={() => onAction('down', p)}><ArrowDown className="h-4 w-4" aria-hidden /></IconButton>
                <IconButton label={`${label}: oldingi bandning ichiga kiritish`} disabled={i === 0 || depth >= MAX_DEPTH} onClick={() => onAction('in', p)}><CornerDownRight className="h-4 w-4" aria-hidden /></IconButton>
                <IconButton label={`${label}: bir daraja yuqoriga chiqarish`} disabled={depth === 1} onClick={() => onAction('out', p)}><CornerLeftUp className="h-4 w-4" aria-hidden /></IconButton>
                {depth < MAX_DEPTH && <IconButton label={`${label}: ichki band qo‘shish`} onClick={() => onAction('add', p)}><Plus className="h-4 w-4" aria-hidden /></IconButton>}
                <IconButton label={`${label}: tahrirlash`} onClick={() => onAction('edit', p)}><Pencil className="h-4 w-4" aria-hidden /></IconButton>
                <IconButton label={`${label}: o‘chirish`} danger onClick={() => onAction('delete', p)}><Trash2 className="h-4 w-4" aria-hidden /></IconButton>
              </div>
            </div>
            {n.children.length > 0 && <Tree nodes={n.children} path={p} depth={depth + 1} pageTitle={pageTitle} onAction={onAction} />}
          </li>
        );
      })}
    </ul>
  );
}

function Editor({ data }: { data: AdminNavigation }) {
  const toast = useToast();
  const save = useSaveNavigation();
  const pagesQuery = pagesApi.useList({ pageSize: 100 });
  const pages = pagesQuery.data?.items.map((p) => ({ id: p.id, title: p.title })) ?? [];
  const pageTitle = (id: string) => pages.find((p) => p.id === id)?.title ?? 'Sahifa';

  const initial = useMemo(() => Object.fromEntries(data.menus.map((m) => [m.key, m.items.map(fromAdmin)])) as Record<MenuKey, Node[]>, [data]);
  const [trees, setTrees] = useState<Record<MenuKey, Node[]>>(initial);
  const [active, setActive] = useState<MenuKey>('main');
  const [editing, setEditing] = useState<{ path: number[]; node: Node; isNew: boolean; parentPath: number[] } | null>(null);

  useEffect(() => setTrees(initial), [initial]);

  const snapshot = (t: Record<MenuKey, Node[]>) => JSON.stringify((['main', 'footer'] as const).map((k) => t[k].map(toInput)));
  const dirty = snapshot(trees) !== snapshot(initial);
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const mutate = (fn: (root: Node[]) => void) => setTrees((cur) => {
    const next = clone(cur[active]);
    fn(next);
    return { ...cur, [active]: next };
  });

  const onAction = (a: 'up' | 'down' | 'in' | 'out' | 'edit' | 'delete' | 'add', path: number[]) => {
    const idx = path[path.length - 1]!;
    const parentPath = path.slice(0, -1);
    if (a === 'edit') {
      setEditing({ path, node: listAt(trees[active], parentPath)[idx]!, isNew: false, parentPath });
    } else if (a === 'add') {
      setEditing({ path: [...path, -1], node: emptyNode(), isNew: true, parentPath: path });
    } else if (a === 'delete') {
      mutate((root) => { listAt(root, parentPath).splice(idx, 1); });
    } else if (a === 'up' || a === 'down') {
      mutate((root) => {
        const list = listAt(root, parentPath);
        const j = a === 'up' ? idx - 1 : idx + 1;
        if (j < 0 || j >= list.length) return;
        [list[idx], list[j]] = [list[j]!, list[idx]!];
      });
    } else if (a === 'in') {
      mutate((root) => {
        const list = listAt(root, parentPath);
        if (idx === 0) return;
        const [item] = list.splice(idx, 1);
        if (depthOf(item!) + path.length > MAX_DEPTH) { list.splice(idx, 0, item!); return; }
        list[idx - 1]!.children.push(item!);
      });
    } else if (a === 'out') {
      mutate((root) => {
        if (path.length < 2) return;
        const list = listAt(root, parentPath);
        const [item] = list.splice(idx, 1);
        const grand = listAt(root, path.slice(0, -2));
        grand.splice(path[path.length - 2]! + 1, 0, item!);
      });
    }
  };

  const onSaveItem = (node: Node) => {
    if (!editing) return;
    mutate((root) => {
      if (editing.isNew) {
        // parentPath — yangi band qo'shiladigan bandning yo'li (bo'sh bo'lsa, eng yuqori daraja)
        listAt(root, editing.parentPath).push({ ...node });
      } else {
        const siblings = listAt(root, editing.parentPath);
        const index = editing.path[editing.path.length - 1]!;
        siblings[index] = { ...node, children: siblings[index]!.children };
      }
    });
    setEditing(null);
  };

  const submit = async () => {
    const payload = { menus: (['main', 'footer'] as const).map((key) => ({ key, items: trees[key].map(toInput) })) };
    const parsed = navigationUpdateSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(`Menyuda xatolik: ${parsed.error.issues[0]?.message ?? 'ma’lumot to‘liq emas'}`);
      return;
    }
    try {
      await save.mutateAsync(parsed.data);
      toast.success('Menyu saqlandi va saytda yangilandi');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <>
      <PageTitle title="Menyu boshqaruvi" actions={<><Button variant="secondary" disabled={!dirty} onClick={() => setTrees(initial)}>Bekor qilish</Button><Button loading={save.isPending} disabled={!dirty} onClick={() => void submit()}>Saqlash</Button></>} />
      {dirty && <Alert tone="warn" className="mb-4">Saqlanmagan o‘zgarishlar bor. “Saqlash” bosilmaguncha saytdagi menyu o‘zgarmaydi.</Alert>}
      <Card>
        <Tabs tabs={[{ key: 'main' as MenuKey, label: 'Asosiy menyu' }, { key: 'footer' as MenuKey, label: 'Footer menyusi' }]} active={active} onChange={setActive} label="Menyu turlari">
          {(key) => (
            <div>
              <p className="mb-2 text-sm text-muted">Tartibni o‘q tugmalari bilan o‘zgartiring. Ichki band ({MAX_DEPTH} darajagacha) uchun “ichiga kiritish” yoki “+” tugmasidan foydalaning.</p>
              {trees[key].length === 0 ? (
                <p className="rounded-md border border-dashed border-line bg-surface p-6 text-center text-muted">Menyu bo‘sh. Birinchi bandni qo‘shing.</p>
              ) : (
                <Tree nodes={trees[key]} path={[]} depth={1} pageTitle={pageTitle} onAction={onAction} />
              )}
              <Button className="mt-4" variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setEditing({ path: [-1], node: emptyNode(), isNew: true, parentPath: [] })}>Band qo‘shish</Button>
            </div>
          )}
        </Tabs>
      </Card>
      {editing && <ItemModal node={editing.node} pages={pages} onClose={() => setEditing(null)} onSave={onSaveItem} />}
    </>
  );
}

export default function NavigationPage() {
  const q = useAdminNavigation();
  if (q.isPending) return <Loading />;
  if (q.isError) return <ErrorState title="Menyuni yuklab bo‘lmadi" text={q.error.message} onRetry={() => void q.refetch()} />;
  return <Editor data={q.data} />;
}
