import { describe, expect, test } from 'vitest';
import { emptyTrackerData, type TrackerData } from '../data/repository';
import {
  defaultSettings,
  EMI_CATEGORY,
  PMS_TYPE,
  type Expense,
  type Holding,
  type Income,
  type Loan,
  type RecurringRule,
} from '../schema/records';
import { insights, type Insight } from './insights';
import { monthRecap, recapMonths } from './recap';

const TODAY = '2026-11-10';
let next = 0;
const id = () => `r${++next}`;

const income = (date: string, amount: number, source = 'Salary'): Income => ({
  id: id(),
  date,
  member: 'A',
  source,
  amount,
});
const expense = (
  date: string,
  amount: number,
  category = 'Groceries',
  extra: Partial<Expense> = {},
): Expense => ({
  id: id(),
  date,
  category,
  subcategory: '',
  amount,
  isAnnual: false,
  ...extra,
});
const data = (parts: Partial<TrackerData>): TrackerData => ({
  ...emptyTrackerData(),
  settings: [defaultSettings()],
  ...parts,
});
const find = <K extends Insight['kind']>(list: Insight[], kind: K) =>
  list.find((row) => row.kind === kind) as Extract<Insight, { kind: K }> | undefined;

/** Six months of steady income and spending, April to September. */
const steady = () =>
  ['04', '05', '06', '07', '08', '09'].flatMap((m) => [
    income(`2026-${m}-01`, 1_00_000),
    expense(`2026-${m}-12`, 80_000, 'Rent'),
  ]);

