import { describe, expect, test } from 'vitest';
import type { Holding } from '../schema/records';
import {
  duePayouts,
  holdingPosition,
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

  test('the suggested payout is the yearly interest split by how often it’s paid', () => {
    expect(suggestedPayout(400_000, 7.5, 'quarter')).toBe(7500);
    expect(suggestedPayout(400_000, 7.5, 'month')).toBe(2500);
    expect(suggestedPayout(400_000, 7.5, 'year')).toBe(30_000);
  });
});
