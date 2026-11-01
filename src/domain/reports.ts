import type { TrackerData } from '../data/repository';
import { holdingContributions } from './holdings';

export const REPORT_TYPES = [
  { value: 'all', label: 'All data' },
  { value: 'income', label: 'Income' },
  { value: 'expenses', label: 'Expenses' },
  { value: 'contributions', label: 'Investment contributions' },
  { value: 'balances', label: 'Monthly balances' },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]['value'];

export interface ReportRow {
  date: string;
  group: string;
  name: string;
  detail: string;
  amount: number;
}

/** Records in a date range. Both dates are included. */
export function reportRows(data: TrackerData, start: string, end: string, type: ReportType) {
  const rows: ReportRow[] = [];
  const wants = (group: ReportType) => type === 'all' || type === group;
  const inRange = (date: string) => date >= start && date <= end;
  if (wants('income')) {
    for (const row of data.income) {
      if (inRange(row.date)) {
        rows.push({
          date: row.date,
          group: 'Income',
          name: row.source,
          detail: row.member,
          amount: row.amount,
        });
      }
    }
  }
  if (wants('expenses')) {
    for (const row of data.expenses) {
      if (inRange(row.date)) {
        rows.push({
          date: row.date,
          group: 'Expense',
          name: row.category,
          detail: row.subcategory || row.notes || '',
          amount: row.amount,
        });
      }
    }
  }
  if (wants('contributions')) {
    for (const holding of data.holdings) {
      for (const row of holdingContributions(holding.id, data.contributions)) {
        if (inRange(row.date)) {
          rows.push({
            date: row.date,
            group: 'Contribution',
            name: holding.name,
            detail: holding.member,
            amount: row.amount,
          });
        }
      }
    }
  }
  if (wants('balances')) {
    for (const row of data.monthlyBalances) {
      const date = `${row.month}-01`;
      if (inRange(date)) {
        rows.push({
          date,
          group: 'Opening balance',
          name: row.month,
          detail: '',
          amount: row.startBalance,
        });
      }
    }
  }
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export function groupTotals(rows: ReportRow[]) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.group, (totals.get(row.group) ?? 0) + row.amount);
  return [...totals].map(([group, amount]) => ({ group, amount }));
}

const csvCell = (value: string | number) => {
  const text = String(value);
  // A leading formula character would run in a spreadsheet, so it is neutralised.
  const safe = /^[=+\-@\t\r]/.test(text) && typeof value === 'string' ? `'${text}` : text;
  return /[",\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};

export function reportCsv(rows: ReportRow[]) {
  const header = ['Date', 'Type', 'Name', 'Details', 'Amount'];
  const body = rows.map((row) => [row.date, row.group, row.name, row.detail, row.amount]);
  return [header, ...body].map((row) => row.map(csvCell).join(',')).join('\n');
}
