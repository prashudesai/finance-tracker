import { loanSchema, type Loan, type RecurringRule } from '../schema/records';
import {
  dailyStatement,
  estimateExtraFirstEmiInterest,
  estimateSchedule,
  isLoanFailure,
  quotePayment,
  rebuildLoan,
  validateLoan,
  type LoanLedger,
  type LoanPayment,
} from './loan';
import { monthlyAnniversary } from './calendar';
import { applyOccurrences, pendingOccurrences, type RecurringData } from './recurring';

/** Exact figures from the legacy suites, kept as named scenarios after legacy is deleted. */

function ledger(loan: Loan, payments: LoanPayment[], asOf?: string): LoanLedger {
  const result = rebuildLoan(loan, payments, asOf === undefined ? {} : { asOf });
  if (isLoanFailure(result)) throw new Error(result.error);
  return result;
}

function failure(loan: Loan, payments: LoanPayment[] = []) {
  const result = rebuildLoan(loan, payments);
  return isLoanFailure(result) ? result.error : '';
}

function quoted(loan: Loan, payments: LoanPayment[], date: string) {
  const result = quotePayment(loan, payments, date);
  if (isLoanFailure(result)) throw new Error(result.error);
  return result.amount;
}

const recurringData = (loan: Loan, rule: RecurringRule): RecurringData => ({
  rules: [rule],
  occurrences: [],
  income: [],
  expenses: [],
  loans: [loan],
});

const emiRule = (startMonth: string, day: number): RecurringRule => ({
  id: 'r',
  kind: 'emi',
  name: 'Loan EMI',
  loanId: 'loan',
  day,
  startMonth,
  paused: false,
});

