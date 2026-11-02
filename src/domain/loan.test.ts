import { createRequire } from 'node:module';
import type { Loan } from '../schema/records';
import {
  dailyStatement,
  isLoanFailure,
  paymentBalances,
  quotePayment,
  rebuildLoan,
  type LoanLedger,
  type LoanPayment,
} from './loan';

const baseLoan = (overrides: Partial<Loan> = {}): Loan => ({
  id: 'loan',
  type: 'Home Loan',
  member: 'Test',
  date: '2026-01-01',
  principal: 1_000_000,
  openingRate: 7.5,
  openingEmi: 20_000,
  changes: [],
  ...overrides,
});

const pay = (id: string, date: string, extra: Partial<LoanPayment> = {}): LoanPayment => ({
  id,
  date,
  amount: 20_000,
  repaymentType: 'emi',
  ...extra,
});

const sixPayments = Array.from({ length: 6 }, (_, index) =>
  pay(`p${index}`, `2026-${String(index + 2).padStart(2, '0')}-01`),
);

function ledger(loan: Loan, payments: LoanPayment[], asOf?: string): LoanLedger {
  const result = rebuildLoan(loan, payments, asOf === undefined ? {} : { asOf });
  if (isLoanFailure(result)) throw new Error(result.error);
  return result;
}

const failure = (loan: Loan, payments: LoanPayment[] = []) => {
  const result = rebuildLoan(loan, payments);
  return isLoanFailure(result) ? result.error : undefined;
};

describe('monthly loan ledger', () => {
  test('earlier EMIs keep the old rate and the next repayment uses the new one', () => {
    const old = ledger(baseLoan(), sixPayments);
    const changed = baseLoan({ changes: [{ id: 'r', type: 'rate', date: '2026-08-01', rate: 8 }] });
    const result = ledger(changed, [...sixPayments, pay('next', '2026-08-01')]);
    expect(result.payments.slice(0, 6)).toEqual(old.payments);
    expect(result.payments[6]?.interestPaid).toBe(Math.round((old.remaining * 8) / 1200));
  });

  test('unsorted changes replay by date, ending on the latest terms', () => {
    const loan = baseLoan({
      changes: [
        { id: 'b', type: 'rate', date: '2026-04-01', rate: 6, emi: 22_000 },
        { id: 'a', type: 'rate', date: '2026-03-01', rate: 8 },
      ],
    });
    const result = ledger(loan, sixPayments);
    expect(result.rate).toBe(6);
    expect(result.emi).toBe(22_000);
    expect(result.payments[0]?.interestPaid).toBe(6250);
  });

  test('a mid-cycle top-up weights interest by principal days', () => {
    const loan = baseLoan({
      changes: [{ id: 't', type: 'topup', date: '2026-01-16', amount: 100_000 }],
    });
    const result = ledger(loan, [pay('a', '2026-02-01')]);
    expect(result.payments[0]?.interestPaid).toBe(
      Math.round(((1_000_000 + (100_000 * 16) / 31) * 7.5) / 1200),
    );
    expect(result.totalPrincipal).toBe(1_100_000);
  });

  test('a statement interest override survives rate and top-up changes', () => {
    const loan = baseLoan({
      changes: [{ id: 't', type: 'topup', date: '2026-01-16', amount: 100_000, rate: 8 }],
    });
    const result = ledger(loan, [
      pay('p', '2026-02-01', { interestOverride: true, interestPaid: 5000 }),
    ]);
    expect(result.payments[0]?.interestPaid).toBe(5000);
  });

  test('a same-day change applies before the payment', () => {
    const loan = baseLoan({
      changes: [{ id: 't', type: 'topup', date: '2026-02-01', amount: 100_000, rate: 8 }],
    });
    expect(ledger(loan, [pay('p', '2026-02-01')]).remaining).toBe(1_100_000 - 20_000 + 6667);
  });

  test('a part payment can keep or reduce the EMI', () => {
    for (const action of ['keep', 'reduce'] as const) {
      const loan = baseLoan({ changes: [{ id: 'r', type: 'rate', date: '2026-03-01', rate: 8 }] });
      const result = ledger(loan, [
        pay('p', '2026-02-01'),
        pay('part', '2026-03-16', {
          amount: 100_000,
          repaymentType: 'part-payment',
          partPaymentAction: action,
        }),
        pay('q', '2026-04-01'),
      ]);
      expect(result.payments[1]?.interestPaid).toBe(0);
      if (action === 'keep') expect(result.emi).toBe(20_000);
      else expect(result.emi).toBeLessThan(20_000);
    }
  });

  test('balances before tracking are preserved', () => {
    const loan = baseLoan({
      principalPaidBeforeTracking: 200_000,
      interestPaidBeforeTracking: 60_000,
      changes: [{ id: 't', type: 'topup', date: '2026-03-01', amount: 100_000 }],
    });
    const result = ledger(loan, []);
    expect(result.remaining).toBe(900_000);
    expect(result.interestPaid).toBe(60_000);
  });

  test('payment balances follow part payments and top-ups', () => {
    const loan = baseLoan({
      changes: [{ id: 'top', type: 'topup', date: '2026-02-10', amount: 100_000 }],
    });
    const rows = [
      pay('p1', '2026-02-01'),
      pay('part', '2026-02-15', { amount: 50_000, repaymentType: 'part-payment' }),
      pay('p2', '2026-03-01'),
    ];
    const result = paymentBalances(loan, rows);
    if (isLoanFailure(result)) throw new Error(result.error);
    expect(result.balances.get('part')).toBe((result.balances.get('p1') ?? 0) + 50_000);
    expect(result.balances.get('p2')).toBe(result.remaining);
  });

  test.each([
    [
      'conflicting same-date terms',
      [
        { id: 'x', type: 'rate' as const, date: '2026-02-01', rate: 8 },
        { id: 'y', type: 'topup' as const, date: '2026-02-01', amount: 1, emi: 1 },
      ],
    ],
    [
      'duplicate IDs',
      [
        { id: 'x', type: 'topup' as const, date: '2026-02-01', amount: 1 },
        { id: 'x', type: 'topup' as const, date: '2026-03-01', amount: 1 },
      ],
    ],
    ['an impossible date', [{ id: 'x', type: 'rate' as const, date: '2026-02-30', rate: 8 }]],
    ['a negative top-up', [{ id: 'x', type: 'topup' as const, date: '2026-02-01', amount: -1 }]],
  ])('rejects %s', (_, changes) => {
    expect(failure(baseLoan({ changes }))).toBeDefined();
  });

  test('an overpayment is rejected without changing its inputs', () => {
    const loan = baseLoan();
    const rows = [pay('x', '2026-02-01', { amount: 2_000_000 })];
    const before = JSON.stringify([loan, rows]);
    expect(failure(loan, rows)).toBeDefined();
    expect(JSON.stringify([loan, rows])).toBe(before);
  });
});

