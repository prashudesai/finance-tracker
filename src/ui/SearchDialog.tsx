import { Search } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { searchRecords, SEARCH_KINDS, type SearchKind } from '../domain/search';
import { useView } from '../store/tracker';
import { Field } from './Field';
import { formatDay, formatMoney, localDate } from './format';
import { Modal } from './Modal';
import styles from '../Shell.module.css';
import ui from './ui.module.css';

function SearchPanel({ onClose }: { onClose: () => void }) {
  const data = useView();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>('all');
  const { total, results } = searchRecords(data, query, kind, localDate());

  return (
    <div className={ui.page}>
      <div className={ui.form}>
        <Field label="Search by name, category, date or amount">
          <input
            autoFocus
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try salary, groceries or 25,000"
            type="search"
            value={query}
          />
        </Field>
        <Field label="Record type">
          <select onChange={(event) => setKind(event.target.value as SearchKind)} value={kind}>
            {SEARCH_KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className={ui.caption} role="status">
        {query.trim().length < 2
          ? 'Type at least two characters.'
          : total > results.length
            ? `Showing ${results.length} of ${total} matches.`
            : `${total} ${total === 1 ? 'match' : 'matches'}.`}
      </p>
      <ul className={ui.list}>
        {results.map((row) => (
          <li className={ui.row} key={`${row.kind}-${row.id}`}>
            <div className={ui.rowMain}>
              <div className={ui.rowTitle}>{row.title}</div>
              <div className={ui.rowDetail}>
                {row.detail} · {formatDay(row.date)} {row.date.slice(0, 4)}
              </div>
            </div>
            <span className={ui.amount}>{formatMoney(row.amount)}</span>
            <button
              className={ui.quiet}
              onClick={() => {
                onClose();
                void navigate(row.path);
              }}
              type="button"
            >
              Open
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SearchButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        aria-label="Search records"
        className={styles.searchButton}
        onClick={() => setOpen(true)}
        title="Search records"
        type="button"
      >
        <Search size={20} />
      </button>
      {open ? (
        <Modal onClose={() => setOpen(false)} title="Find a record">
          <SearchPanel onClose={() => setOpen(false)} />
        </Modal>
      ) : null}
    </>
  );
}