describe('first EMI after a delay', () => {
  const loan = (overrides: Partial<Loan> = {}): Loan => ({
    id: 'loan',
    type: 'Personal Loan',
    member: 'A',
    principal: 1_500_000,
    openingRate: 10,
    openingEmi: 32_131,
    date: '2026-10-15',
    emiDueDay: 5,
    firstEmiDate: '2026-12-05',
    firstEmiExtraInterest: 8000,
    changes: [],
    ...overrides,
  });
  const pay = (id: string, date: string, amount = 40_131, extra: Partial<LoanPayment> = {}) => ({
    id,
    date,
    amount,
    repaymentType: 'emi' as const,
    ...extra,
  });
  const rule = emiRule('2026-10', 5);

  test('a December first date prevents November posting', () => {
    expect(pendingOccurrences(recurringData(loan(), rule), '2026-11-30')).toHaveLength(0);
  });

  test('nothing posts before the first date, and it is due on that date', () => {
    const data = recurringData(loan(), rule);
    expect(pendingOccurrences(data, '2026-12-04')).toHaveLength(0);
    expect(pendingOccurrences(data, '2026-12-05')[0]?.date).toBe('2026-12-05');
  });

  test('the first quote includes the bank extra and is pure', () => {
    const input = loan();
    const before = JSON.stringify(input);
    expect(quoted(input, [], '2026-12-05')).toBe(40_131);
    expect(JSON.stringify(input)).toBe(before);
  });

  test('the extra counts wholly as interest', () => {
    const result = ledger(loan(), [pay('one', '2026-12-05')]);
    expect(result.payments[0]).toMatchObject({ interestPaid: 20_500, principalPaid: 19_631 });
    expect(result.remaining).toBe(1_480_369);
    expect(result.emi).toBe(32_131);
  });

  test('the second EMI has no extra, and replay is stable', () => {
    const first = pay('one', '2026-12-05');
    expect(quoted(loan(), [first], '2027-01-05')).toBe(32_131);
    const rows = [first, pay('two', '2027-01-05', 32_131)];
    const result = ledger(loan(), rows);
    expect(result.payments[1]).toMatchObject({ interestPaid: 12_336, principalPaid: 19_795 });
    expect(result).toEqual(ledger(loan(), rows));
  });

  test('a part payment before the first EMI does not use up the extra', () => {
    const part = pay('part', '2026-11-01', 100_000, { repaymentType: 'part-payment' });
    expect(quoted(loan(), [part], '2026-12-05')).toBe(40_131);
    const result = ledger(loan(), [part, pay('first', '2026-12-05')]);
    expect(result.payments[1]?.interestPaid).toBeGreaterThan(8000);
    expect(result.payments[0]?.interestPaid).toBe(0);
  });

  test('a statement override already includes the extra', () => {
    const row = pay('first', '2026-12-05', 40_131, {
      interestOverride: true,
      interestPaid: 21_000,
    });
    expect(ledger(loan(), [row]).payments[0]).toMatchObject({
      interestPaid: 21_000,
      principalPaid: 19_131,
    });
  });

  test('a payment before the first date is rejected without changes', () => {
    const input = loan();
    const rows = [pay('one', '2026-11-05')];
    const before = JSON.stringify([input, rows]);
    expect(failure(input, rows)).toMatch(/first EMI date/);
    expect(JSON.stringify([input, rows])).toBe(before);
  });

  test('a bank-confirmed first date may be under 30 days', () => {
    const near = loan({ firstEmiDate: '2026-11-05' });
    const data = recurringData(near, rule);
    expect(pendingOccurrences(data, '2026-11-05')[0]?.date).toBe('2026-11-05');
    expect(failure(near, [pay('one', '2026-11-05')])).toBe('');
  });

  test('no first date and zero extra keep the regular amount', () => {
    const plainLoan = loan();
    delete plainLoan.firstEmiDate;
    delete plainLoan.firstEmiExtraInterest;
    expect(quoted(plainLoan, [], '2026-12-05')).toBe(32_131);
    expect(pendingOccurrences(recurringData(plainLoan, rule), '2026-11-30')).toHaveLength(0);
    expect(quoted(loan({ firstEmiExtraInterest: 0 }), [], '2026-12-05')).toBe(32_131);
  });

  test('invalid setups are rejected', () => {
    expect(() => validateLoan(loan({ firstEmiDate: '2026-02-30' }))).toThrow();
    expect(() => validateLoan(loan({ firstEmiDate: '2026-10-15' }))).toThrow();
    expect(loanSchema.safeParse(loan({ firstEmiExtraInterest: -1 })).success).toBe(false);
    const noDate = loan();
    delete noDate.firstEmiDate;
    expect(() => validateLoan(noDate)).toThrow();
    expect(() => validateLoan(loan({ emiDueDay: 10 }))).toThrow();
  });

  test('due day 31 accepts a clamped February first date', () => {
    expect(() =>
      validateLoan(loan({ date: '2026-01-10', emiDueDay: 31, firstEmiDate: '2026-02-28' })),
    ).not.toThrow();
  });

  test('a recurring EMI applies the extra once and cannot repeat', () => {
    const data = recurringData(loan(), rule);
    const requests = pendingOccurrences(data, '2026-12-05');
    const first = applyOccurrences(data, requests, '2026-12-05');
    expect(first.errors).toEqual([]);
    expect(first.data.expenses[0]?.amount).toBe(40_131);
    const again = pendingOccurrences(first.data, '2026-12-05');
    expect(applyOccurrences(first.data, again, '2026-12-05').changed).toBe(0);
    const later = pendingOccurrences(first.data, '2027-01-05');
    expect(applyOccurrences(first.data, later, '2027-01-05').data.expenses[1]?.amount).toBe(32_131);
  });

  test('the payoff cap includes extra interest', () => {
    expect(quoted(loan({ principal: 1000 }), [], '2026-12-05')).toBe(9008);
  });
});