describe('revised repayment terms', () => {
  test.each([
    ['a rate rise raises', 8, 'toBeGreaterThan'],
    ['a rate fall lowers', 5, 'toBeLessThan'],
  ] as const)('%s the EMI while keeping the remaining term', (_, rate, matcher) => {
    const loan = baseLoan({
      changes: [{ id: 'r', type: 'rate', date: '2026-08-01', rate, repaymentChoice: 'tenure' }],
    });
    const entry = ledger(loan, sixPayments).history[0];
    expect(entry?.emi)[matcher](entry?.beforeEmi ?? 0);
    expect(entry?.newTerm).toBeLessThanOrEqual(entry?.oldTerm ?? 0);
  });

  test.each([
    ['a rate rise', { type: 'rate', rate: 9 }, 'toBeGreaterThan'],
    ['a top-up', { type: 'topup', amount: 200_000 }, 'toBeGreaterThan'],
    ['a rate fall', { type: 'rate', rate: 3 }, 'toBeLessThan'],
  ] as const)('keeping the EMI through %s changes the term', (_, change, matcher) => {
    const loan = baseLoan({
      changes: [{ id: 'x', date: '2026-08-01', repaymentChoice: 'emi', ...change }],
    });
    const entry = ledger(loan, sixPayments).history[0];
    expect(entry?.emi).toBe(20_000);
    expect(entry?.newTerm)[matcher](entry?.oldTerm ?? 0);
  });

  test('a kept EMI that no longer covers interest is rejected', () => {
    const loan = baseLoan({
      changes: [{ id: 'r', type: 'rate', date: '2026-08-01', rate: 100, repaymentChoice: 'emi' }],
    });
    expect(failure(loan, sixPayments)).toMatch(/does not cover/);
  });

  test('an unknown tenure points to a bank-confirmed EMI', () => {
    const change = { id: 't', type: 'topup' as const, date: '2026-08-01', amount: 100_000 };
    const unknown = baseLoan({
      openingEmi: 0,
      changes: [{ ...change, repaymentChoice: 'tenure' }],
    });
    expect(failure(unknown)).toMatch(/cannot be estimated/);
    const manual = baseLoan({
      openingEmi: 0,
      changes: [{ ...change, repaymentChoice: 'manual', emi: 25_000 }],
    });
    expect(failure(manual)).toBeUndefined();
  });
});

