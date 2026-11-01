import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import ui from '../../ui/ui.module.css';

const PAGE_SIZE = 8;

export interface Column<Row> {
  header: string;
  numeric?: boolean;
  cell: (row: Row) => ReactNode;
}

export function HistoryTable<Row extends { id: string }>({
  title,
  action,
  rows,
  columns,
  total,
  emptyText,
  describe,
  onEdit,
  onDelete,
}: {
  title: string;
  action?: ReactNode;
  rows: Row[];
  columns: Column<Row>[];
  total: string;
  emptyText: string;
  describe: (row: Row) => string;
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const start = current * PAGE_SIZE;
  const visible = rows.slice(start, start + PAGE_SIZE);

  return (
    <section className={ui.card}>
      <div className={ui.cardHeader}>
        <h2 style={{ fontSize: '1.3rem' }}>{title}</h2>
        {action}
      </div>
      <div className={`${ui.metric} ${ui.split}`} style={{ padding: '8px 12px' }}>
        <span className={ui.caption}>
          {rows.length} {rows.length === 1 ? 'entry' : 'entries'} in selected month
        </span>
        <strong>{total}</strong>
      </div>
      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th className={column.numeric ? ui.numeric : undefined} key={column.header}>
                  {column.header}
                </th>
              ))}
              <th className={ui.numeric}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => (
                  <td className={column.numeric ? ui.numeric : undefined} key={column.header}>
                    {column.cell(row)}
                  </td>
                ))}
                <td>
                  <div className={ui.tableActions}>
                    <button
                      aria-label={`Edit ${describe(row)}`}
                      className={ui.smallIcon}
                      onClick={() => onEdit(row)}
                      type="button"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      aria-label={`Delete ${describe(row)}`}
                      className={ui.smallIcon}
                      onClick={() => onDelete(row)}
                      type="button"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: 32 }}>
                  {emptyText}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className={ui.pager}>
        <span>
          Showing {rows.length === 0 ? 0 : start + 1}–{start + visible.length} of {rows.length}{' '}
          entries
        </span>
        <div className={ui.actions}>
          <button
            aria-label="Previous page"
            className={ui.smallIcon}
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            type="button"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            aria-label="Next page"
            className={ui.smallIcon}
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
            type="button"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}
