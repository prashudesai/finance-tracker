import { describe, expect, test } from 'vitest';
import { emptyTrackerData, type TrackerData } from '../data/repository';
import type { Expense, RecurringRule } from '../schema/records';
import { repeatingExpenses } from './repeating';

const TODAY = '2026-11-06';
let next = 0;
const spend = (
  date: string,
  amount: number,
  category = 'Subscriptions',
  subcategory = 'Netflix',
): Expense => ({
  id: `e${++next}`,
  date,
  category,
  subcategory,
  amount,
  isAnnual: false,
});
const data = (expenses: Expense[], extra: Partial<TrackerData> = {}): TrackerData => ({
  ...emptyTrackerData(),
  expenses,
  ...extra,
});

describe('repeating expenses', () => {
  test('the same payment on about the same day, most months, is suggested', () => {
    const found = repeatingExpenses(
      data([
        spend('2026-07-05', 649),
        spend('2026-08-05', 649),
        spend('2026-09-06', 649),
        spend('2026-10-04', 649),
        spend('2026-11-05', 649),
      ]),
      TODAY,
    );
    // Already paid this month, so a schedule would start next month.
    expect(found).toEqual([
      expect.objectContaining({
        name: 'Netflix',
        amount: 649,
        day: 5,
        months: 4,
        startMonth: '2026-12',
      }),
    ]);
  });

  test('scattered amounts or days are not a pattern', () => {
    const groceries = (day: string, amount: number) =>
      spend(`2026-${day}`, amount, 'Groceries', '');
    expect(
      repeatingExpenses(
        data([
          groceries('07-03', 4_000),
          groceries('08-19', 9_500),
          groceries('09-11', 6_200),
          groceries('10-27', 3_100),
        ]),
        TODAY,
      ),
    ).toEqual([]);
    // Same amount, but on wildly different days.
    expect(
      repeatingExpenses(
        data([
          spend('2026-07-02', 649),
          spend('2026-08-20', 649),
          spend('2026-09-11', 649),
          spend('2026-10-28', 649),
        ]),
        TODAY,
      ),
    ).toEqual([]);
  });

  test('a category with several entries a month is everyday spending, not a bill', () => {
    const rows = ['07', '08', '09', '10'].flatMap((m) => [
      spend(`2026-${m}-05`, 2_000, 'Groceries', ''),
      spend(`2026-${m}-18`, 3_400, 'Groceries', ''),
    ]);
    expect(repeatingExpenses(data(rows), TODAY)).toEqual([]);
  });

  test('two months out of four is not enough', () => {
    expect(
      repeatingExpenses(data([spend('2026-09-05', 649), spend('2026-10-05', 649)]), TODAY),
    ).toEqual([]);
  });

  test('nothing to suggest once it is on a schedule, or recorded by one', () => {
    const rows = ['07', '08', '09', '10'].map((m) => spend(`2026-${m}-05`, 649));
    const rule: RecurringRule = {
      id: 'r',
      name: 'Netflix',
      kind: 'expense',
      category: 'Subscriptions',
      subcategory: 'Netflix',
      isAnnual: false,
      amount: 649,
      amountChanges: [],
      day: 5,
      startMonth: '2026-01',
      paused: false,
    };
    expect(repeatingExpenses(data(rows, { recurringRules: [rule] }), TODAY)).toEqual([]);
    const posted = rows.map((row) => ({ ...row, recurringRuleId: 'r' }));
    expect(repeatingExpenses(data(posted), TODAY)).toEqual([]);
  });
});
