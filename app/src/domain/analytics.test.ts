import { emptyTrackerData, type TrackerData } from '../data/repository';
import { defaultSettings, type Holding } from '../schema/records';
import {
  closeMonth,
  financialSummary,
  monthlyOverview,
  netWorth,
  portfolioCategories,
  holdingRows,
} from './analytics';
import { clearWrites, createBackup, parseBackup, restoreWrites } from './backup';
import { reportCsv, reportRows } from './reports';

const holding = (overrides: Partial<Holding>): Holding => ({
  id: 'h',
  kind: 'investment',
  type: 'Mutual Funds',
  name: 'Fund',
  member: 'A',
  date: '2025-01-01',
  openingInvested: 100_000,
  openingValue: 150_000,
  monthly: 0,
  autoContribute: false,
  ...overrides,
});

const data = (overrides: Partial<TrackerData> = {}): TrackerData => ({
  ...emptyTrackerData(),
  ...overrides,
});

test('net worth is assets less derived loan balances', () => {
  const result = netWorth(
    data({
      holdings: [holding({})],
      loans: [
        {
          id: 'l',
          type: 'Car',
          member: 'A',
          date: '2025-01-01',
          principal: 50_000,
          openingRate: 0,
          openingEmi: 1000,
          changes: [],
        },
      ],
    }),
    '2026-01-01',
  );
  expect(result).toMatchObject({ assets: 150_000, debts: 50_000, netWorth: 100_000 });
  expect(result.assetShare).toBe(0.75);
});

test('categories rank by value and name retirement kinds', () => {
  const rows = holdingRows(
    data({
      holdings: [
        holding({}),
        holding({ id: 'p', kind: 'pf', type: 'PF', openingInvested: 1000, openingValue: 900_000 }),
      ],
    }),
    '2026-01-01',
  );
  const categories = portfolioCategories(rows);
  expect(categories.map((row) => row.name)).toEqual(['PF', 'Mutual Funds']);
  expect(categories[1]?.gain).toBe(50_000);
});

test('PMS transfers reduce what a month has available', () => {
  const state = data({
    holdings: [holding({ type: 'Stallion PMS' })],
    contributions: [
      { id: 'c', holdingId: 'h', date: '2026-03-05', amount: 25_000, automatic: false },
    ],
    income: [{ id: 'i', date: '2026-03-01', member: 'A', source: 'S', amount: 100_000 }],
    monthlyBalances: [{ month: '2026-03', startBalance: 1000 }],
  });
  expect(closeMonth(state, '2026-03').available).toBe(76_000);
});

test('the financial year runs April to March', () => {
  const state = data({
    income: [
      { id: 'a', date: '2026-03-31', member: 'A', source: 'S', amount: 1 },
      { id: 'b', date: '2026-04-01', member: 'A', source: 'S', amount: 10 },
      { id: 'c', date: '2027-03-31', member: 'A', source: 'S', amount: 100 },
    ],
  });
  expect(financialSummary(state, 2026, '2027-04-01').income).toBe(110);
});

test('monthly overview reports the spending change only with both months', () => {
  const expense = (id: string, date: string, amount: number) => ({
    id,
    date,
    category: 'Rent',
    subcategory: '',
    amount,
    isAnnual: false,
  });
  const today = '2026-05-20';
  const one = data({ expenses: [expense('a', '2026-05-01', 100)] });
  expect(monthlyOverview(one, '2026-05', today).spendingChange).toBeNull();
  const two = data({
    expenses: [expense('a', '2026-05-01', 100), expense('b', '2026-04-01', 60)],
  });
  expect(monthlyOverview(two, '2026-05', today).spendingChange).toBe(40);
});

test('CSV export neutralises spreadsheet formulas', () => {
  const state = data({
    income: [{ id: 'a', date: '2026-01-01', member: 'A', source: '=SUM(A1)', amount: 5 }],
  });
  expect(reportCsv(reportRows(state, '2026-01-01', '2026-01-31', 'income'))).toContain("'=SUM(A1)");
});

describe('backups', () => {
  const state = data({
    income: [{ id: 'a', date: '2026-01-01', member: 'A', source: 'S', amount: 5 }],
    monthlyBalances: [{ month: '2026-01', startBalance: 7 }],
    settings: [defaultSettings()],
  });

  test('a backup round-trips', () => {
    expect(parseBackup(createBackup(state, '2026-01-01T00:00:00Z'))).toEqual(state);
  });

  test('a file with any invalid record is rejected whole', () => {
    const file = JSON.parse(createBackup(state, 'now'));
    file.data.income[0].amount = -5;
    expect(() => parseBackup(JSON.stringify(file))).toThrow(/invalid/);
  });

  test('other formats are rejected', () => {
    expect(() => parseBackup('{"format":"other"}')).toThrow(/not supported/);
    expect(() => parseBackup('not json')).toThrow(/not a valid backup/);
  });

  test('restore replaces current records and keeps nothing stale', () => {
    const current = data({
      income: [{ id: 'old', date: '2025-01-01', member: 'A', source: 'S', amount: 1 }],
    });
    const writes = restoreWrites(current, state);
    expect(writes).toContainEqual({ type: 'delete', collection: 'income', id: 'old' });
    expect(writes.some((row) => row.type === 'set' && row.id === 'a')).toBe(true);
    expect(clearWrites(state).map((row) => row.id)).toContain('2026-01');
  });
});
