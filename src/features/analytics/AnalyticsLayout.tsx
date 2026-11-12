import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { PageHeader } from '../../ui/PageHeader';
import ui from '../../ui/ui.module.css';
import styles from './AnalyticsLayout.module.css';
import { SECTIONS } from './sections';

const HEADERS: Record<string, { eyebrow: string; title: string; subtitle: string }> = {
  '/analytics': {
    eyebrow: 'Insights',
    title: 'Analytics',
    subtitle:
      'Explore your portfolio, monthly cash flow, debt progress and recorded activity in one place.',
  },
  '/analytics/mix': {
    eyebrow: 'Insights',
    title: 'Portfolio mix',
    subtitle:
      'What your investments are made of, how that compares with a common guide, and ways to balance it.',
  },
  '/analytics/income': {
    eyebrow: 'Insights',
    title: 'Income',
    subtitle: "Where your money comes from, how it's changing, and where each rupee goes.",
  },
  '/analytics/budget-actual': {
    eyebrow: 'Insights',
    title: 'Budget vs actual',
    subtitle: 'Your yearly budget against what you actually spent, by category and month.',
  },
  '/analytics/reports': {
    eyebrow: 'Insights',
    title: 'Date range reports',
    subtitle: 'Every record for a period, with totals, a download, and a whole year at a glance.',
  },
  '/analytics/overview': {
    eyebrow: 'Future',
    title: 'Plan',
    subtitle: "Your goals, this year's budget and where your money is heading, at a glance.",
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
      {/* On desktop, Future and Insights are tabs of their own in the top bar instead. */}
      <nav aria-label="Planning sections" className={`${ui.segmented} ${styles.switch}`}>
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