describe('short first interest period', () => {
  const loan = (overrides: Partial<Loan> = {}): Loan => ({
    id: 'loan',
    type: 'Home Loan',
    member: 'A',
    date: '2026-03-01',
    firstEmiDate: '2026-03-05',
    emiDueDay: 5,
    principal: 1_000_000,
    openingRate: 12,
    openingEmi: 50_000,
    firstEmiInterestMethod: 'short-actual365',
    changes: [],
    ...overrides,
  });
  const pay = (id: string, date: string, amount = 50_000, extra: Partial<LoanPayment> = {}) => ({
    id,
    date,
    amount,
    repaymentType: 'emi' as const,
    ...extra,
  });

  test('1 to 5 March is four elapsed days, not a month', () => {
    const result = ledger(loan(), [pay('p', '2026-03-05')]);
    expect(result.payments[0]).toMatchObject({ interestPaid: 1315, principalPaid: 48_685 });
    expect(result.remaining).toBe(951_315);
  });

  test('the second EMI returns to monthly interest', () => {
    const result = ledger(loan(), [pay('p', '2026-03-05'), pay('q', '2026-04-05')]);
    expect(result.payments[1]?.interestPaid).toBe(9513);
  });

  test('monthly loans keep the monthly calculation', () => {
    const monthly = loan({ firstEmiInterestMethod: 'monthly' });
    expect(ledger(monthly, [pay('p', '2026-03-05')]).payments[0]?.interestPaid).toBe(10_000);
  });

  test.each(['2026-04-01', '2026-05-01'])('a first EMI on %s stays monthly', (date) => {
    const later = loan({ firstEmiDate: date, emiDueDay: 1 });
    expect(ledger(later, [pay('p', date)]).payments[0]?.interestPaid).toBe(10_000);
  });

  test('a shorter February anniversary counts as a full month', () => {
    const feb = loan({ date: '2026-01-31', firstEmiDate: '2026-02-28', emiDueDay: 31 });
    expect(ledger(feb, [pay('p', '2026-02-28')]).payments[0]?.interestPaid).toBe(10_000);
  });

  test('a leap-year short period uses actual days on a 365 basis', () => {
    const leap = loan({ date: '2024-02-28', firstEmiDate: '2024-03-01', emiDueDay: 1 });
    expect(ledger(leap, [pay('p', '2024-03-01')]).payments[0]?.interestPaid).toBe(658);
  });

  test('a part payment before the first EMI adjusts principal days', () => {
    const part = pay('part', '2026-03-03', 100_000, { repaymentType: 'part-payment' });
    expect(ledger(loan(), [part, pay('p', '2026-03-05')]).payments[1]?.interestPaid).toBe(1249);
  });

  test('a top-up before the first EMI adjusts principal days', () => {
    const topped = loan({
      changes: [{ id: 'top', date: '2026-03-03', type: 'topup', amount: 100_000 }],
    });
    expect(ledger(topped, [pay('p', '2026-03-05')]).payments[0]?.interestPaid).toBe(1381);
  });

  test('extra first interest is added exactly once', () => {
    const extra = loan({ firstEmiExtraInterest: 500 });
    expect(quoted(extra, [], '2026-03-05')).toBe(50_500);
    const result = ledger(extra, [pay('p', '2026-03-05', 50_500), pay('q', '2026-04-05')]);
    expect(result.payments[0]).toMatchObject({ interestPaid: 1815, principalPaid: 48_685 });
    expect(result.payments[1]?.interestPaid).toBe(9513);
  });

  test('a statement override wins', () => {
    const row = pay('p', '2026-03-05', 50_000, { interestOverride: true, interestPaid: 1500 });
    expect(ledger(loan(), [row]).payments[0]?.interestPaid).toBe(1500);
  });

  test('switching method replays fixed amounts and is pure', () => {
    const rows = [pay('p', '2026-03-05'), pay('q', '2026-04-05')];
    const input = loan();
    const before = JSON.stringify([input, rows]);
    const revised = ledger(input, rows);
    const old = ledger(loan({ firstEmiInterestMethod: 'monthly' }), rows);
    expect(revised.remaining).toBeLessThan(old.remaining);
    expect(JSON.stringify([input, rows])).toBe(before);
  });

  test('a recurring EMI uses the same split without duplicates', () => {
    const data = recurringData(loan(), emiRule('2026-03', 5));
    const result = applyOccurrences(data, pendingOccurrences(data, '2026-03-05'), '2026-03-05');
    expect(result.errors).toEqual([]);
    const payments = result.data.expenses;
    expect(ledger(loan(), payments).payments[0]?.interestPaid).toBe(1315);
    const again = pendingOccurrences(result.data, '2026-03-05');
    expect(applyOccurrences(result.data, again, '2026-03-05').changed).toBe(0);
  });

  test('an invalid method is rejected', () => {
    const invalid = { ...loan(), firstEmiInterestMethod: 'other' };
    expect(loanSchema.safeParse(invalid).success).toBe(false);
  });

  test('zero rate, and the final payment cap', () => {
    expect(
      ledger(loan({ openingRate: 0 }), [pay('p', '2026-03-05')]).payments[0]?.interestPaid,
    ).toBe(0);
    expect(quoted(loan({ principal: 1000 }), [], '2026-03-05')).toBe(1001);
  });

  test('extra days after a full month are estimated at actual/365', () => {
    const delayed = loan({ date: '2026-03-01', firstEmiDate: '2026-04-05' });
    expect(monthlyAnniversary(delayed.date)).toBe('2026-04-01');
    expect(estimateExtraFirstEmiInterest(delayed)).toBe(1315.07);
    expect(estimateExtraFirstEmiInterest({ ...delayed, firstEmiDate: '2026-03-05' })).toBe(0);
    expect(monthlyAnniversary('2026-01-31')).toBe('2026-02-28');
    expect(
      estimateExtraFirstEmiInterest({ ...delayed, date: '2026-01-31', firstEmiDate: '2026-03-05' }),
    ).toBe(1643.84);
  });

  test('estimated extra interest is included once', () => {
    const delayed = loan({ date: '2026-03-01', firstEmiDate: '2026-04-05' });
    delayed.firstEmiExtraInterest = estimateExtraFirstEmiInterest(delayed);
    const amount = quoted(delayed, [], '2026-04-05');
    expect(amount).toBe(51_315.07);
    const result = ledger(delayed, [pay('first', '2026-04-05', amount)]);
    expect(result.payments[0]).toMatchObject({ interestPaid: 11_315.07, principalPaid: 40_000 });
    expect(result.remaining).toBe(960_000);
  });
});

