import { describe, expect, test } from 'vitest';
import { emptyTrackerData, type TrackerData } from '../data/repository';
import { defaultSettings, type Holding } from '../schema/records';
import { dataHealth } from './health';

const TODAY = '2026-11-06';
const fund = (overrides: Partial<Holding> = {}): Holding => ({
  id: 'fund',
  kind: 'investment',
  type: 'Mutual Funds',
  name: 'Index fund',
  member: 'A',
  date: '2026-01-01',
  openingInvested: 1_00_000,
  openingValue: 1_00_000,
  monthly: 0,
  autoContribute: false,
  ...overrides,
});
const data = (extra: Partial<TrackerData>): TrackerData => ({
  ...emptyTrackerData(),
  settings: [defaultSettings()],
  ...extra,
});
const kinds = (state: TrackerData) => dataHealth(state, TODAY).map((issue) => issue.kind);

describe('data health', () => {
  test('nothing to check in an empty tracker', () => {
    expect(dataHealth(data({}), TODAY)).toEqual([]);
  });

  test('a month with no opening balance, once balances are in use', () => {
    const issues = dataHealth(
      data({
        monthlyBalances: [
          { month: '2026-08', startBalance: 1_000 },
          { month: '2026-10', startBalance: 1_000 },
          { month: '2026-11', startBalance: 1_000 },
        ],
      }),
      TODAY,
    );
    expect(issues).toContainEqual({ kind: 'missingBalances', months: ['2026-09'] });
  });

  test('a closing balance well above the expected one', () => {
    const issues = dataHealth(
      data({
        income: [{ id: 'i', date: '2026-10-01', member: 'A', source: 'Salary', amount: 50_000 }],
        monthlyBalances: [
          { month: '2026-10', startBalance: 10_000 },
          { month: '2026-11', startBalance: 70_000 },
        ],
      }),
      TODAY,
    );
    // ₹10,000 + ₹50,000 should leave ₹60,000; the bank shows ₹10,000 more.
    expect(issues).toContainEqual({
      kind: 'moreThanExpected',
      months: [{ month: '2026-10', amount: 10_000 }],
    });
  });

  test('market investments without a value for six weeks', () => {
    const state = data({
      holdings: [fund()],
      valuations: [{ id: 'v', holdingId: 'fund', date: '2026-08-01', value: 1_10_000 }],
    });
    expect(dataHealth(state, TODAY)).toContainEqual({
      kind: 'staleValues',
      names: ['Index fund'],
      oldest: '2026-08-01',
    });
    const fresh = {
      ...state,
      valuations: [{ id: 'v', holdingId: 'fund', date: '2026-10-30', value: 1_10_000 }],
    };
    expect(kinds(fresh)).not.toContain('staleValues');
  });

  test('records left behind by a deleted investment or loan', () => {
    const issues = dataHealth(
      data({
        contributions: [
          { id: 'c', holdingId: 'gone', date: '2026-10-01', amount: 1, automatic: false },
        ],
        expenses: [
          {
            id: 'e',
            date: '2026-10-01',
            category: 'EMI Payment',
            subcategory: '',
            isAnnual: false,
            amount: 1,
            loanId: 'gone',
          },
        ],
      }),
      TODAY,
    );
    expect(issues).toContainEqual({
      kind: 'orphans',
      records: [
        { collection: 'contributions', id: 'c' },
        { collection: 'expenses', id: 'e' },
      ],
    });
  });
});
