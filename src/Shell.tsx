import {
  ArrowUpDown,
  CreditCard,
  Home,
  LineChart,
  Moon,
  SlidersHorizontal,
  Sun,
  Wallet,
} from 'lucide-react';
import { lazy, Suspense, useEffect } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router';
import { Dashboard } from './features/dashboard/Dashboard';
import type { TrackerRepository } from './data/repository';
import { useSettings, useTracker } from './store/tracker';
import styles from './Shell.module.css';
import { localDate } from './ui/format';
import { ApprovalPrompt } from './ui/ApprovalPrompt';
import { Avatar } from './ui/Avatar';
import { DeviceApprovalPrompt } from './ui/DeviceApprovalPrompt';
import { GuidedTour } from './ui/GuidedTour';
import { PullToRefresh } from './ui/PullToRefresh';
import { PageSkeleton } from './ui/Skeleton';
import { Toast } from './ui/Toast';
import { Tooltip } from './ui/Tooltip';
import { PageEndTools } from './ui/SearchDialog';
import { useAppUpdate } from './ui/pwa';
import { useTheme } from './ui/theme';
import ui from './ui/ui.module.css';

const named = <Name extends string>(
  load: () => Promise<Record<Name, React.ComponentType>>,
  name: Name,
) => lazy(() => load().then((module) => ({ default: module[name] })));

const CashFlowPage = named(() => import('./features/cashflow/CashFlowPage'), 'CashFlowPage');
const InvestmentsPage = named(
  () => import('./features/investments/InvestmentsPage'),
  'InvestmentsPage',
);
const DebtsPage = named(() => import('./features/debts/DebtsPage'), 'DebtsPage');
const AnalyticsLayout = named(
  () => import('./features/analytics/AnalyticsLayout'),
  'AnalyticsLayout',
);
const AnalyticsPage = named(() => import('./features/analytics/AnalyticsPage'), 'AnalyticsPage');
const ProjectionPage = named(() => import('./features/analytics/ProjectionPage'), 'ProjectionPage');
const ReportsPage = named(() => import('./features/analytics/ReportsPage'), 'ReportsPage');
const SettingsPage = lazy(() =>
  import('./features/settings/SettingsPage').then(({ SettingsPage: Page }) => ({ default: Page })),
);

const LINKS = [
  { to: '/', label: 'Dashboard', short: 'Home', icon: Home },
  { to: '/cash-flow', label: 'Income & Expense', short: 'Cash flow', icon: ArrowUpDown },
  { to: '/investments', label: 'Investment', short: 'Investments', icon: Wallet },
  { to: '/debts', label: 'Debts', short: 'Debts', icon: CreditCard },
  { to: '/analytics', label: 'Analytics & Reports', short: 'Reports', icon: LineChart },
  { to: '/settings', label: 'Settings', short: 'Settings', icon: SlidersHorizontal },
];

export type FeedbackKind = 'feature' | 'problem';

export interface Account {
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer';
  photo?: string;
  signOut?: () => void;
  /** `clearMemberData` runs for a member, while they can still write. */
  deleteAccount?: (clearMemberData: () => Promise<void>) => Promise<void>;
  /** Sends a feature suggestion or problem report, without the sender's name or email. */
  sendFeedback?: (kind: FeedbackKind, text: string) => Promise<void>;
  family?: FamilyAccess;
  security?: AccountSecurity;
}

export interface DeviceApproval {
  id: string;
  device: string;
  code: string;
}

export interface AccountSecurity {
  changePassphrase(current: string, next: string): Promise<void>;
  newRecoveryCode(passphrase: string): Promise<string>;
  watchDevices(onChange: (requests: DeviceApproval[]) => void): () => void;
  approveDevice(request: DeviceApproval, passphrase?: string): Promise<void>;
  denyDevice(request: DeviceApproval): Promise<void>;
  passkey: {
    available(): Promise<boolean>;
    enabled(): boolean;
    enable(passphrase: string): Promise<void>;
    disable(): Promise<void>;
  };
}

export interface FamilyMember {
  email: string;
  role: 'editor' | 'viewer';
  accepted: boolean;
}

export interface FamilyRequest {
  uid: string;
  email: string;
  code: string;
}

export interface FamilyAccess {
  watchRequests(onChange: (requests: FamilyRequest[]) => void): () => void;
  approve(request: FamilyRequest): Promise<void>;
  deny(request: FamilyRequest): Promise<void>;
  list(): Promise<FamilyMember[]>;
  invite(email: string, role: FamilyMember['role']): Promise<void>;
  setRole(email: string, role: FamilyMember['role']): Promise<void>;
  remove(email: string): Promise<void>;
}

