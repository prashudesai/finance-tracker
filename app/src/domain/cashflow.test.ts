import { monthClose, type CashflowData } from './cashflow';

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
