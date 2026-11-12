import { describe, expect, test } from 'vitest';
import type { Holding } from '../schema/records';
import {
  averageMonthlyPayout,
  duePayouts,
  groupRate,
  holdingPosition,
  maturingHoldings,
  payoutAmountOn,
  returnMeasure,
  suggestedPayout,
  valueHistory,
} from './holdings';

describe('how each holding’s return is measured', () => {
  test('fixed-rate kinds use their interest rate, plain cash its gain, and markets XIRR', () => {
    expect(returnMeasure({ kind: 'investment', type: 'Fixed Deposits' })).toBe('rate');
    expect(returnMeasure({ kind: 'investment', type: 'Bonds' })).toBe('rate');
    expect(returnMeasure({ kind: 'pf', type: 'PF' })).toBe('rate');
    expect(returnMeasure({ kind: 'ppf', type: 'PPF' })).toBe('rate');
    expect(returnMeasure({ kind: 'nps', type: 'NPS' })).toBe('xirr');
    expect(returnMeasure({ kind: 'investment', type: 'Mutual Funds' })).toBe('xirr');
    expect(
      returnMeasure({ kind: 'investment', type: 'Cash' }, { growthTypes: { Cash: 'no-return' } }),
    ).toBe('absolute');
  });
});

const fund: Holding = {
  id: 'f',
  kind: 'investment',
  type: 'Mutual Funds',
  name: 'Fund',
  member: 'A',
  date: '2026-08-15',
  openingInvested: 1000,
  openingValue: 1000,
  monthly: 0,
  autoContribute: false,
};

describe('value over time', () => {
  test('each month-end value and invested amount, from the first holding’s start', () => {
    const history = valueHistory(
      [fund],
      {
        contributions: [
          { id: 'c', holdingId: 'f', date: '2026-09-10', amount: 500, automatic: false },
        ],
        valuations: [{ id: 'v', holdingId: 'f', date: '2026-10-31', value: 1800 }],
        withdrawals: [],
      },
      '2026-11-10',
    );
    expect(history).toEqual([
      { month: '2026-08', value: 1000, invested: 1000 },
      { month: '2026-09', value: 1500, invested: 1500 },
      { month: '2026-10', value: 1800, invested: 1500 },
      { month: '2026-11', value: 1800, invested: 1500 },
    ]);
    expect(
      valueHistory([fund], { contributions: [], valuations: [] }, '2026-11-10', 2),
    ).toHaveLength(2);
  });
});

describe('interest paid out', () => {
  const fd: Holding = {
    ...fund,
    id: 'fd',
    type: 'Fixed Deposits',
    date: '2026-01-01',
    openingInvested: 400_000,
    openingValue: 400_000,
    rate: 7.5,
    payout: { every: 'quarter', amount: 7500, start: '2026-03-31' },
  };

  test('each payout falls due on its schedule, once', () => {
    const due = duePayouts([fd], [], '2026-11-10');
    const [first, second] = due;
    if (!first || !second) throw new Error('Expected two payouts');
    expect(due.map((row) => row.date)).toEqual(['2026-03-31', '2026-06-30', '2026-09-30']);
    expect(due[0]).toMatchObject({ id: 'payout_fd_202603', amount: 7500 });
    const later = duePayouts([fd], [{ ...first, skipped: true }, second], '2026-11-10');
    expect(later.map((row) => row.date)).toEqual(['2026-09-30']);
  });

  test('payouts received count towards the gain and returns, skipped ones don’t', () => {
    const payouts = [
      { id: 'a', holdingId: 'fd', date: '2026-03-31', amount: 7500 },
      { id: 'b', holdingId: 'fd', date: '2026-06-30', amount: 7500 },
      { id: 'c', holdingId: 'fd', date: '2026-09-30', amount: 7500, skipped: true },
    ];
    const position = holdingPosition(
      fd,
      { contributions: [], valuations: [], payouts },
      '2026-11-10',
    );
    expect(position.paidOut).toBe(15_000);
    expect(position.gain).toBe(15_000);
    expect(position.absolute).toBeCloseTo(0.0375, 6);
    expect(position.xirr).toBeGreaterThan(0.04);
    const without = holdingPosition(fd, { contributions: [], valuations: [] }, '2026-11-10');
    expect(without.gain).toBe(0);
  });

  test('a payout that varies falls due with no amount, to be entered', () => {
    const share: Holding = { ...fd, payout: { every: 'year', start: '2026-03-31' } };
    expect(duePayouts([share], [], '2026-11-10')).toEqual([
      { id: 'payout_fd_202603', holdingId: 'fd', date: '2026-03-31', amount: 0 },
    ]);
  });

  test('the suggested payout is the yearly interest split by how often it’s paid', () => {
    expect(suggestedPayout(400_000, 7.5, 'quarter')).toBe(7500);
    expect(suggestedPayout(400_000, 7.5, 'month')).toBe(2500);
    expect(suggestedPayout(400_000, 7.5, 'year')).toBe(30_000);
  });
});

