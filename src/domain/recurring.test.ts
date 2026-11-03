import { createRequire } from 'node:module';
import type { Expense, Loan, RecurringRule } from '../schema/records';
import { isLoanFailure, rebuildLoan } from './loan';
import {
  amountAt,
  applyOccurrences,
  loanPayments,
  pendingOccurrences,
  stopSchedules,
  upcomingCommitments,
  withAmountChange,
  validateRecurring,
  type RecurringData,
} from './recurring';

const salary: RecurringRule = {
  id: 'sal',
  kind: 'income',
  name: 'Salary',
  member: 'Taylor',
  source: 'Salary',
  amount: 50_000,
  day: 1,
  startMonth: '2026-08',
  paused: false,
  amountChanges: [{ month: '2026-09', amount: 55_000 }],
};
const rent: RecurringRule = {
  id: 'rent',
  kind: 'expense',
  name: 'Rent',
  category: 'House Rent',
  subcategory: '',
  isAnnual: false,
  amount: 20_000,
  day: 0,
  startMonth: '2026-09',
  paused: false,
  amountChanges: [],
};
const emi: RecurringRule = {
  id: 'emi',
  kind: 'emi',
  name: 'Home EMI',
  loanId: 'loan',
  day: 10,
  startMonth: '2026-08',
  paused: false,
};
const loan: Loan = {
  id: 'loan',
  type: 'Home Loan',
  member: 'Taylor',
  date: '2026-07-01',
  principal: 1_000_000,
  openingRate: 7.5,
  openingEmi: 20_000,
  changes: [],
};
const empty = (overrides: Partial<RecurringData> = {}): RecurringData => ({
  rules: [],
  occurrences: [],
  income: [],
  expenses: [],
  loans: [],
  ...overrides,
});
const TODAY = '2026-10-23';

test('lists missed and due months with dated amounts', () => {
  const rows = pendingOccurrences(empty({ rules: [salary] }), TODAY);
  expect(rows.map(({ month, amount, missed }) => [month, amount, missed])).toEqual([
    ['2026-08', 50_000, true],
    ['2026-09', 55_000, true],
    ['2026-10', 55_000, false],
  ]);
});

test('day 0 means the last day of the month', () => {
  const rows = pendingOccurrences(empty({ rules: [rent] }), TODAY);
  expect(rows.map((row) => row.date)).toEqual(['2026-09-30']);
});

test('offers an existing manual record as a match', () => {
  const manual: Expense = {
    id: 'manual',
    date: '2026-09-12',
    category: 'House Rent',
    subcategory: '',
    amount: 20_000,
    isAnnual: false,
  };
  const data = empty({ rules: [rent], expenses: [manual] });
  expect(pendingOccurrences(data, TODAY)[0]?.existing).toBe('manual');
  const result = applyOccurrences(data, [{ ruleId: 'rent', month: '2026-09' }], TODAY);
  expect(result.data.occurrences).toEqual([
    { ruleId: 'rent', month: '2026-09', status: 'matched', recordId: 'manual' },
  ]);
  expect(result.data.expenses).toHaveLength(1);
});

test('posting is immutable and cannot repeat', () => {
  const data = empty({ rules: [salary] });
  const first = applyOccurrences(data, [{ ruleId: 'sal', month: '2026-08' }], TODAY);
  expect(data.income).toEqual([]);
  expect(first.data.income[0]?.id).toBe('rec_sal_202608');
  const second = applyOccurrences(first.data, [{ ruleId: 'sal', month: '2026-08' }], TODAY);
  expect(second.changed).toBe(0);
});

test('EMI months post in order, using the ledger quote', () => {
  const data = empty({ rules: [emi], loans: [loan] });
  const skipped = applyOccurrences(data, [{ ruleId: 'emi', month: '2026-09' }], TODAY);
  expect(skipped.errors).toEqual(['Home EMI: review earlier missed payments first.']);
  const posted = applyOccurrences(data, [{ ruleId: 'emi', month: '2026-08' }], TODAY);
  expect(posted.data.expenses[0]).toMatchObject({ amount: 20_000, loanId: 'loan' });
});

test('stopping keeps rules with history and removes the rest', () => {
  const posted = applyOccurrences(
    empty({ rules: [salary, rent] }),
    [{ ruleId: 'sal', month: '2026-08' }],
    TODAY,
  ).data;
  const stopped = stopSchedules(posted, () => true, '2026-10');
  expect(stopped.rules.map((rule) => [rule.id, rule.archived])).toEqual([['sal', true]]);
});

test('a new amount applies from its month and keeps earlier months', () => {
  const rule = withAmountChange(
    rent as Extract<RecurringRule, { kind: 'expense' }>,
    35_000,
    '2026-11',
  );
  expect(amountAt(rule, '2026-10')).toBe(20_000);
  expect(amountAt(rule, '2026-11')).toBe(35_000);
  expect(withAmountChange(rule, 35_000, '2026-12')).toBe(rule);
});

test('upcoming commitments list what is scheduled, soonest first', () => {
  const data = empty({ rules: [rent, emi], loans: [loan] });
  const rows = upcomingCommitments(data, '2026-10-05', '2026-11-04');
  expect(rows.map(({ name, date, amount }) => [name, date, amount])).toEqual([
    ['Home EMI', '2026-10-10', 20_000],
    ['Rent', '2026-10-31', 20_000],
  ]);
});

test('rejects two active EMI schedules for one loan', () => {
  const data = empty({ rules: [emi, { ...emi, id: 'other' }] });
  expect(() => validateRecurring(data)).toThrow(/Only one active/);
});

/** The legacy module is the reference until it is deleted at cutover. */
test('matches the legacy planner across schedules and loans', () => {
  const require = createRequire(import.meta.url);
  const legacy = require('./reference/recurring.cjs');
  const legacyLedger = require('./reference/loan-ledger.cjs');

  const toLegacy = (data: RecurringData) => ({
    recurringRules: data.rules.map((rule) => ({ endMonth: '', amountChanges: [], ...rule })),
    recurringOccurrences: data.occurrences,
    income: data.income,
    expenses: data.expenses,
    debts: data.loans.map(({ changes, ...row }) => {
      const ledger = rebuildLoan({ ...row, changes }, loanPayments(data.expenses, row.id), {
        asOf: TODAY,
      });
      if (isLoanFailure(ledger)) throw new Error(ledger.error);
      const { remaining, interestPaid, rate, emi: current } = ledger;
      return { ...row, loanChanges: changes, remaining, interestPaid, rate, emi: current };
    }),
  });
  const summary = (rows: { id: string; date: string; amount: number }[]) =>
    rows.map(({ id, date, amount }) => ({ id, date, amount }));

  for (const day of [0, 1, 10, 15, 28, 31]) {
    const rules: RecurringRule[] = [
      { ...salary, day },
      { ...rent, day },
      { ...emi, day },
    ];
    const data = empty({ rules, loans: [loan] });
    const planned = pendingOccurrences(data, TODAY);
    expect(planned).toEqual(legacy.pending(toLegacy(data), TODAY));

    const requests = planned.map(({ ruleId, month }) => ({ ruleId, month }));
    const result = applyOccurrences(data, requests, TODAY);
    const reference = legacy.apply(toLegacy(data), requests, legacyLedger, TODAY);
    expect(result.errors).toEqual(reference.errors);
    expect(result.changed).toBe(reference.changed);
    expect(result.data.occurrences).toEqual(reference.data.recurringOccurrences);
    expect(summary(result.data.income)).toEqual(summary(reference.data.income));
    expect(summary(result.data.expenses)).toEqual(summary(reference.data.expenses));
  }
});
