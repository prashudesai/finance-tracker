import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import { Dashboard } from './features/dashboard/Dashboard';
import type { TrackerRepository } from './data/repository';
import { useTracker } from './store/tracker';
import styles from './Shell.module.css';
import ui from './ui/ui.module.css';

const IncomePage = lazy(() =>
  import('./features/income/IncomePage').then(({ IncomePage }) => ({ default: IncomePage })),
);
const ExpensesPage = lazy(() =>
  import('./features/expenses/ExpensesPage').then(({ ExpensesPage }) => ({
    default: ExpensesPage,
  })),
);
const LoansPage = lazy(() =>
  import('./features/loans/LoansPage').then(({ LoansPage }) => ({ default: LoansPage })),
);

const LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/income', label: 'Income' },
  { to: '/expenses', label: 'Expenses' },
  { to: '/loans', label: 'Loans' },
];

export function Shell({
  repository,
  onSignOut,
}: {
  repository: TrackerRepository;
  onSignOut?: () => void;
}) {
  const connect = useTracker((state) => state.connect);
  const loaded = useTracker((state) => state.loaded);
  const error = useTracker((state) => state.error);
  const invalidRecords = useTracker((state) => state.invalidRecords);

  useEffect(() => connect(repository), [connect, repository]);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <span className={styles.brand}>Finance Tracker</span>
        {onSignOut ? (
          <button className={ui.quiet} onClick={onSignOut} type="button">
            Sign out
          </button>
        ) : null}
      </header>
      <nav aria-label="Main" className={styles.nav}>
        {LINKS.map(({ to, label }) => (
          <NavLink
            className={({ isActive }) => (isActive ? styles.active : styles.link)}
            end={to === '/'}
            key={to}
            to={to}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className={styles.main}>
        {error ? (
          <p className={ui.notice} role="alert">
            {error}
          </p>
        ) : null}
        {invalidRecords > 0 ? (
          <p className={ui.notice} role="status">
            {invalidRecords} saved record(s) could not be read and are hidden.
          </p>
        ) : null}
        {loaded ? (
          <Suspense fallback={<p className={ui.empty}>Loading…</p>}>
            <Routes>
              <Route element={<Dashboard />} path="/" />
              <Route element={<IncomePage />} path="/income" />
              <Route element={<ExpensesPage />} path="/expenses" />
              <Route element={<LoansPage />} path="/loans" />
            </Routes>
          </Suspense>
        ) : (
          <p className={ui.empty}>Loading your records…</p>
        )}
      </main>
    </div>
  );
}
