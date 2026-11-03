import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Modal } from '../../ui/Modal';
import ui from '../../ui/ui.module.css';
import { SortHeader, useSort, type SortValue } from '../../ui/useSort';

const PAGE_SIZE = 8;

export interface Column<Row> {
  header: string;
  numeric?: boolean;
  /** Left out of the table on phones, where it shows in the record's modal instead. */
  secondary?: boolean;
  cell: (row: Row) => ReactNode;
  /** A fuller value for the record's modal. */
  detail?: (row: Row) => ReactNode;
  sortValue: (row: Row) => SortValue;
}

export function HistoryTable<Row extends { id: string }>({
  title,
  action,
  rows,
  columns,
  total,
  emptyText,
  describe,
  details,
  onEdit,
  onDelete,
  openId = null,
}: {
  title: string;
  action?: ReactNode;
  rows: Row[];
  columns: Column<Row>[];
  total: string;
  emptyText: string;
  describe: (row: Row) => string;
  /** Extra label and value pairs shown only in the record's modal. */
  details?: (row: Row) => [string, string][];
  onEdit: (row: Row) => void;
  onDelete: (row: Row) => void;
  /** A record to show straight away, such as one chosen in Search. */
  openId?: string | null;
}) {
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(openId);
  useEffect(() => setSelectedId(openId), [openId]);
  const selected = rows.find((row) => row.id === selectedId);

  const valueOf = useCallback(
    (row: Row, header: string) =>
      columns.find((column) => column.header === header)?.sortValue(row) ?? '',
    [columns],
  );
  const { sorted, sort, toggle } = useSort<Row, string>(rows, valueOf);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const start = current * PAGE_SIZE;
  const visible = sorted.slice(start, start + PAGE_SIZE);

  return (
    <section className={ui.card}>
      <div className={ui.cardHeader}>
        <h2 style={{ fontSize: '1.3rem' }}>{title}</h2>
        {action}
      </div>
      <div className={`${ui.metric} ${ui.split}`} style={{ padding: '8px 12px' }}>
        <span className={ui.caption}>
          {sorted.length} {sorted.length === 1 ? 'entry' : 'entries'} in selected month
        </span>
        <strong>{total}</strong>
      </div>
      <div aria-label="Scrollable table" className={ui.tableWrap} role="group" tabIndex={0}>
        <table className={ui.table}>
          <thead>
            <tr>
              {columns.map((column) => (
                <SortHeader
                  className={column.secondary ? ui.hideOnPhone : undefined}
                  column={column.header}
                  key={column.header}
                  label={column.header}
                  numeric={column.numeric ?? false}
                  onSort={toggle}
                  sort={sort}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr className={ui.clickableRow} key={row.id} onClick={() => setSelectedId(row.id)}>
                {columns.map((column, index) => (
                  <td
                    className={`${column.numeric ? ui.numeric : ''} ${column.secondary ? ui.hideOnPhone : ''}`}
                    key={column.header}
                  >
                    {index === 0 ? (
                      <button
                        className={ui.rowOpen}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedId(row.id);
                        }}
                        type="button"
                      >
                        <span className={ui.visuallyHidden}>Open {describe(row)}, </span>
                        {column.cell(row)}
                      </button>
                    ) : (
                      column.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: 32 }}>
                  {emptyText}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className={ui.pager}>
        <span>
          Showing {sorted.length === 0 ? 0 : start + 1}–{start + visible.length} of {sorted.length}{' '}
          entries
        </span>
        <div className={ui.actions}>
          <button
            aria-label="Previous page"
            className={ui.smallIcon}
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            type="button"
            data-tip="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            aria-label="Next page"
            className={ui.smallIcon}
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
            type="button"
            data-tip="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
      {selected ? (
        <Modal onClose={() => setSelectedId(null)} title={describe(selected)}>
          <div className={ui.page}>
            <dl className={ui.detailList}>
              {columns.map((column) => (
                <div key={column.header}>
                  <dt>{column.header}</dt>
                  <dd>{column.detail?.(selected) ?? column.cell(selected)}</dd>
                </div>
              ))}
              {details?.(selected).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className={ui.formActions}>
              <button
                className={ui.quiet}
                onClick={() => {
                  setSelectedId(null);
                  onDelete(selected);
                }}
                type="button"
              >
                <Trash2 size={16} /> Delete
              </button>
              <button
                className={ui.button}
                onClick={() => {
                  setSelectedId(null);
                  onEdit(selected);
                }}
                type="button"
              >
                <Pencil size={16} /> Edit
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
