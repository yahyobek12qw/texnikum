import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PAGE_TEMPLATE_LABELS, type AdminPage } from '@uchkoprik/shared';
import { buttonClass } from '../../components/ui/Button';
import { pagesApi } from '../api';
import { ListResult, PageTitle, SearchBox, StatusBadge, StatusFilter, Toolbar, TranslationBadges, fmtDate, useListParams, type Column } from '../components/common';
import { RowButtons, useRowActions } from '../components/row-actions';

export default function PagesListPage() {
  const p = useListParams();
  const query = pagesApi.useList({ page: p.page, pageSize: 20, q: p.get('q') || undefined, status: p.get('status') || undefined });
  const actions = useRowActions<AdminPage>({ action: pagesApi.useAction(), remove: pagesApi.useRemove(), noun: 'Sahifa', title: (r) => r.title });

  const columns: Column<AdminPage>[] = [
    {
      header: 'Sarlavha',
      cell: (r) => (
        <div>
          <Link to={`/admin/pages/${r.id}`} className="font-medium">{r.title}</Link>
          <p className="text-xs text-muted">/{r.translations.uz?.slug}{r.parentTitle ? ` · Bo‘lim: ${r.parentTitle}` : ''}</p>
        </div>
      ),
    },
    { header: 'Shablon', cell: (r) => <span className="text-muted">{PAGE_TEMPLATE_LABELS[r.template].split(' (')[0]}</span> },
    { header: 'Tillar', cell: (r) => <TranslationBadges status={r.translationStatus} /> },
    { header: 'Holat', cell: (r) => <StatusBadge status={r.status} /> },
    { header: 'Yangilangan', cell: (r) => <span className="whitespace-nowrap text-muted">{fmtDate(r.updatedAt)}</span> },
    { header: 'Amallar', cell: (r) => <RowButtons row={r} status={r.status} editTo={`/admin/pages/${r.id}`} previewTo={`/admin/preview/page/${r.id}`} actions={actions} /> },
  ];

  return (
    <>
      <PageTitle title="Sahifalar" actions={<Link to="/admin/pages/new" className={buttonClass('primary')}><Plus className="h-4 w-4" aria-hidden />Yangi sahifa</Link>} />
      <Toolbar>
        <SearchBox value={p.get('q')} onChange={(v) => p.set({ q: v || null })} placeholder="Sarlavha yoki slug bo‘yicha qidirish…" />
        <StatusFilter value={p.get('status')} onChange={(v) => p.set({ status: v || null })} />
      </Toolbar>
      <ListResult
        query={query}
        columns={columns}
        rowKey={(r) => r.id}
        emptyTitle={p.get('q') || p.get('status') ? 'Hech narsa topilmadi' : 'Hozircha sahifalar mavjud emas'}
        emptyText={p.get('q') || p.get('status') ? 'Filtrlarni o‘zgartirib ko‘ring.' : 'Birinchi sahifani yarating.'}
        emptyAction={<Link to="/admin/pages/new" className={buttonClass('primary')}>Yangi sahifa</Link>}
        onPage={(n) => p.set({ page: n > 1 ? String(n) : null }, false)}
      />
      {actions.dialog}
    </>
  );
}
