import { describe, expect, test } from 'vitest';
import type { Holding } from '../schema/records';
import type { PositionRow } from './analytics';
import { holdingPosition } from './holdings';
import { ageOn, assetSplit, guideMix, memberMixes, portfolioMix, reviewMix } from './portfolioMix';

const TODAY = '2026-11-10';

const base: Holding = {
  id: 'x',
  kind: 'investment',
  type: 'Mutual Funds',
  name: 'Fund',
  member: 'A',
  date: '2025-01-01',
  openingInvested: 100_000,
  openingValue: 100_000,
  monthly: 0,
  autoContribute: false,
};

function rows(...holdings: Partial<Holding>[]): PositionRow[] {
  return holdings.map((extra, index) => {
    const holding = { ...base, id: `h${index}`, ...extra };
    return {
      holding,
      position: holdingPosition(holding, { contributions: [], valuations: [] }, TODAY),
    };
  });
}

const empty = { monthlyBalances: [], expenses: [], income: [] };

describe('what each holding stands for', () => {
  test('types and names place a holding in its asset class', () => {
    expect(assetSplit({ kind: 'investment', type: 'Mutual Funds', name: 'Nifty 50' })).toEqual({
      equity: 1,
    });
    expect(assetSplit({ kind: 'investment', type: 'Mutual Funds', name: 'Gold ETF' })).toEqual({
      gold: 1,
    });
    expect(assetSplit({ kind: 'investment', type: 'Mutual Funds', name: 'Liquid Fund' })).toEqual({
      debt: 1,
    });
    expect(assetSplit({ kind: 'investment', type: 'Bonds', name: 'Wint bond' })).toEqual({
      debt: 1,
    });
    expect(assetSplit({ kind: 'investment', type: 'REITs', name: 'Office REIT' })).toEqual({
      realEstate: 1,
    });
    expect(
      assetSplit(
        { kind: 'investment', type: 'Cash', name: 'Savings' },
        { growthTypes: { Cash: 'no-return' } },
      ),
    ).toEqual({ cash: 1 });
    expect(assetSplit({ kind: 'nps', type: 'NPS', name: 'Tier I' })).toEqual({
      equity: 0.5,
      debt: 0.5,
    });
    expect(assetSplit({ kind: 'ppf', type: 'PPF', name: 'PPF' })).toEqual({ debt: 1 });
  });

  test('the mix adds up each class, locked money and fixed payouts', () => {
    const mix = portfolioMix(
      rows(
        { openingValue: 600_000 },
        {
          type: 'Bonds',
          openingValue: 300_000,
          payout: { every: 'quarter', amount: 7500, start: '2025-03-31' },
        },
        { kind: 'ppf', type: 'PPF', openingValue: 100_000 },
      ),
    );
    expect(mix.total).toBe(1_000_000);
    expect(mix.share.equity).toBeCloseTo(0.6);
    expect(mix.share.debt).toBeCloseTo(0.4);
    expect(mix.locked).toBe(100_000);
    expect(mix.monthlyPayouts).toBe(2500);
  });
});

describe('the guide mix', () => {
  test('equity of 100 minus age, between 30% and 75%, and 60% without an age', () => {
    expect(guideMix(35).equity).toBeCloseTo(0.65);
    expect(guideMix(20).equity).toBeCloseTo(0.75);
    expect(guideMix(80).equity).toBeCloseTo(0.3);
    expect(guideMix(null).equity).toBeCloseTo(0.6);
    expect(guideMix(35).gold).toBeCloseTo(0.1);
  });

  test('age counts whole years', () => {
    expect(ageOn('1991-06-15', TODAY)).toBe(35);
    expect(ageOn('1991-12-15', TODAY)).toBe(34);
    expect(ageOn(undefined, TODAY)).toBeNull();
  });
});

