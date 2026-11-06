import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { PageHeader } from '../../ui/PageHeader';
import ui from '../../ui/ui.module.css';

/**
 * Planning in two halves: Insights looks back at what happened, Future plans ahead. Each has
 * its own tabs, so neither row gets too long for a phone.
 */
const SECTIONS = [
  {
    key: 'insights',
    label: 'Insights',
    tabs: [
      { to: '/analytics', label: 'Analytics', end: true },
      { to: '/analytics/income', label: 'Income', end: false },
      { to: '/analytics/reports', label: 'Date range reports', end: false },
    ],
  },
  {
    key: 'future',
    label: 'Future',
    tabs: [
      { to: '/analytics/projection', label: 'Growth projection', end: false },
      { to: '/analytics/goals', label: 'Goal planning', end: false },
      { to: '/analytics/budget', label: 'Yearly budget', end: false },
    ],
  },
] as const;

const HEADERS: Record<string, { eyebrow: string; title: string; subtitle: string }> = {
  '/analytics': {
    eyebrow: 'Insights',
    title: 'Analytics',
    subtitle:
      'Explore your portfolio, monthly cash flow, debt progress and recorded activity in one place.',
  },
  '/analytics/income': {
    eyebrow: 'Insights',
    title: 'Income',
    subtitle: "Where your money comes from, how it's changing, and where each rupee goes.",
  },
  '/analytics/reports': {
    eyebrow: 'Insights',
    title: 'Date range reports',
    subtitle: 'Every record for a period, with totals, a download, and a whole year at a glance.',
  },
  '/analytics/projection': {
    eyebrow: 'Future',
    title: 'Growth projection',
    subtitle:
      "Compare possible portfolio paths using today's investment values, contribution choices and return assumptions.",
  },
  '/analytics/goals': {
    eyebrow: 'Future',
    title: 'Goal planning',
    subtitle: "Save for what matters, from your real investments, and see whether you're on track.",
  },
  '/analytics/budget': {
    eyebrow: 'Future',
    title: 'Yearly budget',
    subtitle:
      'Plan the financial year: what you expect to spend, when the big bills fall, and how it goes.',
  },
};

export function AnalyticsLayout() {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/$/, '') || '/analytics';
  const section =
    SECTIONS.find((group) => group.tabs.some((tab) => tab.to === path)) ?? SECTIONS[0];
  const header = HEADERS[path] ?? HEADERS['/analytics'];
  return (
    <div className={ui.page}>
      {header ? (
        <PageHeader
          {...(path === '/analytics/projection'
            ? { action: <span className={ui.chip}>Projection starts today</span> }
            : {})}
          eyebrow={header.eyebrow}
          subtitle={header.subtitle}
          title={header.title}
        />
      ) : null}
      <nav aria-label="Planning sections" className={ui.segmented}>
        {SECTIONS.map((group) => (
          <Link
            aria-current={group.key === section.key ? 'page' : undefined}
            className={group.key === section.key ? ui.segmentActive : ui.segment}
            key={group.key}
            to={group.tabs[0].to}
          >
            {group.label}
          </Link>
        ))}
      </nav>
      <nav aria-label={`${section.label} sections`} className={ui.tabs}>
        {section.tabs.map(({ to, label, end }) => (
          <NavLink
            className={({ isActive }) => (isActive ? ui.tabActive : ui.tab)}
            end={end}
            key={to}
            to={to}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
