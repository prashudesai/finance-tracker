import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { searchRecords, SEARCH_KINDS, type SearchKind } from '../domain/search';
import { useTracker, useView } from '../store/tracker';
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

/** True once someone reaches the page bottom, as the older app showed these controls. */
function useAtPageBottom() {
  const [atBottom, setAtBottom] = useState(false);

  useEffect(() => {
    let reached = false;
    const isAtBottom = () =>
      window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 24;
    const update = () => setAtBottom(isAtBottom() && (window.scrollY > 0 || reached));
    const intent = () => {
      if (isAtBottom()) reached = true;
      update();
    };
    window.addEventListener('scroll', intent, { passive: true });
    window.addEventListener('wheel', intent, { passive: true });
    window.addEventListener('touchend', intent, { passive: true });
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    return () => {
      window.removeEventListener('scroll', intent);
      window.removeEventListener('wheel', intent);
      window.removeEventListener('touchend', intent);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);

  return atBottom;
}

function syncLabel(pending: number, online: boolean, syncedAt: Date | null) {
  if (!online) return pending > 0 ? 'Offline · will sync later' : 'Offline';
  if (pending > 0) return 'Saving…';
  if (!syncedAt) return 'Connecting…';
  const time = syncedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `Synced ${time}`;
}

export function PageEndTools() {
  const [open, setOpen] = useState(false);
  const atBottom = useAtPageBottom();
  const pending = useTracker((state) => state.pendingSaves);
  const syncedAt = useTracker((state) => state.syncedAt);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  return (
    <>
      <button
        aria-label="Search records"
        className={atBottom ? styles.searchVisible : styles.search}
        onClick={() => setOpen(true)}
        title="Search records"
        type="button"
      >
        <Search size={20} />
      </button>
      <span className={atBottom ? styles.syncVisible : styles.sync}>
        {syncLabel(pending, online, syncedAt)}
      </span>
      {open ? (
        <Modal onClose={() => setOpen(false)} title="Find a record">
          <SearchPanel onClose={() => setOpen(false)} />
        </Modal>
      ) : null}
    </>
  );
}
