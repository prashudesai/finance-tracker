import { describe, expect, test } from 'vitest';
import type { Contribution, Holding, Valuation, Withdrawal } from '../schema/records';
import {
  bookedProfitByYear,
  groupXirr,
  holdingPosition,
  withdrawalLedger,
  type HoldingData,
} from './holdings';

const fund: Holding = {
  id: 'h',
  kind: 'investment',
  type: 'Mutual Funds',
  name: 'Index fund',
  member: 'A',
  date: '2025-01-15',
  openingInvested: 120_000,
  openingValue: 120_000,
  monthly: 0,
  autoContribute: false,
};

const valuation = (date: string, value: number): Valuation => ({
  id: `v${date}`,
  holdingId: 'h',
  date,
  value,
});
const withdrawal = (date: string, amount: number, id = `w${date}`): Withdrawal => ({
  id,
  holdingId: 'h',
  date,
  amount,
});
const contribution = (date: string, amount: number): Contribution => ({
  id: `c${date}`,
  holdingId: 'h',
  date,
  amount,
  automatic: false,
});

const data = (parts: Partial<Required<HoldingData>>): HoldingData => ({
  contributions: [],
  valuations: [],
  withdrawals: [],
  ...parts,
});

describe('withdrawals', () => {
  test('take out the invested amount by average cost and book the rest as profit', () => {
    // Worth 2,00,000 with 1,20,000 invested. Taking 50,000 leaves 1,50,000.
    const book = data({
      valuations: [valuation('2025-06-01', 200_000), valuation('2025-07-01', 150_000)],
      withdrawals: [withdrawal('2025-07-01', 50_000)],
    });
    const position = holdingPosition(fund, book, '2025-08-01');
    expect(position.current).toBe(150_000);
    expect(position.invested).toBe(90_000);
    expect(position.booked).toBe(20_000);
    expect(position.gain).toBe(60_000);
    // Nothing goes missing: the 80,000 gain before is split between the two.
    expect(position.booked + position.gain).toBe(200_000 - 120_000);
  });

  test('without a value that day, the value before is the last one less what was taken', () => {
    const book = data({
      valuations: [valuation('2025-06-01', 200_000)],
      withdrawals: [withdrawal('2025-07-01', 50_000)],
    });
    const position = holdingPosition(fund, book, '2025-08-01');
    expect(position.current).toBe(150_000);
    expect(position.invested).toBe(90_000);
    expect(position.booked).toBe(20_000);
  });

  test('counts a contribution on the same day first', () => {
    const book = data({
      contributions: [contribution('2025-07-01', 80_000)],
      valuations: [valuation('2025-07-01', 200_000)],
      withdrawals: [withdrawal('2025-07-01', 50_000)],
    });
    // 2,00,000 invested, worth 2,50,000 before. A fifth of the cost goes out.
    const { invested, entries } = withdrawalLedger(fund, book, '2025-08-01');
    expect(entries[0]).toMatchObject({ cost: 40_000, profit: 10_000 });
    expect(invested).toBe(160_000);
  });

  test('taking everything out leaves nothing invested and books the whole gain', () => {
    const book = data({
      valuations: [valuation('2025-09-01', 0)],
      withdrawals: [withdrawal('2025-09-01', 180_000)],
    });
    const position = holdingPosition(fund, book, '2025-10-01');
    expect(position).toMatchObject({ current: 0, invested: 0, booked: 60_000, gain: 0 });
  });

  test('two withdrawals on one day add up to one', () => {
    const one = holdingPosition(
      fund,
      data({
        valuations: [valuation('2025-07-01', 150_000)],
        withdrawals: [withdrawal('2025-07-01', 50_000)],
      }),
      '2025-08-01',
    );
    const two = holdingPosition(
      fund,
      data({
        valuations: [valuation('2025-07-01', 150_000)],
        withdrawals: [withdrawal('2025-07-01', 20_000, 'a'), withdrawal('2025-07-01', 30_000, 'b')],
      }),
      '2025-08-01',
    );
    expect(two.invested).toBe(one.invested);
    expect(two.booked).toBe(one.booked);
  });

  test('a later withdrawal is left out of an earlier date', () => {
    const book = data({
      valuations: [valuation('2025-07-01', 150_000)],
      withdrawals: [withdrawal('2025-07-01', 50_000)],
    });
    expect(holdingPosition(fund, book, '2025-06-30')).toMatchObject({
      invested: 120_000,
      booked: 0,
    });
  });

  test('returns count the money received', () => {
    const kept = data({ valuations: [valuation('2026-01-15', 150_000)] });
    const taken = data({
      valuations: [valuation('2025-07-15', 150_000), valuation('2026-01-15', 120_000)],
      withdrawals: [withdrawal('2025-07-15', 50_000)],
    });
    const without = holdingPosition(fund, kept, '2026-01-15').xirr ?? 0;
    const withIt = holdingPosition(fund, taken, '2026-01-15').xirr ?? 0;
    // 50,000 received halfway plus 1,20,000 at the end beats 1,50,000 at the end.
    expect(withIt).toBeGreaterThan(without);
    expect(groupXirr([fund], taken, '2026-01-15')).toBeCloseTo(withIt, 6);
  });

  test('a PF withdrawal counts the interest credited before it', () => {
    const pf: Holding = {
      ...fund,
      kind: 'pf',
      type: 'PF',
      openingInvested: 100_000,
      openingValue: 100_000,
    };
    const book: HoldingData = {
      contributions: [],
      valuations: [valuation('2025-06-01', 54_000)],
      withdrawals: [withdrawal('2025-06-01', 54_000)],
      interestCredits: [
        {
          id: 'i',
          holdingId: 'h',
          financialYearStartYear: 2024,
          creditedDate: '2025-03-31',
          amount: 8_000,
        },
      ],
    };
    // Worth 1,08,000 before, so half the cost goes out: 50,000, and 4,000 of interest.
    const position = holdingPosition(pf, book, '2025-07-01');
    expect(position).toMatchObject({ current: 54_000, invested: 50_000, booked: 4_000 });
  });

  test('booked profit adds up by financial year', () => {
    const book = data({
      valuations: [
        valuation('2025-06-01', 200_000),
        valuation('2025-07-01', 150_000),
        valuation('2026-02-01', 100_000),
        valuation('2026-05-01', 50_000),
      ],
      withdrawals: [
        withdrawal('2025-07-01', 50_000),
        withdrawal('2026-02-01', 50_000),
        withdrawal('2026-05-01', 50_000),
      ],
    });
    const rows = bookedProfitByYear([fund], book, '2026-06-01');
    expect(rows.map((row) => row.year)).toEqual([2026, 2025]);
    const { entries } = withdrawalLedger(fund, book, '2026-06-01');
    expect(rows[1]?.profit).toBe((entries[0]?.profit ?? 0) + (entries[1]?.profit ?? 0));
    expect(rows[0]?.profit).toBe(entries[2]?.profit);
  });
});
