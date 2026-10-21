import { Plus, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { type AdminNews, type NewsType } from '@uchkoprik/shared';
import { buttonClass } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Feedback';
import { Select } from '../../components/ui/Form';
import { categoriesApi, newsApi } from '../api';
import { ListResult, PageTitle, SearchBox, StatusBadge, StatusFilter, Toolbar, TranslationBadges, fmtDate, useListParams, type Column } from '../components/common';
import { RowButtons, useRowActions } from '../components/row-actions';

const TITLES: Record<NewsType, { title: string; noun: string; newLabel: string; empty: string }> = {
  NEWS: { title: 'Yangiliklar', noun: 'Yangilik', newLabel: 'Yangi yangilik', empty: 'Hozircha yangiliklar mavjud emas' },
  ANNOUNCEMENT: { title: 'E’lonlar', noun: 'E’lon', newLabel: 'Yangi e’lon', empty: 'Hozircha e’lonlar mavjud emas' },
  EVENT: { title: 'Tadbirlar', noun: 'Tadbir', newLabel: 'Yangi tadbir', empty: 'Hozircha tadbirlar mavjud emas' },
};

export default function NewsListPage({ type }: { type: NewsType }) {
  const meta = TITLES[type];
  const p = useListParams();
  const query = newsApi.useList({ page: p.page, pageSize: 20, type, q: p.get('q') || undefined, status: p.get('status') || undefined, categoryId: p.get('categoryId') || undefined });
  const categories = categoriesApi.useList<{ items: { id: string; name: string }[] }>({ scope: 'NEWS' });
  const actions = useRowActions<AdminNews>({ action: newsApi.useAction(), remove: newsApi.useRemove(), noun: meta.noun, title: (r) => r.title });
  const newTo = `/admin/news/new?type=${type}`;

  const columns: Column<AdminNews>[] = [
    {
      header: 'Sarlavha',
      cell: (r) => (
        <div>
          <Link to={`/admin/news/${r.id}`} className="font-medium">{r.title}</Link>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
            /{r.translations.uz?.slug}
            {r.isImportant && <Badge tone="warn"><Star className="mr-1 h-3 w-3" aria-hidden />Muhim</Badge>}
          </p>
        </div>
      ),
    },
    { header: 'Kategoriya', cell: (r) => <span className="text-muted">{r.categoryName ?? '—'}</span> },
    { header: 'Tillar', cell: (r) => <TranslationBadges status={r.translationStatus} /> },
    { header: 'Holat', cell: (r) => <StatusBadge status={r.status} scheduledAt={r.scheduledAt} /> },
    { header: 'Nashr sanasi', cell: (r) => <span className="whitespace-nowrap text-muted">{fmtDate(r.publishedAt)}</span> },
    { header: 'Amallar', cell: (r) => <RowButtons row={r} status={r.status} editTo={`/admin/news/${r.id}`} previewTo={`/admin/preview/news/${r.id}`} actions={actions} /> },
  ];

  return (
    <>
      <PageTitle title={meta.title} actions={<Link to={newTo} className={buttonClass('primary')}><Plus className="h-4 w-4" aria-hidden />{meta.newLabel}</Link>} />
      <Toolbar>
        <SearchBox value={p.get('q')} onChange={(v) => p.set({ q: v || null })} placeholder="Sarlavha yoki slug bo‘yicha qidirish…" />
        <StatusFilter value={p.get('status')} onChange={(v) => p.set({ status: v || null })} />
        <div>
          <label htmlFor="cat-filter" className="sr-only">Kategoriya</label>
          <Select id="cat-filter" value={p.get('categoryId')} onChange={(e) => p.set({ categoryId: e.target.value || null })} className="min-w-44">
            <option value="">Barcha kategoriyalar</option>
            {categories.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
      </Toolbar>
      <ListResult
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        emptyTitle={p.get('q') || p.get('status') || p.get('categoryId') ? 'Hech narsa topilmadi' : meta.empty}
        emptyText="Filtrlarni o‘zgartiring yoki yangisini yarating."
        emptyAction={<Link to={newTo} className={buttonClass('primary')}>{meta.newLabel}</Link>}
        onPage={(n) => p.set({ page: n > 1 ? String(n) : null }, false)}
      />
      {actions.dialog}
    </>
  );
}