describe('tips for the mix', () => {
  test('mostly in the market: diversify, with what to add or move', () => {
    const review = reviewMix(
      rows({ openingValue: 900_000 }, { type: 'Fixed Deposits', openingValue: 100_000 }),
      empty,
      { today: TODAY, birthDate: '1991-06-15' },
    );
    const tip = review.tips.find((row) => row.kind === 'equityHigh');
    expect(tip).toMatchObject({ tone: 'act', toAdd: 384_615.38, toMove: 250_000 });
    expect(review.tips[0]?.kind).toBe('equityHigh');
    expect(review.tips.some((row) => row.kind === 'goldNone')).toBe(true);
    expect(review.tips.some((row) => row.kind === 'concentration')).toBe(true);
    expect(review.tips.some((row) => row.kind === 'balanced')).toBe(false);
  });

  test('a steady mix with gold is called balanced', () => {
    const review = reviewMix(
      rows(
        { openingValue: 300_000 },
        { name: 'Index Fund', openingValue: 300_000 },
        { type: 'Bonds', openingValue: 300_000 },
        { name: 'Gold ETF', openingValue: 100_000 },
      ),
      empty,
      { today: TODAY },
    );
    expect(review.tips.map((row) => row.kind)).toEqual(['balanced']);
  });

  test('mostly fixed income when young suggests more growth, leaving PPF where it is', () => {
    const review = reviewMix(
      rows(
        { type: 'Fixed Deposits', openingValue: 300_000 },
        { kind: 'ppf', type: 'PPF', openingValue: 600_000 },
        { name: 'Gold', openingValue: 100_000 },
      ),
      empty,
      { today: TODAY, birthDate: '1996-01-01' },
    );
    expect(review.tips.find((row) => row.kind === 'equityLow')).toMatchObject({
      gap: 700_000,
      toMove: 300_000,
    });
  });

  test('high-yield bonds above a fifth of everything are flagged', () => {
    const review = reviewMix(
      rows(
        { openingValue: 500_000 },
        { type: 'Bonds', name: 'NBFC bond', rate: 11.5, openingValue: 300_000 },
        { name: 'Gold ETF', openingValue: 200_000 },
      ),
      empty,
      { today: TODAY },
    );
    expect(review.tips.find((row) => row.kind === 'highYield')).toMatchObject({
      names: ['NBFC bond'],
    });
  });

  test('too little to hand for six months of spending', () => {
    const expenses = ['2026-08-05', '2026-09-05', '2026-10-05'].map((date, index) => ({
      id: `e${index}`,
      date,
      amount: 50_000,
      category: 'Grocery',
      subcategory: '',
      isAnnual: false,
      member: 'A',
    }));
    const review = reviewMix(
      rows({ openingValue: 600_000 }, { type: 'Fixed Deposits', openingValue: 100_000 }),
      { monthlyBalances: [{ month: '2026-11', startBalance: 50_000 }], expenses, income: [] },
      { today: TODAY },
    );
    expect(review.tips.find((row) => row.kind === 'emergency')).toMatchObject({
      tone: 'consider',
      liquid: 150_000,
      target: 300_000,
      short: 150_000,
    });
  });

  test('near retirement with little steady income', () => {
    const expenses = [
      {
        id: 'e',
        date: '2026-10-05',
        amount: 60_000,
        category: 'Grocery',
        subcategory: '',
        isAnnual: false,
        member: 'A',
      },
    ];
    const review = reviewMix(
      rows({ openingValue: 2_000_000 }),
      {
        monthlyBalances: [{ month: '2026-11', startBalance: 1_000_000 }],
        expenses,
        income: [],
      },
      { today: TODAY, retireDate: '2031-06-15' },
    );
    expect(review.tips.find((row) => row.kind === 'income')).toMatchObject({
      monthlySpend: 60_000,
      years: 4,
    });
  });

  test('too small a portfolio gets no tips', () => {
    expect(reviewMix(rows({ openingValue: 20_000 }), empty, { today: TODAY }).tips).toEqual([]);
  });

  test('each member has their own mix', () => {
    const mixes = memberMixes(
      rows({ openingValue: 100_000 }, { member: 'B', type: 'Bonds', openingValue: 300_000 }),
    );
    expect(mixes.map((row) => row.member)).toEqual(['B', 'A']);
    expect(mixes[0]?.mix.share.debt).toBe(1);
  });
});
