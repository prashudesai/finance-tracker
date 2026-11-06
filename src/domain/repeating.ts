import type { TrackerData } from '../data/repository';
import { isAnyHouseExpense } from './analytics';
import { nextMonth, previousMonth, roundMoney } from './calendar';
import { amountAt } from './recurring';

/**
 * Expenses that look like they repeat each month but aren't on a schedule yet: the same
 * category and description, about the same amount, on about the same day, in most of the
 * last few complete months. Making one a schedule records it automatically from then on.
 */
export interface RepeatingExpense {
  /** Stable while the pattern lasts, for "not regular" to remember. */
  key: string;
  name: string;
  category: string;
  subcategory: string;
  amount: number;
  /** Day of the month it usually falls on. */
  day: number;
  /** In how many of the months looked at. */
  months: number;
  of: number;
  /** The first month a schedule would post, after the latest one already recorded. */
  startMonth: string;
}

/** Complete months looked back over, and how many of them must have it. */
const WINDOW = 4;
const NEEDED = 3;
/** How far amounts and days may drift and still be the same payment. */
const AMOUNT_DRIFT = 0.05;
const DAY_DRIFT = 5;

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
};

export function repeatingExpenses(data: TrackerData, today: string): RepeatingExpense[] {
  const current = today.slice(0, 7);
  const window: string[] = [];
  for (let month = previousMonth(current); window.length < WINDOW; month = previousMonth(month)) {
    window.unshift(month);
  }
  const first = window[0] ?? current;
  // Everyday expenses only: not loan EMIs, not already scheduled, not worked out from balances.
  const rows = data.expenses.filter(
    (row) =>
      row.date.slice(0, 7) >= first &&
      !row.loanId &&
      !row.recurringRuleId &&
      !row.isAnnual &&
      !isAnyHouseExpense(row),
  );
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.category}|${row.subcategory.trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const scheduled = data.recurringRules.filter(
    (rule): rule is Extract<typeof rule, { kind: 'expense' }> =>
      rule.kind === 'expense' && !rule.paused,
  );

  const found: RepeatingExpense[] = [];
  for (const [key, group] of groups) {
    const typical = median(
      group.filter((row) => row.date.slice(0, 7) < current).map((row) => row.amount),
    );
    if (typical <= 0) continue;
    const close = (amount: number) => Math.abs(amount - typical) <= typical * AMOUNT_DRIFT;
    // In each month, the entry nearest the typical amount, if one is close enough.
    const hits = window.flatMap((month) => {
      const candidates = group.filter((row) => row.date.startsWith(month) && close(row.amount));
      const best = candidates.sort(
        (a, b) => Math.abs(a.amount - typical) - Math.abs(b.amount - typical),
      )[0];
      return best ? [best] : [];
    });
    if (hits.length < NEEDED) continue;
    // A bill comes once a month; a category with several entries a month is everyday spending.
    if (window.some((month) => group.filter((row) => row.date.startsWith(month)).length > 1)) {
      continue;
    }
    const days = hits.map((row) => Number(row.date.slice(8, 10)));
    if (Math.max(...days) - Math.min(...days) > DAY_DRIFT) continue;
    const sample = hits.at(-1);
    if (!sample) continue;
    // Already on a schedule of about the same amount.
    if (
      scheduled.some(
        (rule) => rule.category === sample.category && close(amountAt(rule, current) ?? 0),
      )
    ) {
      continue;
    }
    const latest =
      group
        .map((row) => row.date.slice(0, 7))
        .sort()
        .at(-1) ?? current;
    found.push({
      key: `${key}|${Math.round(typical)}`,
      name: sample.subcategory.trim() || sample.category,
      category: sample.category,
      subcategory: sample.subcategory,
      amount: roundMoney(sample.amount),
      day: Math.round(median(days)),
      months: hits.length,
      of: WINDOW,
      startMonth: latest >= current ? nextMonth(current) : current,
    });
  }
  return found.sort((a, b) => b.amount - a.amount);
}
