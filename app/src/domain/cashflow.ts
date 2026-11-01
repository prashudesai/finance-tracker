import type { Expense, Income, MonthlyBalance } from '../schema/records';
import { nextMonth } from './calendar';

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

export function monthClose(data: CashflowData, month: string): MonthClose {
  const totals = monthTotals(data).get(month) ?? { income: 0, expenses: 0 };
  const balances = new Map(data.monthlyBalances.map((row) => [row.month, row.startBalance]));
  const opening = balances.get(month) ?? null;
  const closing = balances.get(nextMonth(month)) ?? null;
  const available = (opening ?? 0) + totals.income - totals.expenses;
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
