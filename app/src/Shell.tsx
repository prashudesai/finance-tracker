import { ArrowUpDown, Landmark, LayoutDashboard, LogOut, Moon, Receipt, Sun } from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import logo from './assets/logo.png';
import { Dashboard } from './features/dashboard/Dashboard';
import type { TrackerRepository } from './data/repository';
import { useTracker } from './store/tracker';
import styles from './Shell.module.css';
import { useTheme } from './ui/theme';
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
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/income', label: 'Income', icon: ArrowUpDown },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/loans', label: 'Loans', icon: Landmark },
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
  const { theme, toggle } = useTheme();

  useEffect(() => connect(repository), [connect, repository]);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img alt="" className={styles.logo} height="36" src={logo} width="36" />
          My finances
        </div>
        <nav aria-label="Main" className={styles.nav}>
          {LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              className={({ isActive }) => (isActive ? styles.active : styles.link)}
              end={to === '/'}
              key={to}
              to={to}
            >
              <Icon aria-hidden="true" size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.tools}>
          <button
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className={ui.iconButton}
            onClick={toggle}
            type="button"
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {onSignOut ? (
            <button
              aria-label="Sign out"
              className={ui.iconButton}
              onClick={onSignOut}
              type="button"
            >
              <LogOut size={18} />
            </button>
          ) : null}
        </div>
      </header>
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
