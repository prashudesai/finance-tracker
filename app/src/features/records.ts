import { formatMonth } from '../ui/format';

/** Newest month first, with each month's rows newest first. */
export function groupByMonth<Row extends { date: string }>(rows: Row[]) {
  const groups = new Map<string, Row[]>();
  for (const row of [...rows].sort((a, b) => b.date.localeCompare(a.date))) {
    const month = row.date.slice(0, 7);
    const group = groups.get(month);
    if (group) group.push(row);
    else groups.set(month, [row]);
  }
  return [...groups].map(([month, items]) => ({ month, label: formatMonth(month), items }));
}
