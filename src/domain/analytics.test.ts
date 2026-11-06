import { previewData } from '../data/previewData';
import { emptyTrackerData, type TrackerData } from '../data/repository';
import { holdingPosition } from './holdings';
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
  houseExpenses,
  houseExpenseToSave,
  investedFromIncome,
  monthCloser,
  monthlyOverview,
  monthReviewStatus,
  monthSignature,
  withHouseExpenses,
  monthsToReview,
  netWorthHistory,
  pmsGainChange,
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

test('investing from income leaves out PF and NPS, which come out of salary first', () => {
  const contribution = (id: string, holdingId: string, amount: number, skipped = false) => ({
    id,
    holdingId,
    date: '2026-10-05',
    amount,
    automatic: false,
    ...(skipped ? { skipped } : {}),
  });
  const state: TrackerData = {
    ...emptyTrackerData(),
    holdings: [
      holding({ id: 'fund' }),
      holding({ id: 'pf', kind: 'pf', type: 'PF' }),
      holding({ id: 'nps', kind: 'nps', type: 'NPS' }),
      holding({ id: 'ppf', kind: 'ppf', type: 'PPF' }),
    ],
    contributions: [
      contribution('a', 'fund', 20_000),
      contribution('b', 'pf', 9_000),
      contribution('c', 'nps', 5_000),
      contribution('d', 'ppf', 3_000),
      contribution('e', 'fund', 7_000, true),
    ],
    income: [{ id: 'i', date: '2026-10-01', member: 'A', source: 'Salary', amount: 1_00_000 }],
  };
  expect(investedFromIncome(state).get('2026-10')).toBe(23_000);
});

test('investing from income counts only from when tracking began', () => {
  // Past SIPs entered for August, before any income or spending was recorded.
  const state: TrackerData = {
    ...emptyTrackerData(),
    holdings: [holding({ id: 'fund' })],
    contributions: [
      { id: 'a', holdingId: 'fund', date: '2026-08-05', amount: 16_25_000, automatic: false },
      { id: 'b', holdingId: 'fund', date: '2026-11-05', amount: 20_000, automatic: false },
    ],
    income: [{ id: 'i', date: '2026-11-01', member: 'A', source: 'Salary', amount: 1_00_000 }],
  };
  expect([...investedFromIncome(state)]).toEqual([['2026-11', 20_000]]);
  expect(investedFromIncome({ ...state, income: [] }).size).toBe(0);
});

