import type { TrackerData } from '../data/repository';
import {
  investedFromIncome,
  isAnyHouseExpense,
  isEmi,
  netWorthHistory,
  trackingStart,
} from './analytics';
import { financialYearRange, nextMonth, previousMonth, roundMoney } from './calendar';
import { monthTotals } from './cashflow';

/**
 * A financial year at a glance, from the records with each closed month's unrecorded spending
 * counted: what came in, what went out, what was put away, and how net worth moved. Months
 * count from when tracking began, to the year's end or the last complete month.
 */
export interface YearSummary {
  fy: number;
  from: string;
  to: string;
  months: number;
  income: number;
  /** Spending, EMIs and unrecorded spending included. */
  spent: number;
  emis: number;
  invested: number;
  /** Income kept: not spent, as a share of income, or null with no income. */
  savingsRate: number | null;
  /** Net worth at the start of the year and now, when both are known. */
  netWorth: { start: number; end: number } | null;
  best: { month: string; rate: number } | null;
  worst: { month: string; rate: number } | null;
  topCategories: { category: string; amount: number }[];
  /** Paid into PPF and NPS this year, for tax time. */
  ppf: number;
  nps: number;
}

export function yearSummary(data: TrackerData, fy: number, today: string): YearSummary | null {
  const range = financialYearRange(fy);
  const since = trackingStart(data);
  const lastComplete = previousMonth(today.slice(0, 7));
  const fromMonth = since && since > range.start.slice(0, 7) ? since : range.start.slice(0, 7);
  // A year still running counts to today, so this year's figures aren't left empty.
  const toMonth = range.end.slice(0, 7) <= lastComplete ? range.end.slice(0, 7) : today.slice(0, 7);
  if (fromMonth > toMonth) return null;
  const months: string[] = [];
  for (let month = fromMonth; month <= toMonth; month = nextMonth(month)) months.push(month);
  const counted = new Set(months);
  const inYear = (row: { date: string }) => counted.has(row.date.slice(0, 7));

  const totals = monthTotals(data);
  const income = months.reduce((sum, month) => sum + (totals.get(month)?.income ?? 0), 0);
  const spent = months.reduce((sum, month) => sum + (totals.get(month)?.expenses ?? 0), 0);
  if (income === 0 && spent === 0) return null;
  const emis = data.expenses
    .filter((row) => inYear(row) && isEmi(row))
    .reduce((sum, row) => sum + row.amount, 0);
  const investedByMonth = investedFromIncome(data);
  const invested = months.reduce((sum, month) => sum + (investedByMonth.get(month) ?? 0), 0);

  // Best and worst complete months for keeping income.
  const rated = months
    .filter((month) => month <= lastComplete)
    .flatMap((month) => {
      const row = totals.get(month);
      return row && row.income > 0
        ? [{ month, rate: (row.income - row.expenses) / row.income }]
        : [];
    })
    .sort((a, b) => b.rate - a.rate);

  const byCategory = new Map<string, number>();
  // Recorded categories: unrecorded spending has no category to show.
  for (const row of data.expenses.filter(
    (row) => inYear(row) && !isEmi(row) && !isAnyHouseExpense(row),
  )) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount);
  }

  const history = netWorthHistory(data, today);
  const before = previousMonth(range.start.slice(0, 7));
  const startPoint = history.find((point) => point.month === before);
  const endPoint = [...history].reverse().find((point) => point.month <= toMonth);

  const paidInto = (kind: 'ppf' | 'nps') => {
    const ids = new Set(data.holdings.filter((row) => row.kind === kind).map((row) => row.id));
    return roundMoney(
      data.contributions
        .filter(
          (row) =>
            !row.skipped &&
            ids.has(row.holdingId) &&
            row.date >= range.start &&
            row.date <= range.end,
        )
        .reduce((sum, row) => sum + row.amount, 0),
    );
  };

  return {
    fy,
    from: fromMonth,
    to: toMonth,
    months: months.length,
    income: roundMoney(income),
    spent: roundMoney(spent),
    emis: roundMoney(emis),
    invested: roundMoney(invested),
    savingsRate: income > 0 ? (income - spent) / income : null,
    netWorth:
      startPoint && endPoint
        ? { start: roundMoney(startPoint.netWorth), end: roundMoney(endPoint.netWorth) }
        : null,
    best: rated.length >= 2 ? (rated[0] ?? null) : null,
    worst: rated.length >= 2 ? (rated.at(-1) ?? null) : null,
    topCategories: [...byCategory]
      .map(([category, amount]) => ({ category, amount: roundMoney(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3),
    ppf: paidInto('ppf'),
    nps: paidInto('nps'),
  };
}