describe('insights', () => {
  test('nothing to say about an empty tracker', () => {
    expect(insights(data({}), TODAY)).toEqual([]);
  });

  test('a quiet week asks for an update, and a recent entry doesn’t', () => {
    const quiet = find(insights(data({ expenses: [expense('2026-11-01', 500)] }), TODAY), 'quiet');
    expect(quiet).toMatchObject({ days: 9, lastDate: '2026-11-01', tone: 'watch' });
    expect(
      find(insights(data({ expenses: [expense('2026-11-08', 500)] }), TODAY), 'quiet'),
    ).toBeUndefined();
  });

  test('a category well above its usual is flagged, ignoring EMIs', () => {
    const expenses = [
      ...['07', '08', '09'].map((m) => expense(`2026-${m}-05`, 3_000, 'Dining')),
      expense('2026-10-05', 4_200, 'Dining'),
      // A big EMI swing must not count as everyday spending.
      ...['07', '08', '09'].map((m) => expense(`2026-${m}-03`, 10_000, EMI_CATEGORY)),
      expense('2026-10-03', 40_000, EMI_CATEGORY),
    ];
    const found = find(insights(data({ expenses }), TODAY), 'category');
    expect(found).toMatchObject({ category: 'Dining', amount: 4_200, usual: 3_000, tone: 'watch' });
  });

  test('a small or modest change is left out', () => {
    const expenses = [
      ...['07', '08', '09'].map((m) => expense(`2026-${m}-05`, 3_000, 'Dining')),
      expense('2026-10-05', 3_500, 'Dining'),
    ];
    expect(find(insights(data({ expenses }), TODAY), 'category')).toBeUndefined();
  });

  test('the best savings month of the year is celebrated', () => {
    const found = find(
      insights(
        data({
          income: [
            ...steady().filter((row): row is Income => 'source' in row),
            income('2026-10-01', 1_00_000),
          ],
          expenses: [
            ...steady().filter((row): row is Expense => 'category' in row),
            expense('2026-10-12', 50_000, 'Rent'),
          ],
        }),
        TODAY,
      ),
      'savings',
    );
    expect(found).toMatchObject({ month: '2026-10', rate: 0.5, best: true, tone: 'good' });
    expect(found?.averageRate).toBeCloseTo(0.2);
  });

  test('spending more than income is a warning', () => {
    const found = find(
      insights(
        data({ income: [income('2026-10-01', 50_000)], expenses: [expense('2026-10-02', 60_000)] }),
        TODAY,
      ),
      'savings',
    );
    expect(found).toMatchObject({ tone: 'watch' });
    expect(found?.rate).toBeCloseTo(-0.2);
  });

  const homeLoan: Loan = {
    id: 'home',
    type: 'Home Loan',
    member: '',
    date: '2026-01-01',
    principal: 20_00_000,
    openingRate: 9,
    openingEmi: 40_000,
    changes: [],
  };

  test('EMIs over 40% of income are a warning', () => {
    const found = find(
      insights(
        data({
          loans: [homeLoan],
          income: ['08', '09', '10'].map((m) => income(`2026-${m}-01`, 1_00_000)),
        }),
        TODAY,
      ),
      'emiLoad',
    );
    expect(found).toMatchObject({ emi: 40_000, income: 1_00_000, share: 0.4, tone: 'watch' });
  });

  test('prepaying the dearest loan saves the interest a month-by-month schedule says', () => {
    const found = find(insights(data({ loans: [homeLoan] }), TODAY), 'prepay');
    expect(found).toMatchObject({ loan: 'Home Loan', extra: 1_00_000, rate: 9 });
    // An independent schedule: pay interest at 0.75% a month, then the rest off the balance.
    const interest = (balance: number) => {
      let owed = balance;
      let paid = 0;
      let months = 0;
      while (owed > 0.005) {
        const due = owed * 0.0075;
        const payment = Math.min(40_000, owed + due);
        paid += payment;
        owed = owed + due - payment;
        months++;
      }
      return { interest: paid - balance, months };
    };
    const before = interest(20_00_000);
    const after = interest(19_00_000);
    expect(found?.interestSaved).toBeCloseTo(before.interest - after.interest, -1);
    expect(found?.emisSaved).toBe(before.months - after.months);
  });

  const fund = (overrides: Partial<Holding> = {}): Holding => ({
    id: 'fund',
    kind: 'investment',
    type: 'Mutual Funds',
    name: 'Index fund',
    member: 'A',
    date: '2026-01-01',
    openingInvested: 20_00_000,
    openingValue: 20_00_000,
    monthly: 0,
    autoContribute: false,
    ...overrides,
  });

  test('crossing ₹25 lakh this month is a milestone, shown first', () => {
    const list = insights(
      data({
        holdings: [fund()],
        valuations: [
          { id: 'v1', holdingId: 'fund', date: '2026-10-01', value: 24_50_000 },
          { id: 'v2', holdingId: 'fund', date: '2026-11-05', value: 25_20_000 },
        ],
        expenses: [expense('2026-11-01', 500)],
      }),
      TODAY,
    );
    expect(list[0]).toMatchObject({ kind: 'milestone', milestone: 25_00_000, tone: 'good' });
  });

  test('a big shift towards market investments is noted', () => {
    const found = find(
      insights(
        data({
          holdings: [
            fund({ openingValue: 10_00_000, openingInvested: 10_00_000 }),
            fund({
              id: 'fd',
              type: 'Fixed Deposits',
              name: 'FD',
              openingValue: 10_00_000,
              openingInvested: 10_00_000,
            }),
          ],
          valuations: [{ id: 'v', holdingId: 'fund', date: '2026-10-20', value: 23_33_333 }],
        }),
        TODAY,
      ),
      'allocation',
    );
    expect(found?.earlier).toBeCloseTo(0.5);
    expect(found?.share).toBeCloseTo(0.7, 2);
  });

  const rent: RecurringRule = {
    id: 'rent',
    kind: 'expense',
    name: 'Rent',
    category: 'House Rent',
    subcategory: '',
    isAnnual: false,
    amount: 20_000,
    day: 15,
    startMonth: '2026-01',
    paused: false,
    amountChanges: [],
  };

  test('recurring payments add up, and one due within a week is mentioned', () => {
    const list = insights(
      data({ recurringRules: [rent, { ...rent, id: 'gym', name: 'Gym', amount: 2_000, day: 20 }] }),
      TODAY,
    );
    expect(find(list, 'commitments')).toMatchObject({ total: 22_000, count: 2, emis: 0 });
    expect(find(list, 'dueSoon')).toMatchObject({
      name: 'Rent',
      amount: 20_000,
      date: '2026-11-15',
    });
  });

  test('spending mostly at weekends is noted', () => {
    // 7 November 2026 is a Saturday.
    const expenses = [
      ...Array.from({ length: 8 }, (_, i) =>
        expense(i % 2 ? '2026-11-07' : '2026-11-08', 1_000, 'Dining'),
      ),
      ...Array.from({ length: 4 }, () => expense('2026-11-04', 500, 'Dining')),
    ];
    const found = find(insights(data({ expenses }), TODAY), 'weekend');
    expect(found?.share).toBeCloseTo(0.8);
  });

  test('this month so far: money invested and loan principal repaid', () => {
    const list = insights(
      data({
        holdings: [fund()],
        contributions: [
          { id: 'c', holdingId: 'fund', date: '2026-11-05', amount: 15_000, automatic: false },
        ],
        loans: [homeLoan],
        expenses: [
          expense('2026-11-03', 40_000, EMI_CATEGORY, { loanId: 'home', repaymentType: 'emi' }),
        ],
      }),
      TODAY,
    );
    expect(find(list, 'invested')).toMatchObject({ month: '2026-11', amount: 15_000 });
    // The first EMI on 20 lakh at 9%: 15,000 is interest, the rest repays principal.
    expect(find(list, 'principal')).toMatchObject({ month: '2026-11', amount: 25_000 });
  });

  test('a PMS gain change shows once both months have a valuation', () => {
    const pms = fund({ id: 'pms', type: PMS_TYPE, name: 'Long-term PMS' });
    const valued = (date: string, value: number) => ({
      id: `v${date}`,
      holdingId: 'pms',
      date,
      value,
    });
    const list = insights(
      data({
        holdings: [pms],
        valuations: [valued('2026-10-20', 21_00_000), valued('2026-11-06', 21_40_000)],
      }),
      TODAY,
    );
    expect(find(list, 'pmsGain')).toMatchObject({ change: 40_000, tone: 'good' });
    const once = insights(
      data({ holdings: [pms], valuations: [valued('2026-11-06', 21_40_000)] }),
      TODAY,
    );
    expect(find(once, 'pmsGain')).toBeUndefined();
  });

  test('insights come most useful first', () => {
    const list = insights(
      data({
        expenses: [expense('2026-10-01', 9_000, 'Travel')],
        recurringRules: [rent, { ...rent, id: 'gym', day: 20 }],
      }),
      TODAY,
    );
    const scores = list.map((row) => row.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });
});

describe('monthly recap', () => {
  const book = data({
    income: [
      income('2026-09-01', 90_000),
      income('2026-10-01', 1_00_000),
      income('2026-10-20', 20_000, 'Freelance'),
    ],
    expenses: [
      expense('2026-09-10', 3_000, 'Dining'),
      expense('2026-10-10', 4_000, 'Dining'),
      expense('2026-10-12', 30_000, 'Rent'),
      expense('2026-10-05', 25_000, EMI_CATEGORY, { loanId: 'home', repaymentType: 'emi' }),
      expense('2026-10-25', 12_000, 'Shopping', { notes: 'New phone' }),
    ],
    contributions: [
      { id: 'c', holdingId: 'fund', date: '2026-10-15', amount: 10_000, automatic: false },
    ],
  });

  test('adds up the month, and compares it with the one before', () => {
    const recap = monthRecap(book, '2026-10', TODAY);
    expect(recap).toMatchObject({
      income: 1_20_000,
      expenses: 71_000,
      saved: 49_000,
      emiPaid: 25_000,
      invested: 10_000,
      records: 6,
    });
    expect(recap.savingsRate).toBeCloseTo(49 / 120);
    expect(recap.previous).toMatchObject({ income: 90_000, expenses: 3_000 });
    expect(recap.categories[0]).toEqual({ category: 'Rent', amount: 30_000, previous: null });
    expect(recap.categories.find((row) => row.category === 'Dining')).toEqual({
      category: 'Dining',
      amount: 4_000,
      previous: 3_000,
    });
    expect(recap.incomeSources).toEqual([
      { source: 'Salary', amount: 1_00_000 },
      { source: 'Freelance', amount: 20_000 },
    ]);
  });

  test('the biggest expense leaves out EMIs', () => {
    expect(monthRecap(book, '2026-10', TODAY).biggest).toMatchObject({
      category: 'Rent',
      amount: 30_000,
    });
  });

  test('lists months with records, newest first', () => {
    expect(recapMonths(book, '2026-10')).toEqual(['2026-10', '2026-09']);
    expect(recapMonths(book, '2026-09')).toEqual(['2026-09']);
  });

  test('a month with no income has no savings rate', () => {
    expect(
      monthRecap(data({ expenses: [expense('2026-10-01', 100)] }), '2026-10', TODAY).savingsRate,
    ).toBeNull();
  });
});