describe('house expense from the bank balances', () => {
  // October: opened at ₹50,000, earned ₹1,00,000, recorded ₹40,000 of spending and invested
  // ₹20,000 from the bank, so ₹90,000 should be left. The bank shows ₹75,000 on November 1.
  const spend = (id: string, date: string, amount: number) => ({
    id,
    date,
    category: 'Food',
    subcategory: '',
    isAnnual: false,
    amount,
  });
  const october = (extra: Partial<TrackerData> = {}): TrackerData => ({
    ...emptyTrackerData(),
    holdings: [holding({ id: 'fund' }), holding({ id: 'pf', kind: 'pf', type: 'PF' })],
    income: [{ id: 'i', date: '2026-10-01', member: 'A', source: 'Salary', amount: 1_00_000 }],
    expenses: [spend('e', '2026-10-10', 40_000)],
    contributions: [
      { id: 'c', holdingId: 'fund', date: '2026-10-05', amount: 20_000, automatic: false },
      { id: 'p', holdingId: 'pf', date: '2026-10-05', amount: 9_000, automatic: true },
    ],
    monthlyBalances: [
      { month: '2026-10', startBalance: 50_000 },
      { month: '2026-11', startBalance: 75_000 },
    ],
    ...extra,
  });

  test('is what the closing balance falls short of, after investing from income', () => {
    expect(closeMonth(october(), '2026-10')).toMatchObject({
      available: 90_000,
      unrecorded: 15_000,
    });
    expect(houseExpenses(october())).toEqual([
      expect.objectContaining({
        date: '2026-10-31',
        category: 'Unrecorded house expense',
        amount: 15_000,
      }),
    ]);
  });

  test('counts in spending, and shrinks when a forgotten expense is added', () => {
    const counted = withHouseExpenses(october(), october());
    expect(monthlyOverview(counted, '2026-10', '2026-11-05').spent).toBe(55_000);
    const later = october({
      expenses: [spend('e', '2026-10-10', 40_000), spend('f', '2026-10-20', 5_000)],
    });
    expect(houseExpenses(later)[0]?.amount).toBe(10_000);
  });

  test('adds nothing when the bank holds more than expected, or a month is open', () => {
    const more = october({
      monthlyBalances: [
        { month: '2026-10', startBalance: 50_000 },
        { month: '2026-11', startBalance: 95_000 },
      ],
    });
    expect(houseExpenses(more)).toEqual([]);
    expect(
      houseExpenses(october({ monthlyBalances: [{ month: '2026-10', startBalance: 50_000 }] })),
    ).toEqual([]);
  });

  test('once saved at review, the entry counts instead, and the gap stays the same', () => {
    const entry = houseExpenseToSave(october(), '2026-10');
    expect(entry).toMatchObject({ id: 'unrecorded-2026-10', date: '2026-10-31', amount: 15_000 });
    const saved = october({ expenses: [...october().expenses, ...(entry ? [entry] : [])] });
    // The gap and the review's signature don't move once the entry is saved.
    expect(closeMonth(saved, '2026-10').unrecorded).toBe(15_000);
    expect(monthSignature(saved, '2026-10')).toBe(monthSignature(october(), '2026-10'));
    // No worked-out figure on top of the saved one, so it's counted once.
    expect(houseExpenses(saved)).toEqual([]);
    const counted = withHouseExpenses(saved, saved);
    expect(monthlyOverview(counted, '2026-10', '2026-11-05').close.expenses).toBe(40_000);
    expect(counted.expenses.filter((row) => row.date.startsWith('2026-10'))).toHaveLength(2);
  });

  test("a month's spending is the same before and after its review", () => {
    const before = withHouseExpenses(october(), october());
    const entry = houseExpenseToSave(october(), '2026-10');
    const reviewed = october({ expenses: [...october().expenses, ...(entry ? [entry] : [])] });
    const after = withHouseExpenses(reviewed, reviewed);
    expect(monthlyOverview(before, '2026-10', '2026-11-05').spent).toBe(55_000);
    expect(monthlyOverview(after, '2026-10', '2026-11-05').spent).toBe(55_000);
    // The available balance is after recorded activity, both times.
    expect(monthlyOverview(before, '2026-10', '2026-11-05').close.available).toBe(90_000);
    expect(monthlyOverview(after, '2026-10', '2026-11-05').close.available).toBe(90_000);
  });

  test('nothing to save when the bank held as much as expected', () => {
    const more = october({
      monthlyBalances: [
        { month: '2026-10', startBalance: 50_000 },
        { month: '2026-11', startBalance: 95_000 },
      ],
    });
    expect(houseExpenseToSave(more, '2026-10')).toBeNull();
  });

  test('a review signed before investing was counted still matches', () => {
    const before = october();
    expect(monthSignature(before, '2026-10')).toBe(
      JSON.stringify({ ...closeMonth({ ...before, contributions: [] }, '2026-10') }),
    );
  });
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
    // PMS leaves the bank; NPS comes out of salary first, so it isn't taken off.
    invested: 5,
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

describe('past dates use the valuation from that date', () => {
  const valuation = (id: string, date: string, value: number) => ({
    id,
    holdingId: 'pms',
    date,
    value,
  });
  const state = data({
    holdings: [
      holding({
        id: 'pms',
        type: 'Stallion PMS',
        date: '2026-01-01',
        openingInvested: 100,
        openingValue: 100,
      }),
    ],
    valuations: [
      valuation('a', '2026-01-31', 100),
      valuation('b', '2026-02-28', 120),
      valuation('c', '2026-03-31', 150),
    ],
  });
  const position = (date: string) => holdingPosition(state.holdings[0] as Holding, state, date);

  test('each month keeps its own gain', () => {
    expect(position('2026-01-31').gain).toBe(0);
    expect(position('2026-02-28').gain).toBe(20);
    expect(position('2026-03-31').gain).toBe(50);
  });

  test('the monthly gain change compares those months', () => {
    expect(pmsGainChange(state, '2026-03')).toBe(30);
    expect(pmsGainChange(state, '2026-02')).toBe(20);
  });

  test('a month with no update carries the last gain forward', () => {
    expect(position('2026-04-30').gain).toBe(50);
    expect(pmsGainChange(state, '2026-04')).toBeNull();
  });

  test('a valuation dated later does not count yet', () => {
    expect(position('2026-01-15').current).toBe(100);
  });

  test('today still uses the newest value', () => {
    expect(position('2026-11-02').current).toBe(150);
  });

  test('a contribution after a valuation adds to value without changing gain', () => {
    const paid = {
      ...state,
      contributions: [
        { id: 'x', holdingId: 'pms', date: '2026-03-10', amount: 40, automatic: false },
      ],
    };
    const at = holdingPosition(paid.holdings[0] as Holding, paid, '2026-03-15');
    expect(at.invested).toBe(140);
    expect(at.current).toBe(160);
    expect(at.gain).toBe(20);
  });
});

describe('the monthly PMS value reminder', () => {
  const label = 'Update Stallion PMS current value';
  const pms = holding({ id: 'pms', type: 'Stallion PMS', date: '2026-01-10' });
  const labels = (state: TrackerData, today: string) =>
    attentionItems(state, state, today, 0).map((row) => row.label);
  const valued = (date: string) =>
    data({ holdings: [pms], valuations: [{ id: 'v', holdingId: 'pms', date, value: 1 }] });

  test('appears on the 1st, and links to PMS', () => {
    const state = valued('2026-03-31');
    expect(labels(state, '2026-03-31')).not.toContain(label);
    expect(labels(state, '2026-04-01')).toContain(label);
    const item = attentionItems(state, state, '2026-04-01', 0).find((row) => row.label === label);
    expect(item).toMatchObject({ path: '/investments', state: { open: 'Stallion PMS' } });
  });

  test('stays until this month has a value', () => {
    expect(labels(valued('2026-03-31'), '2026-04-20')).toContain(label);
    expect(labels(valued('2026-04-03'), '2026-04-20')).not.toContain(label);
  });

  test('a new account, or no PMS, asks nothing', () => {
    expect(labels(data({ holdings: [pms] }), '2026-01-20')).not.toContain(label);
    expect(labels(data({ holdings: [holding({})] }), '2026-04-01')).not.toContain(label);
  });
});

describe('net worth history', () => {
  const fund = holding({
    id: 'f',
    date: '2026-01-10',
    openingInvested: 100,
    openingValue: 100,
  });
  const loanRow = {
    id: 'l',
    type: 'Car',
    member: 'A',
    date: '2026-02-15',
    principal: 50,
    openingRate: 0,
    openingEmi: 10,
    changes: [],
  };
  const state = data({
    holdings: [fund],
    loans: [loanRow],
    valuations: [
      { id: 'v1', holdingId: 'f', date: '2026-01-31', value: 110 },
      { id: 'v2', holdingId: 'f', date: '2026-03-31', value: 150 },
    ],
  });

  test('each month end uses what was true then', () => {
    expect(netWorthHistory(state, '2026-04-15')).toEqual([
      { month: '2026-01', assets: 110, debts: 0, netWorth: 110, estimated: false },
      { month: '2026-02', assets: 110, debts: 50, netWorth: 60, estimated: true },
      { month: '2026-03', assets: 150, debts: 50, netWorth: 100, estimated: false },
      { month: '2026-04', assets: 150, debts: 50, netWorth: 100, estimated: true },
    ]);
  });

  test('debts fall month by month as EMIs are paid, not all at once', () => {
    const emi = (id: string, date: string) => ({
      id,
      date,
      category: 'EMI Payment',
      subcategory: '',
      isAnnual: false,
      amount: 10,
      loanId: 'l',
      repaymentType: 'emi' as const,
    });
    const paying = {
      ...state,
      expenses: [emi('p1', '2026-03-01'), emi('p2', '2026-04-01')],
    };
    const debts = netWorthHistory(paying, '2026-04-15').map((row) => row.debts);
    expect(debts).toEqual([0, 50, 40, 30]);
  });

  test('a later top-up does not count before its date', () => {
    const topped = {
      ...state,
      loans: [
        {
          ...loanRow,
          changes: [
            {
              id: 't',
              date: '2026-04-01',
              type: 'topup' as const,
              amount: 20,
              repaymentChoice: 'emi' as const,
            },
          ],
        },
      ],
    };
    const debts = netWorthHistory(topped as never, '2026-04-15').map((row) => row.debts);
    expect(debts).toEqual([0, 50, 50, 70]);
  });

  test('accounts only count once they started', () => {
    const [january] = netWorthHistory(state, '2026-04-15');
    expect(january?.debts).toBe(0);
  });

  test('history stops at the limit, newest kept', () => {
    const rows = netWorthHistory(state, '2026-04-15', 2);
    expect(rows.map((row) => row.month)).toEqual(['2026-03', '2026-04']);
  });

  test('fixed-return accounts are not estimates', () => {
    const fixed = data({ holdings: [{ ...fund, type: 'Bonds' }] });
    expect(netWorthHistory(fixed, '2026-02-15').every((row) => !row.estimated)).toBe(true);
  });

  test('a tracker with no accounts has no history', () => {
    expect(netWorthHistory(data(), '2026-04-15')).toEqual([]);
  });
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