describe('rent that rises, and principal that comes back', () => {
  const lease: Holding = {
    ...fund,
    id: 'lease',
    type: 'Lease financing',
    date: '2024-01-01',
    openingInvested: 500_000,
    openingValue: 500_000,
    payout: { every: 'month', amount: 10_000, start: '2024-02-01', rise: 5 },
    maturity: '2026-12-01',
  };

  test('a payout rises by its yearly rise after each full year from its start', () => {
    const plan = lease.payout;
    if (!plan) throw new Error('Expected a payout');
    expect(payoutAmountOn(plan, '2024-02-01')).toBe(10_000);
    expect(payoutAmountOn(plan, '2025-01-31')).toBe(10_000);
    expect(payoutAmountOn(plan, '2025-02-01')).toBe(10_500);
    expect(payoutAmountOn(plan, '2026-02-01')).toBe(11_025);
    expect(payoutAmountOn({ ...plan, rise: undefined }, '2026-02-01')).toBe(10_000);
    expect(payoutAmountOn({ ...plan, amount: undefined }, '2026-02-01')).toBe(0);
  });

  test('payouts fall due at their risen amount, and stop after maturity', () => {
    const due = duePayouts([lease], [], '2027-03-10');
    expect(due.at(0)).toMatchObject({ date: '2024-02-01', amount: 10_000 });
    expect(due.find((row) => row.date === '2025-02-01')?.amount).toBe(10_500);
    expect(due.at(-1)).toMatchObject({ date: '2026-12-01', amount: 11_025 });
  });

  test('a holding shows as maturing from a month before, until its principal is taken out', () => {
    const data = { contributions: [], valuations: [] };
    expect(maturingHoldings([lease], data, '2026-10-31')).toEqual([]);
    expect(maturingHoldings([lease], data, '2026-11-01')).toEqual([
      { holding: lease, value: 500_000 },
    ]);
    expect(maturingHoldings([lease], data, '2027-01-15')).toHaveLength(1);
    const closed = {
      ...data,
      valuations: [{ id: 'v', holdingId: 'lease', date: '2026-12-01', value: 0 }],
      withdrawals: [{ id: 'w', holdingId: 'lease', date: '2026-12-01', amount: 500_000 }],
    };
    expect(maturingHoldings([lease], closed, '2027-01-15')).toEqual([]);
  });
});

describe('payouts as they come, per unit', () => {
  const cattle: Holding = {
    ...fund,
    id: 'cattle',
    type: 'Dairy cattle',
    openingInvested: 2_800_000,
    openingValue: 2_800_000,
    units: { count: 28, name: 'cows' },
    payout: { every: 'irregular', amount: 40_000, start: '2026-08-15', cycle: 20 },
  };

  test('nothing falls due on a schedule; each is recorded when it comes', () => {
    expect(duePayouts([cattle], [], '2029-01-01')).toEqual([]);
  });

  test('a month on average is every unit paying once each cycle', () => {
    expect(averageMonthlyPayout(cattle)).toBe(56_000);
    expect(averageMonthlyPayout({ ...cattle, units: undefined })).toBe(2_000);
    const noCycle = { every: 'irregular' as const, amount: 40_000, start: '2026-08-15' };
    expect(averageMonthlyPayout({ ...cattle, payout: noCycle })).toBe(0);
    const quarterly = { every: 'quarter' as const, amount: 7_500, start: '2026-03-31' };
    expect(averageMonthlyPayout({ payout: quarterly })).toBe(2_500);
  });
});

describe('one rate for a group of fixed-return holdings', () => {
  const at = (rate: number | undefined, invested: number, payout?: Holding['payout']) => ({
    holding: { rate, payout, units: undefined },
    position: { invested },
  });

  test('different rates average by how much is in each', () => {
    expect(groupRate([at(7, 100_000), at(9, 300_000)])).toEqual({
      kind: 'rate',
      rate: 8.5,
      same: false,
    });
  });

  test('one rate everywhere is that rate', () => {
    expect(groupRate([at(8, 100_000), at(8, 50_000)])).toEqual({
      kind: 'rate',
      rate: 8,
      same: true,
    });
  });

  test('with no rates, payouts give a yield on what was put in', () => {
    const monthly = { every: 'month' as const, amount: 1_000, start: '2026-01-31' };
    expect(groupRate([at(undefined, 200_000, monthly), at(undefined, 100_000)])).toEqual({
      kind: 'yield',
      rate: 4,
    });
  });

  test('with neither, there is no rate to show', () => {
    expect(groupRate([at(undefined, 100_000)])).toBeNull();
    expect(groupRate([])).toBeNull();
  });
});