describe('revised regular EMI', () => {
  const change = {
    id: 'higher',
    type: 'emi' as const,
    date: '2026-05-05',
    emi: 82_000,
    repaymentChoice: 'manual' as const,
    notes: 'Higher regular payment',
  };
  const loan = (overrides: Partial<Loan> = {}): Loan => ({
    id: 'loan',
    type: 'Home Loan',
    member: 'A',
    principal: 2_000_000,
    date: '2026-03-01',
    openingRate: 12,
    openingEmi: 50_000,
    changes: [],
    ...overrides,
  });
  const pay = (id: string, date: string, amount = 50_000, extra: Partial<LoanPayment> = {}) => ({
    id,
    date,
    amount,
    repaymentType: 'emi' as const,
    ...extra,
  });

  test('a higher EMI shortens the estimated term from its date', () => {
    const result = ledger(loan({ changes: [change] }), []);
    expect(result).toMatchObject({ emi: 82_000, rate: 12, remaining: 2_000_000 });
    const entry = result.history[0];
    expect(entry?.newTerm).toBeLessThan(entry?.oldTerm ?? 0);
    expect(entry?.newTerm).toBe(estimateSchedule(2_000_000, 82_000, 12).count);
  });

  test('earlier payments keep their splits', () => {
    const rows = [pay('one', '2026-04-05')];
    const result = ledger(loan({ changes: [change] }), rows);
    expect(result.payments).toEqual(ledger(loan(), rows).payments);
    expect(result.emi).toBe(82_000);
  });

  test('the suggested EMI changes only from the effective date', () => {
    const revised = loan({ changes: [change] });
    expect(quoted(revised, [], '2026-04-05')).toBe(50_000);
    expect(quoted(revised, [], '2026-05-05')).toBe(82_000);
  });

  test('a one-time part payment keeps the regular EMI', () => {
    const part = pay('extra', '2026-04-01', 32_000, {
      repaymentType: 'part-payment',
      partPaymentAction: 'keep',
    });
    const result = ledger(loan(), [part]);
    expect(result.emi).toBe(50_000);
    expect(result.remaining).toBe(1_968_000);
    expect(estimateSchedule(result.remaining, result.emi, result.rate).count).toBeLessThan(
      estimateSchedule(2_000_000, 50_000, 12).count ?? 0,
    );
  });

  test.each([
    [{ amount: 100 }],
    [{ rate: 10 }],
    [{ emi: 0 }],
    [{ repaymentChoice: 'tenure' as const }],
  ])('an EMI revision cannot also change %j', (extra) => {
    expect(() => validateLoan(loan({ changes: [{ ...change, ...extra }] }))).toThrow();
  });

  test('an EMI below the interest is rejected', () => {
    expect(failure(loan({ changes: [{ ...change, emi: 1000 }] }))).toMatch(/does not cover/);
  });

  test('rate and EMI changes cannot share a date', () => {
    const rate = { id: 'rate', type: 'rate' as const, date: change.date, rate: 10 };
    expect(() => validateLoan(loan({ changes: [change, rate] }))).toThrow(/same date/);
  });

  test('edited and removed revisions replay correctly', () => {
    expect(ledger(loan({ changes: [{ ...change, emi: 90_000 }] }), []).emi).toBe(90_000);
    expect(ledger(loan(), []).emi).toBe(50_000);
  });

  test('a recurring payment uses the revised EMI', () => {
    const data = recurringData(loan({ changes: [change] }), emiRule('2026-05', 5));
    const result = applyOccurrences(data, pendingOccurrences(data, '2026-05-05'), '2026-05-05');
    expect(result.errors).toEqual([]);
    expect(result.data.expenses[0]?.amount).toBe(82_000);
    const split = ledger(loan({ changes: [change] }), result.data.expenses).payments[0];
    expect(split?.principalPaid).toBe(62_000);
  });

  test('the final payment stays capped', () => {
    expect(quoted(loan({ principal: 1000, changes: [change] }), [], '2026-05-05')).toBe(1010);
  });
});