const PREVIEW_ACCOUNT: Account = {
  name: 'Preview',
  email: 'preview@example.test',
  role: 'owner',
};

export function Shell({
  repository,
  account = PREVIEW_ACCOUNT,
}: {
  repository: TrackerRepository;
  account?: Account;
}) {
  const connect = useTracker((state) => state.connect);
  const loaded = useTracker((state) => state.loaded);
  const error = useTracker((state) => state.error);
  const invalidRecords = useTracker((state) => state.invalidRecords);
  const runSchedules = useTracker((state) => state.runSchedules);
  const setAccessRequests = useTracker((state) => state.setAccessRequests);
  const profile = useTracker((state) => state.profile);
  const setProfile = useTracker((state) => state.setProfile);
  const settings = useSettings();
  const theme = useTheme((state) => state.theme);
  const toggle = useTheme((state) => state.toggle);
  const { updateReady, applyUpdate } = useAppUpdate();
  const tourOpen = useTracker((state) => state.tourOpen);

  useEffect(
    () => connect(repository, account.role !== 'viewer', account.email),
    [connect, repository, account.role, account.email],
  );

  // Scheduled contributions post once records have loaded, never during rendering.
  useEffect(() => {
    if (loaded) runSchedules(localDate());
  }, [loaded, runSchedules]);

  // A new title is how screen readers know the page changed.
  const { pathname } = useLocation();
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const heading = document.querySelector('main h1')?.textContent;
      document.title = heading ? `${heading} · Finance Tracker` : 'Personal Finance Tracker';
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, loaded]);

  const family = account?.family;
  useEffect(() => {
    const stop = family?.watchRequests(setAccessRequests);
    return () => {
      stop?.();
      setAccessRequests([]);
    };
  }, [family, setAccessRequests]);

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#main-content">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.brand}>
          <Avatar account={account} size={38} />
          {settings.familyMembers.length > 1 ? (
            <select
              aria-label="Family profile"
              className={styles.profile}
              onChange={(event) => setProfile(event.target.value || null)}
              value={profile ?? ''}
            >
              <option value="">My finances</option>
              {settings.familyMembers.map((member) => (
                <option key={member} value={member}>
                  {member}
                </option>
              ))}
            </select>
          ) : (
            <span>My finances</span>
          )}
        </div>
        <nav aria-label="Main" className={styles.nav}>
          {LINKS.map(({ to, label, short, icon: Icon }) => (
            <NavLink
              className={({ isActive }) =>
                `${isActive ? styles.active : styles.link} ${to === '/settings' ? styles.desktopOnly : ''}`
              }
              end={to === '/'}
              key={to}
              to={to}
            >
              <Icon aria-hidden="true" size={20} />
              <span className={styles.fullLabel}>{label}</span>
              <span className={styles.shortLabel}>{short}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.tools}>
          <button
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className={ui.iconButton}
            onClick={toggle}
            type="button"
            data-tip={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <NavLink
            aria-label="Settings"
            className={`${ui.iconButton} ${styles.mobileOnly}`}
            to="/settings"
          >
            <SlidersHorizontal size={18} />
          </NavLink>
        </div>
      </header>
      <main className={styles.main} id="main-content" tabIndex={-1}>
        {updateReady ? (
          <div className={`${ui.notice} ${ui.split}`} role="status">
            <span>Update available. Finish what you're typing, then update.</span>
            <button className={ui.quiet} onClick={applyUpdate} type="button">
              Update now
            </button>
          </div>
        ) : null}
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
          <Suspense fallback={<PageSkeleton label="Loading…" />}>
            <Routes>
              <Route element={<Dashboard />} path="/" />
              <Route element={<CashFlowPage />} path="/cash-flow" />
              <Route element={<InvestmentsPage />} path="/investments" />
              <Route element={<DebtsPage />} path="/debts" />
              <Route element={<AnalyticsLayout />} path="/analytics">
                <Route element={<AnalyticsPage />} index />
                <Route element={<ProjectionPage />} path="projection" />
                <Route element={<ReportsPage />} path="reports" />
              </Route>
              <Route element={<SettingsPage account={account} />} path="/settings" />
            </Routes>
          </Suspense>
        ) : (
          <PageSkeleton />
        )}
      </main>
      {loaded ? <PageEndTools /> : null}
      <Toast />
      {family ? <ApprovalPrompt family={family} /> : null}
      {account.security ? <DeviceApprovalPrompt security={account.security} /> : null}
      <Tooltip />
      <PullToRefresh />
      {tourOpen ? <GuidedTour /> : null}
    </div>
  );
}
