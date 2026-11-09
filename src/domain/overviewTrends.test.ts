import { describe, expect, test } from 'vitest';
import { emptyTrackerData, type TrackerData } from '../data/repository';
import { EMI_CATEGORY, type Contribution, type Expense, type Income } from '../schema/records';
import { isRepayment, monthlyOverview, overviewTrends, repaymentsByMonth } from './analytics';

let next = 0;
const income = (date: string, amount: number): Income => ({
  id: `i${++next}`,
  date,
  member: 'A',
  source: 'Salary',
  amount,
});
const spend = (date: string, amount: number): Expense => ({
  id: `e${++next}`,
  date,
  category: 'Groceries',
  subcategory: '',
  isAnnual: false,
  amount,
});
const saved = (date: string, amount: number): Contribution => ({
  id: `c${++next}`,
  holdingId: 'fund',
  date,
  amount,
  automatic: false,
});
const data = (extra: Partial<TrackerData>): TrackerData => ({ ...emptyTrackerData(), ...extra });

describe('the dashboard overview against last month', () => {
  const records = data({
    income: [
      income('2026-09-01', 2_00_000),
      income('2026-10-01', 2_00_000),
      income('2026-11-01', 2_20_000),
    ],
    expenses: [
      spend('2026-09-05', 50_000),
      spend('2026-10-05', 40_000),
      spend('2026-10-25', 60_000),
      spend('2026-11-04', 30_000),
    ],
    contributions: [saved('2026-10-10', 40_000), saved('2026-11-08', 30_000)],
    monthlyBalances: [
      { month: '2026-10', startBalance: 5_00_000 },
      { month: '2026-11', startBalance: 6_00_000 },
    ],
  });

  test('income and savings compare with last month, up being good for both', () => {
    const trends = overviewTrends(records, '2026-11', '2026-11-09');
    expect(trends.income.change).toEqual({ change: 0.1, better: true, against: '2026-10' });
    expect(trends.savings.change).toEqual({ change: -0.25, better: false, against: '2026-10' });
    // From when tracking began: three months.
    expect(trends.income.series).toEqual([2_00_000, 2_00_000, 2_20_000]);
  });

  test('a running month compares spending with the same day of last month', () => {
    const trends = overviewTrends(records, '2026-11', '2026-11-09');
    // ₹30,000 by 9 November against ₹40,000 by 9 October: down a quarter, which is good.
    expect(trends.expenses.change).toEqual({ change: -0.25, better: true, against: '2026-10-09' });
  });

  test('the balance shows how far it moved since the month began', () => {
    const trends = overviewTrends(records, '2026-11', '2026-11-09');
    // ₹6,00,000 at the start, plus ₹2,20,000 income, less ₹30,000 spent and ₹30,000 invested.
    expect(trends.balance.moved).toBe(1_60_000);
  });

  test('nothing is compared when last month has nothing, and one month draws no line', () => {
    const fresh = data({ income: [income('2026-11-01', 1_00_000)] });
    const trends = overviewTrends(fresh, '2026-11', '2026-11-09');
    expect(trends.income).toEqual({ series: [], change: null });
    expect(trends.savings.change).toBeNull();
    expect(trends.balance.moved).toBeNull();
  });
});

describe('loan repayments and spending', () => {
  const home = {
    id: 'home',
    type: 'Home Loan',
    member: 'A',
    date: '2026-01-01',
    principal: 20_00_000,
    openingRate: 9,
    openingEmi: 20_000,
    changes: [],
  };
  const phone = { ...home, id: 'phone', type: 'Personal Loan', openingEmi: 5_000, lifestyle: true };
  const emi = (loanId: string, amount: number, part = false): Expense => ({
    ...spend('2026-11-05', amount),
    category: EMI_CATEGORY,
    loanId,
    ...(part ? { repaymentType: 'part-payment' as const } : {}),
  });
  const records = data({
    loans: [home, phone],
    income: [income('2026-11-01', 1_00_000)],
    expenses: [
      spend('2026-11-02', 30_000),
      emi('home', 20_000),
      emi('home', 50_000, true),
      emi('phone', 5_000),
    ],
    monthlyBalances: [{ month: '2026-11', startBalance: 2_00_000 }],
  });

  test('EMIs and part payments repay loans, except a lifestyle EMI, which is spending', () => {
    expect(isRepayment(emi('home', 1), records.loans)).toBe(true);
    expect(isRepayment(emi('home', 1, true), records.loans)).toBe(true);
    expect(isRepayment(emi('phone', 1), records.loans)).toBe(false);
    expect(repaymentsByMonth(records).get('2026-11')).toBe(70_000);
  });

  test("the month's spending leaves repayments out, but the balance still counts them", () => {
    const overview = monthlyOverview(records, '2026-11', '2026-11-09');
    expect(overview.spent).toBe(35_000);
    expect(overview.repaid).toBe(70_000);
    // ₹2,00,000 + ₹1,00,000 income − ₹35,000 spent − ₹70,000 repaid: the bank sees all of it.
    expect(overview.close.available).toBe(1_95_000);
  });
});
