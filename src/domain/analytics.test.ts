import { previewData } from '../data/previewData';
import { emptyTrackerData, type TrackerData } from '../data/repository';
import { defaultSettings, type Holding } from '../schema/records';
import {
  attentionItems,
  backupStatus,
  balanceHistory,
  balanceYears,
  closeMonth,
  fullHouseExpense,
  memberPositions,
  financialSummary,
  holdingRows,
  monthCloser,
  monthlyOverview,
  monthReviewStatus,
  monthSignature,
  monthsToReview,
  netWorth,
  portfolioCategories,
  uncheckedContributions,
  unverifiedHoldings,
  valuationAge,
} from './analytics';
import { clearWrites, createBackup, parseBackup, restoreWrites } from './backup';
import { realValue } from './projection';
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

describe('reviews', () => {
  const state = data({
    income: [{ id: 'i', date: '2026-03-01', member: 'A', source: 'S', amount: 100 }],
    monthlyBalances: [
      { month: '2026-03', startBalance: 10 },
      { month: '2026-04', startBalance: 20 },
    ],
  });

  test('a reviewed month asks again when its figures change', () => {
    const reviewed = {
      ...state,
      monthReviews: [
        {
          id: 'm',
          month: '2026-03',
          signature: monthSignature(state, '2026-03'),
          reviewedAt: '2026-04-01',
        },
      ],
    };
    expect(monthReviewStatus(reviewed, '2026-03').reviewed).toBe(true);
    const changed = {
      ...reviewed,
      income: [{ id: 'j', date: '2026-03-02', member: 'A', source: 'S', amount: 5 }],
    };
    expect(monthReviewStatus(changed, '2026-03')).toMatchObject({ reviewed: false, changed: true });
  });

  test('the attention list counts unreviewed months and unconfirmed values', () => {
    const withHolding = { ...state, holdings: [holding({})] };
    const items = attentionItems(withHolding, withHolding, '2026-04-10', 2);
    expect(items.every((row) => Object.keys(row.state).length > 0)).toBe(true);
    expect(items.map((row) => row.label)).toEqual([
      '1 household month needs balance review',
      'No backup exported yet',
      '1 valuation needs confirmation',
      '2 recurring items due',
    ]);
  });

  test('confirming a value clears it and reports its age', () => {
    const confirmed = data({
      holdings: [holding({})],
      valuations: [{ id: 'v', holdingId: 'h', date: '2026-01-01', value: 150_000 }],
    });
    expect(unverifiedHoldings(confirmed)).toEqual([]);
    expect(valuationAge('h', confirmed, '2026-01-31')).toBe('2026-01-01 · 30 days ago');
    expect(valuationAge('h', data(), '2026-01-31')).toBe('Unverified');
  });

  test('statement checks only count unconfirmed automatic entries', () => {
    const row = { id: 'a', holdingId: 'h', date: '2026-03-01', amount: 5, automatic: true };
    const checks = data({
      holdings: [holding({})],
      contributions: [row, { ...row, id: 'b', confirmed: true }],
    });
    expect(uncheckedContributions(checks, '2026-03').map((item) => item.id)).toEqual(['a']);
  });
});

test('real value removes inflation', () => {
  expect(realValue(1210, 10, 2)).toBeCloseTo(1000);
});

test('backup reminders follow the chosen interval', () => {
  const state = data({
    income: [{ id: 'i', date: '2026-01-01', member: 'A', source: 'S', amount: 1 }],
    settings: [{ ...defaultSettings(), backupReminderDays: 30, lastBackupOn: '2026-01-01' }],
  });
  expect(backupStatus(state, '2026-01-20').due).toBe(false);
  expect(backupStatus(state, '2026-02-15')).toEqual({
    due: true,
    label: 'Last backup was 45 days ago',
  });
  const never = { ...state, settings: [{ ...defaultSettings(), backupReminderDays: 0 }] };
  expect(backupStatus(never, '2026-02-15').due).toBe(false);
  expect(backupStatus(data(), '2026-02-15').due).toBe(false);
});

test('a recent cloud sync means no backup reminder', () => {
  const state = data({
    income: [{ id: 'i', date: '2026-01-01', member: 'A', source: 'S', amount: 1 }],
  });
  expect(backupStatus(state, '2026-02-15').due).toBe(true);
  expect(backupStatus(state, '2026-02-15', '2026-02-10').due).toBe(false);
  expect(backupStatus(state, '2026-02-15', '2026-02-01').due).toBe(true);
});

test('full house expense adds spending that was not recorded', () => {
  const state = data({
    income: [{ id: 'i', date: '2026-03-01', member: 'A', source: 'S', amount: 100 }],
    monthlyBalances: [
      { month: '2026-03', startBalance: 10 },
      { month: '2026-04', startBalance: 50 },
    ],
  });
  expect(fullHouseExpense(state, '2026-03')).toBe(60);
  expect(fullHouseExpense(data(), '2026-03')).toBe(0);
});

