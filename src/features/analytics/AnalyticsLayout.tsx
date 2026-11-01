import { NavLink, Outlet, useLocation } from 'react-router';
import { PageHeader } from '../../ui/PageHeader';
import ui from '../../ui/ui.module.css';

const TABS = [
  { to: '/analytics', label: 'Analytics', end: true },
  { to: '/analytics/projection', label: 'Growth Projection', end: false },
  { to: '/analytics/reports', label: 'Date range reports', end: false },
];

export function AnalyticsLayout() {
  const { pathname } = useLocation();
  const projection = pathname.startsWith('/analytics/projection');
  return (
    <div className={ui.page}>
      {projection ? (
        <PageHeader
          action={<span className={ui.chip}>Projection starts today</span>}
          eyebrow="Plan ahead"
          subtitle="Compare possible portfolio paths using today's investment values, contribution choices and return assumptions."
          title="Growth Projection"
        />
      ) : (
        <PageHeader
          eyebrow="Financial insights"
          subtitle="Explore your portfolio, monthly cash flow, debt progress and recorded activity in one place."
          title="Analytics"
        />
      )}
      <nav aria-label="Analytics sections" className={ui.tabs}>
        {TABS.map(({ to, label, end }) => (
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