describe('quotes and daily loans', () => {
  test('a quote reports paid-off loans', () => {
    const loan = baseLoan({ principal: 1000, openingRate: 0, openingEmi: 1000 });
    expect(quotePayment(loan, [pay('p', '2026-02-01', { amount: 1000 })], '2026-03-01')).toEqual({
      paidOff: true,
      amount: 0,
    });
  });

  test('daily loans need an as-of date', () => {
    expect(failure(baseLoan({ dailyInterestBasis: true }))).toMatch(/as-of date/);
  });

  test('daily interest is added to the balance at month end', () => {
    const loan = baseLoan({ dailyInterestBasis: true, openingRate: 36.5, principal: 1000 });
    const result = ledger(loan, [], '2026-01-31');
    expect(result.interestCapitalizations).toEqual([{ date: '2026-01-31', amount: 31 }]);
    expect(result.remaining).toBe(1031);
  });
});

/** The legacy ledger is the reference until it is deleted at cutover. */
describe('parity with the legacy ledger', () => {
  const legacy = createRequire(import.meta.url)('./reference/loan-ledger.cjs');

  function random(seed: number) {
    let value = seed;
    return () => {
      value = (value + 0x6d2b79f5) | 0;
      let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
      mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  function scenario(seed: number) {
    const next = random(seed);
    const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)] as T;
    const principal = 100_000 + Math.floor(next() * 2_000_000);
    const rate = pick([0, 6.5, 7.5, 8.25, 9.9, 12]);
    const emi = Math.ceil((principal * (rate / 1200 + 0.01)) / 100) * 100;
    const loan = baseLoan({
      principal,
      openingRate: rate,
      openingEmi: emi,
      dailyInterestBasis: next() < 0.25,
      principalPaidBeforeTracking: next() < 0.3 ? 5000 : 0,
      interestPaidBeforeTracking: next() < 0.3 ? 2500 : 0,
    });
    if (next() < 0.3) {
      loan.firstEmiDate = pick(['2026-01-20', '2026-02-01']);
      loan.firstEmiExtraInterest = pick([0, 1200]);
      loan.firstEmiInterestMethod = pick(['monthly', 'short-actual365'] as const);
    }
    const payments: LoanPayment[] = [];
    for (let month = 2; month <= 25; month++) {
      const year = 2026 + Math.floor((month - 1) / 12);
      const label = String(((month - 1) % 12) + 1).padStart(2, '0');
      if (next() < 0.25) {
        loan.changes.push({
          id: `c${month}`,
          type: 'rate',
          date: `${year}-${label}-05`,
          rate: pick([5, 7, 8, 9.5]),
          ...(loan.dailyInterestBasis ? {} : { repaymentChoice: pick(['tenure', 'emi'] as const) }),
        });
      } else if (next() < 0.2) {
        loan.changes.push({
          id: `c${month}`,
          type: 'topup',
          date: `${year}-${label}-11`,
          amount: 50_000,
        });
      } else if (next() < 0.15) {
        payments.push(
          pay(`part${month}`, `${year}-${label}-15`, {
            amount: 25_000,
            repaymentType: 'part-payment',
            partPaymentAction: pick(['keep', 'reduce'] as const),
          }),
        );
      }
      payments.push(pay(`p${month}`, `${year}-${label}-01`, { amount: emi }));
    }
    return { loan, payments };
  }

  const toLegacy = ({ changes, ...loan }: Loan) => ({
    ...loan,
    rate: loan.openingRate,
    emi: loan.openingEmi,
    loanChanges: changes,
  });

  test('matches across 3,000 seeded scenarios', () => {
    const asOf = '2028-03-15';
    let succeeded = 0;
    for (let seed = 1; seed <= 3000; seed++) {
      const { loan, payments } = scenario(seed);
      const reference = legacy.rebuild(toLegacy(loan), payments, undefined, asOf);
      const result = rebuildLoan(loan, payments, { asOf });
      if (reference.error) {
        expect(result, `seed ${seed}`).toEqual({ error: reference.error });
        continue;
      }
      succeeded++;
      if (isLoanFailure(result)) throw new Error(`seed ${seed}: ${result.error}`);
      for (const key of [
        'remaining',
        'interestPaid',
        'rate',
        'emi',
        'payments',
        'totalPrincipal',
      ] as const) {
        expect(result[key], `seed ${seed} ${key}`).toEqual(reference[key]);
      }
      if (loan.dailyInterestBasis) {
        expect(result.interestCapitalizations).toEqual(reference.interestCapitalizations);
        expect(result.accruedInterest).toBe(reference.accruedInterest);
        const statement = dailyStatement(loan, payments, asOf);
        expect(statement).toEqual(legacy.dailyStatement(toLegacy(loan), payments, asOf));
      }
      expect(quotePayment(loan, payments, '2027-06-20'), `seed ${seed} quote`).toEqual(
        legacy.quotePayment(toLegacy(loan), payments, '2027-06-20'),
      );
    }
    expect(succeeded).toBeGreaterThan(300);
  }, 30_000);
});
