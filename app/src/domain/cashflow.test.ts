import { monthClose, monthlyTrend, topCategories, type CashflowData } from './cashflow';

const data: CashflowData = {
  income: [{ id: 'i', date: '2026-03-02', member: 'A', source: 'Salary', amount: 100_000 }],
  expenses: [
    {
      id: 'e',
      date: '2026-03-05',
      category: 'Rent',
      subcategory: '',
      amount: 30_000,
      isAnnual: false,
    },
  ],
  monthlyBalances: [
    { month: '2026-03', startBalance: 10_000 },
    { month: '2026-04', startBalance: 70_000 },
  ],
};

test('closes a month once both balances exist', () => {
  expect(monthClose(data, '2026-03')).toEqual({
    month: '2026-03',
    income: 100_000,
    expenses: 30_000,
    opening: 10_000,
    closing: 70_000,
    available: 80_000,
    unrecorded: 10_000,
    complete: true,
  });
});

test('a month with no closing balance is incomplete', () => {
  const result = monthClose({ ...data, monthlyBalances: [] }, '2026-03');
  expect(result).toMatchObject({ opening: null, unrecorded: null, complete: false });
  expect(result.available).toBe(70_000);
});

test('the trend includes empty months and crosses the year', () => {
  const rows = monthlyTrend(data, '2026-04', 5).map(({ month, income }) => [month, income]);
  expect(rows).toEqual([
    ['2025-12', 0],
    ['2026-01', 0],
    ['2026-02', 0],
    ['2026-03', 100_000],
    ['2026-04', 0],
  ]);
});

test('smaller categories fold into Other', () => {
  const expense = (category: string, amount: number) => ({
    id: category,
    date: '2026-03-05',
    category,
    subcategory: '',
    amount,
    isAnnual: false,
  });
  const rows = [expense('A', 30), expense('B', 20), expense('C', 10), expense('D', 5)];
  expect(topCategories(rows, '2026-03', 2)).toEqual([
    { category: 'A', amount: 30 },
    { category: 'B', amount: 20 },
    { category: 'Other', amount: 15 },
  ]);
});