test('balance history lists completed months of one financial year, with their parts', () => {
  const contribution = (id: string, holdingId: string, amount: number) => ({
    id,
    holdingId,
    date: '2026-04-05',
    amount,
    automatic: false,
  });
  const state = data({
    holdings: [
      holding({ id: 'pms', type: 'Stallion PMS' }),
      holding({ id: 'nps', kind: 'nps', type: 'NPS' }),
    ],
    contributions: [contribution('c1', 'pms', 5), contribution('c2', 'nps', 7)],
    income: [{ id: 'i', date: '2026-04-01', member: 'A', source: 'S', amount: 100 }],
    expenses: [
      {
        id: 'e',
        date: '2026-04-02',
        category: 'Food',
        subcategory: '',
        isAnnual: false,
        amount: 20,
      },
    ],
    monthlyBalances: [
      { month: '2026-03', startBalance: 1 },
      { month: '2026-04', startBalance: 10 },
      { month: '2026-05', startBalance: 50 },
      { month: '2026-06', startBalance: 60 },
    ],
  });
  const rows = balanceHistory(state, 2026, '2026-06-15');
  expect(rows.map((row) => row.month)).toEqual(['2026-05', '2026-04']);
  expect(rows[1]).toEqual({
    month: '2026-04',
    opening: 10,
    income: 100,
    expenses: 20,
    pms: 5,
    retirement: 7,
    surplus: 85,
    houseExpense: 35,
  });
  expect(balanceYears(state, '2026-06-15')).toEqual([2026, 2025]);
});

test('month reviews follow the household, whichever profile is selected', () => {
  const household = data({
    income: [
      { id: 'a', date: '2026-03-01', member: 'A', source: 'S', amount: 100 },
      { id: 'b', date: '2026-03-02', member: 'B', source: 'S', amount: 50 },
    ],
    monthlyBalances: [
      { month: '2026-03', startBalance: 10 },
      { month: '2026-04', startBalance: 20 },
    ],
  });
  const reviewed = {
    ...household,
    monthReviews: [
      {
        id: 'month_2026-03',
        month: '2026-03',
        signature: monthSignature(household, '2026-03'),
        reviewedAt: '2026-04-01',
      },
    ],
  };
  const view = { ...reviewed, income: reviewed.income.filter((row) => row.member === 'A') };
  const labels = attentionItems(view, reviewed, '2026-04-15', 0).map((row) => row.label);
  expect(labels.filter((label) => label.includes('balance review'))).toEqual([]);
});

test('a running month asks for review only on its last day', () => {
  const state = data({ monthlyBalances: [{ month: '2026-03', startBalance: 10 }] });
  expect(monthsToReview(state, '2026-03-15')).toEqual([]);
  expect(monthsToReview(state, '2026-03-31')).toEqual(['2026-03']);
  expect(monthsToReview(state, '2026-04-02')).toEqual(['2026-03']);
});

test('member positions total each person', () => {
  const rows = holdingRows(
    data({ holdings: [holding({}), holding({ id: 'b', member: 'B', openingValue: 90_000 })] }),
    '2026-01-01',
  );
  expect(memberPositions(rows).map((row) => [row.member, row.gain])).toEqual([
    ['A', 50_000],
    ['B', -10_000],
  ]);
});

describe('one pass over the records gives the same figures', () => {
  const sample = { ...emptyTrackerData(), ...previewData() };
  const months = sample.monthlyBalances.map((row) => row.month);

  test('every month closes as it does on its own', () => {
    const closeOf = monthCloser(sample);
    expect(sample.contributions.length).toBeGreaterThan(0);
    for (const month of months) expect(closeOf(month)).toEqual(closeMonth(sample, month));
  });

  test('months to review match each month checked on its own', () => {
    const [first, second] = [...months].sort();
    const reviewed = {
      ...sample,
      monthReviews: [
        {
          id: 'a',
          month: first ?? '',
          signature: monthSignature(sample, first ?? ''),
          reviewedAt: '2026-01-01',
        },
        { id: 'b', month: second ?? '', signature: 'stale', reviewedAt: '2026-01-01' },
      ],
    };
    const today = '2026-11-15';
    const expected = months
      .filter((month) => month <= today.slice(0, 7))
      .filter((month) => {
        const close = closeMonth(reviewed, month);
        if (month === today.slice(0, 7)) return close.opening === null;
        return !close.complete || !monthReviewStatus(reviewed, month).reviewed;
      })
      .sort()
      .reverse();
    expect(monthsToReview(reviewed, today)).toEqual(expected);
    expect(monthsToReview(reviewed, today)).not.toContain(first);
    expect(monthsToReview(reviewed, today)).toContain(second);
  });
});
