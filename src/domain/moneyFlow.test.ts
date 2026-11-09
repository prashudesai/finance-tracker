import { describe, expect, test } from 'vitest';
import { EMI_CATEGORY, type Expense, type Income } from '../schema/records';
import { moneyFlow } from './moneyFlow';

let next = 0;
const income = (member: string, source: string, amount: number): Income => ({
  id: `i${++next}`,
  date: '2026-10-01',
  member,
  source,
  amount,
});
const spend = (category: string, amount: number, extra: Partial<Expense> = {}): Expense => ({
  id: `e${++next}`,
  date: '2026-10-05',
  category,
  subcategory: '',
  isAnnual: false,
  amount,
  ...extra,
});
const loan = {
  id: 'home',
  type: 'Home Loan',
  member: 'A',
  date: '2025-01-01',
  principal: 10_00_000,
  openingRate: 9,
  openingEmi: 20_000,
  changes: [],
};

describe('where a month’s money went', () => {
  test('income meets in one total and splits into spending, EMIs, investing and what’s left', () => {
    const flow = moneyFlow(
      {
        loans: [loan],
        income: [income('Alex', 'Salary', 1_50_000), income('Jamie', 'Salary', 60_000)],
        expenses: [
          spend('Groceries', 20_000),
          spend('Dining', 5_000),
          spend(EMI_CATEGORY, 20_000, { loanId: 'home' }),
          spend('Other', 1, { id: 'unrecorded-2026-10' }),
        ],
      },
      '2026-10',
      { unrecorded: 30_000, invested: 25_000 },
    );
    expect(flow.sources.map((row) => row.label)).toEqual(['Salary · Alex', 'Salary · Jamie']);
    expect(flow.total).toBe(2_10_000);
    expect(flow.outcomes).toEqual([
      { key: 'spent', label: 'Spending', amount: 25_000 },
      { key: 'unrecorded', label: 'Unrecorded', amount: 30_000 },
      { key: 'emis', label: 'Loan EMIs', amount: 20_000 },
      { key: 'invested', label: 'Invested', amount: 25_000 },
      { key: 'left', label: 'Balance', amount: 1_10_000 },
    ]);
    // The saved house expense is the gap, not a category; EMIs aren't spending.
    expect(flow.categories.map((row) => row.label)).toEqual(['Groceries', 'Dining']);
  });

  test('when more went out than came in, the rest comes from the bank balance', () => {
    const flow = moneyFlow(
      { loans: [], income: [income('Alex', 'Salary', 50_000)], expenses: [spend('Rent', 70_000)] },
      '2026-10',
      { unrecorded: 0, invested: 0 },
    );
    expect(flow.sources.at(-1)).toEqual({
      key: 'in-bank',
      label: 'From bank balance',
      amount: 20_000,
    });
    expect(flow.total).toBe(70_000);
    expect(flow.outcomes.map((row) => row.key)).toEqual(['spent']);
  });

  test('one earner shows sources alone, and small categories fold into Other', () => {
    const flow = moneyFlow(
      {
        loans: [],
        income: [income('Alex', 'Salary', 1_00_000)],
        expenses: ['A', 'B', 'C', 'D', 'E', 'F'].map((name, index) =>
          spend(name, 1_000 * (6 - index)),
        ),
      },
      '2026-10',
      { unrecorded: 0, invested: 0 },
    );
    expect(flow.sources[0]?.label).toBe('Salary');
    expect(flow.categories.map((row) => [row.label, row.amount])).toEqual([
      ['A', 6_000],
      ['B', 5_000],
      ['C', 4_000],
      ['D', 3_000],
      ['Other', 3_000],
    ]);
  });
});
