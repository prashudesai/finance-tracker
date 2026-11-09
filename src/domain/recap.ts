import type { TrackerData } from '../data/repository';
import {
  isEmi,
  isRepayment,
  netWorthHistory,
  repaymentsByMonth,
  withoutRepayments,
} from './analytics';
import { lastDayOfMonth, previousMonth, roundMoney } from './calendar';
import { monthTotals } from './cashflow';

export interface RecapCategory {
  category: string;
  amount: number;
  /** The same category the month before, or null when it had none. */
  previous: number | null;
}

export interface MonthRecap {
  month: string;
  income: number;
  /** Spending, loan repayments left out. */
  expenses: number;
  /** Loan EMIs and part payments, which aren't spending. */
  repaid: number;
  /** Income less spending and loan repayments. */
  saved: number;
  /** Share of income left after spending and repayments, or null without income. */
  savingsRate: number | null;
  previous: { income: number; expenses: number; savingsRate: number | null } | null;
  categories: RecapCategory[];
  incomeSources: { source: string; amount: number }[];
  biggest: { category: string; amount: number; date: string; note: string } | null;
  emiPaid: number;
  invested: number;
  netWorth: { start: number; end: number } | null;
  records: number;
}

const CATEGORIES = 5;
const SOURCES = 3;
const rate = (income: number, expenses: number) =>
  income > 0 ? (income - expenses) / income : null;

/** Months that have income or spending, newest first, up to and including `latest`. */
export function recapMonths(data: TrackerData, latest: string) {
  return [...new Set([...data.income, ...data.expenses].map((row) => row.date.slice(0, 7)))]
    .filter((month) => month <= latest)
    .sort()
    .reverse();
}

/** One month in numbers. Nothing is stored; it's worked out from records each time. */
export function monthRecap(data: TrackerData, month: string, today: string): MonthRecap {
  // Spending leaves out loan repayments, shown on their own; what was kept takes both off.
  const repaid = repaymentsByMonth(data);
  const totals = monthTotals(withoutRepayments(data));
  const repaidNow = repaid.get(month) ?? 0;
  const repaidBefore = repaid.get(previousMonth(month)) ?? 0;
  const current = totals.get(month) ?? { income: 0, expenses: 0 };
  const before = totals.get(previousMonth(month));
  const inMonth = (date: string) => date.startsWith(month);
  const inPrevious = (date: string) => date.startsWith(previousMonth(month));

  const byCategory = (match: (date: string) => boolean) => {
    const map = new Map<string, number>();
    for (const row of data.expenses) {
      if (!match(row.date) || isRepayment(row, data.loans)) continue;
      map.set(row.category, (map.get(row.category) ?? 0) + row.amount);
    }
    return map;
  };
  const now = byCategory(inMonth);
  const prior = byCategory(inPrevious);
  const categories = [...now]
    .sort((a, b) => b[1] - a[1])
    .slice(0, CATEGORIES)
    .map(([category, amount]) => ({
      category,
      amount: roundMoney(amount),
      previous: prior.has(category) ? roundMoney(prior.get(category) ?? 0) : null,
    }));

  const sources = new Map<string, number>();
  for (const row of data.income) {
    if (inMonth(row.date)) sources.set(row.source, (sources.get(row.source) ?? 0) + row.amount);
  }

  const spending = data.expenses.filter((row) => inMonth(row.date));
  const top = spending.filter((row) => !isEmi(row)).sort((a, b) => b.amount - a.amount)[0];

  // Net worth at the end of the month before, and at this month's end (or today).
  const history = netWorthHistory(data, today);
  const end = history.find((point) => point.month === month);
  const start = history.find((point) => point.month === previousMonth(month));

  const invested = data.contributions
    .filter((row) => !row.skipped && inMonth(row.date))
    .reduce((total, row) => total + row.amount, 0);

  return {
    month,
    income: roundMoney(current.income),
    expenses: roundMoney(current.expenses),
    repaid: roundMoney(repaidNow),
    saved: roundMoney(current.income - current.expenses - repaidNow),
    savingsRate: rate(current.income, current.expenses + repaidNow),
    previous: before
      ? {
          income: roundMoney(before.income),
          expenses: roundMoney(before.expenses),
          savingsRate: rate(before.income, before.expenses + repaidBefore),
        }
      : null,
    categories,
    incomeSources: [...sources]
      .sort((a, b) => b[1] - a[1])
      .slice(0, SOURCES)
      .map(([source, amount]) => ({ source, amount: roundMoney(amount) })),
    biggest: top
      ? {
          category: top.subcategory || top.category,
          amount: top.amount,
          date: top.date,
          note: top.notes ?? '',
        }
      : null,
    emiPaid: roundMoney(spending.filter(isEmi).reduce((total, row) => total + row.amount, 0)),
    invested: roundMoney(invested),
    netWorth: end && start ? { start: start.netWorth, end: end.netWorth } : null,
    records: data.income.filter((row) => inMonth(row.date)).length + spending.length,
  };
}

/** The last day the recap covers: the month's end, or today for the running month. */
export const recapEnd = (month: string, today: string) =>
  today.startsWith(month) ? today : lastDayOfMonth(month);