describe('daily-balance loans', () => {
  const loan: Loan = {
    id: 'sbi',
    type: 'Home Loan',
    member: 'A',
    principal: 7_131_650,
    openingRate: 7.5,
    openingEmi: 82_000,
    date: '2026-02-02',
    dailyInterestBasis: true,
    changes: [{ id: 'rate', type: 'rate', date: '2026-02-17', rate: 7.35 }],
  };
  const pay = (id: string, date: string): LoanPayment => ({
    id,
    date,
    amount: 82_000,
    repaymentType: 'emi',
  });
  const payments = [pay('m1', '2026-03-05'), pay('m2', '2026-04-05')];

  test('month-end interest matches the bank figures', () => {
    const { interestCapitalizations } = ledger(loan, payments, '2026-04-30');
    expect(interestCapitalizations.map((row) => row.amount)).toEqual([
      39_214.31, 44_318.04, 42_662.92,
    ]);
  });

  test('the statement lists each event once, in order', () => {
    const withTopup: Loan = {
      ...loan,
      changes: [
        ...loan.changes,
        { id: 'topup', type: 'topup', date: '2026-03-20', amount: 100_000 },
      ],
    };
    const statement = dailyStatement(withTopup, payments, '2026-04-30');
    if (isLoanFailure(statement)) throw new Error(statement.error);
    expect(statement.rows[0]).toMatchObject({ type: 'Disbursement', credit: 7_131_650 });
    const rate = statement.rows.find((row) => row.type === 'Rate change');
    expect(rate).toMatchObject({ debit: 0, credit: 0 });
    expect(statement.rows.find((row) => row.date === '2026-03-05')).toMatchObject({
      type: 'EMI payment',
      debit: 82_000,
    });
  });

  test('interest joins the balance only at month end', () => {
    const current: Loan = {
      id: 'partial',
      type: 'Loan',
      member: 'A',
      principal: 100_000,
      openingRate: 12,
      openingEmi: 10_000,
      date: '2026-09-01',
      dailyInterestBasis: true,
      changes: [],
    };
    const partial = ledger(current, [], '2026-10-24');
    const eve = ledger(current, [], '2026-10-30');
    const monthEnd = ledger(current, [], '2026-10-31');
    expect(partial.interestCapitalizations.at(-1)?.date).toBe('2026-09-30');
    expect(eve.interestCapitalizations.at(-1)?.date).toBe('2026-09-30');
    expect(monthEnd.interestCapitalizations.at(-1)?.date).toBe('2026-10-31');
    expect(partial.accruedInterest).toBeGreaterThan(0);
    expect(partial.remaining).toBe(eve.remaining);
  });

  test('an as-of date is required', () => {
    expect(failure(loan)).toMatch(/as-of date/);
    expect(dailyStatement(loan, [], 'not-a-date')).toEqual({
      error: 'A valid as-of date is required for a daily-interest statement.',
    });
  });
});
