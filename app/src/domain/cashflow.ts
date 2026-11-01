import type { Expense, Income, MonthlyBalance } from '../schema/records';
import { nextMonth, previousMonth } from './calendar';

export interface CashflowData {
  income: Income[];
  expenses: Expense[];
  monthlyBalances: MonthlyBalance[];
}

export interface MonthTotals {
  income: number;
  expenses: number;
}

export interface MonthClose extends MonthTotals {
  month: string;
  opening: number | null;
  closing: number | null;
  available: number;
  /** Money spent beyond recorded expenses. Known only once both balances exist. */
  unrecorded: number | null;
  complete: boolean;
}

export function monthTotals({ income, expenses }: Pick<CashflowData, 'income' | 'expenses'>) {
  const totals = new Map<string, MonthTotals>();
  const ensure = (month: string) => {
    const existing = totals.get(month);
    if (existing) return existing;
    const created = { income: 0, expenses: 0 };
    totals.set(month, created);
    return created;
  };
  for (const row of income) ensure(row.date.slice(0, 7)).income += row.amount;
  for (const row of expenses) ensure(row.date.slice(0, 7)).expenses += row.amount;
  return totals;
}

/** `transfers` is money moved out to PMS, which reduces what is available. */
export function monthClose(data: CashflowData, month: string, transfers = 0): MonthClose {
  const totals = monthTotals(data).get(month) ?? { income: 0, expenses: 0 };
  const balances = new Map(data.monthlyBalances.map((row) => [row.month, row.startBalance]));
  const opening = balances.get(month) ?? null;
  const closing = balances.get(nextMonth(month)) ?? null;
  const available = (opening ?? 0) + totals.income - totals.expenses - transfers;
  const complete = opening !== null && closing !== null;
  return {
    month,
    ...totals,
    opening,
    closing,
    available,
    unrecorded: complete ? available - closing : null,
    complete,
  };
}

export interface MonthTrend extends MonthTotals {
  month: string;
}

/** The `count` months ending at `lastMonth`, oldest first. Empty months are included. */
export function monthlyTrend(
  data: Pick<CashflowData, 'income' | 'expenses'>,
  lastMonth: string,
  count: number,
): MonthTrend[] {
  const totals = monthTotals(data);
  const rows: MonthTrend[] = [];
  for (let month = lastMonth; rows.length < count; month = previousMonth(month)) {
    rows.unshift({ month, ...(totals.get(month) ?? { income: 0, expenses: 0 }) });
  }
  return rows;
}

export interface CategoryTotal {
  category: string;
  amount: number;
}

/** Largest categories in a month, with the rest folded into "Other". */
export function topCategories(expenses: Expense[], month: string, limit: number): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const row of expenses) {
    if (row.date.startsWith(month)) {
      totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount);
    }
  }
  const sorted = [...totals]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
  if (sorted.length <= limit) return sorted;
  const other = sorted.slice(limit).reduce((sum, row) => sum + row.amount, 0);
  return [...sorted.slice(0, limit), { category: 'Other', amount: other }];
}
