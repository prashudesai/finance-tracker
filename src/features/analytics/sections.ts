/**
 * Planning in two halves: Insights looks back at what happened, Future plans ahead. Each has
 * its own tabs, so neither row gets too long for a phone.
 */
export const SECTIONS = [
  {
    key: 'future',
    label: 'Future',
    tabs: [
      { to: '/analytics/overview', label: 'Overview', end: false },
      { to: '/analytics/projection', label: 'Growth projection', end: false },
      { to: '/analytics/goals', label: 'Goal planning', end: false },
      { to: '/analytics/budget', label: 'Yearly budget', end: false },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    tabs: [
      { to: '/analytics', label: 'Analytics', end: true },
      { to: '/analytics/mix', label: 'Portfolio mix', end: false },
      { to: '/analytics/income', label: 'Income', end: false },
      { to: '/analytics/budget-actual', label: 'Budget vs actual', end: false },
      { to: '/analytics/reports', label: 'Date range reports', end: false },
    ],
  },
] as const;

/** Which half of Planning a page belongs to, for lighting the right tab. */
export function planningSection(pathname: string): 'future' | 'insights' | null {
  const path = pathname.replace(/\/$/, '');
  if (!path.startsWith('/analytics')) return null;
  return SECTIONS.find((group) => group.tabs.some((tab) => tab.to === path))?.key ?? 'future';
}
