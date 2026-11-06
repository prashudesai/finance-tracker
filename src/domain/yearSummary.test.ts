import { expect, test } from 'vitest';
import { emptyTrackerData, type TrackerData } from '../data/repository';
import type { Expense, Holding, Income } from '../schema/records';
import { yearSummary } from './yearSummary';

const income = (month: string, amount: number): Income => ({
  id: `i${month}`,
  date: `${month}-01`,
  member: 'A',
  source: 'Salary',
  amount,
});
const spend = (month: string, amount: number, category = 'Groceries'): Expense => ({
  id: `e${month}${category}`,
  date: `${month}-10`,
  category,
  subcategory: '',
  isAnnual: false,
  amount,
});
const ppf: Holding = {
  id: 'p',
  kind: 'ppf',
  type: 'PPF',
  name: 'PPF',
  member: 'A',
  date: '2025-01-01',
  openingInvested: 1_00_000,
  openingValue: 1_00_000,
  monthly: 0,
  autoContribute: false,
} as Holding;

test('a year at a glance: in, out, kept, and the best and worst months', () => {
  const months = ['2025-04', '2025-05', '2025-06'];
  const data: TrackerData = {
    ...emptyTrackerData(),
    holdings: [ppf],
    income: months.map((month) => income(month, 1_00_000)),
    expenses: [
      spend('2025-04', 40_000),
      spend('2025-05', 70_000, 'Travel'),
      spend('2025-06', 50_000),
    ],
    contributions: [
      { id: 'c', holdingId: 'p', date: '2025-05-02', amount: 50_000, automatic: false },
    ],
  };
  const year = yearSummary(data, 2025, '2026-11-06');
  expect(year).toMatchObject({
    from: '2025-04',
    to: '2026-03',
    income: 3_00_000,
    spent: 1_60_000,
    invested: 50_000,
    best: { month: '2025-04' },
    worst: { month: '2025-05' },
    ppf: 50_000,
  });
  expect(year?.savingsRate).toBeCloseTo(1.4 / 3);
  expect(year?.topCategories[0]).toEqual({ category: 'Groceries', amount: 90_000 });
});

test('nothing for a year with no records', () => {
  expect(yearSummary(emptyTrackerData(), 2025, '2026-11-06')).toBeNull();
});
