import { describe, expect, it } from 'vitest';
import { EMI_CATEGORY, type Expense, type Loan } from '../schema/records';
import { isLoanFailure, rebuildLoan } from './loan';
import { firstEmiDue, paidBeforeTracking } from './paidBeforeTracking';
import { remainingEmis } from './summary';

const loan: Loan = {
  id: 'home',
  type: 'Home Loan',
  member: '',
  date: '2021-01-10',
  principal: 1_200_000,
  openingRate: 12,
  openingEmi: 13_213,
  emiDueDay: 5,
  changes: [],
};
const today = '2026-11-03';

const estimate = (value: Loan, expenses: Expense[] = []) => {
  const result = paidBeforeTracking(value, expenses, today);
  if (!result || 'error' in result) throw new Error('No estimate');
  return result;
};

const withEstimate = (value: Loan, expenses: Expense[] = []): Loan => {
  const { principal, interest } = estimate(value, expenses);
  return { ...value, principalPaidBeforeTracking: principal, interestPaidBeforeTracking: interest };
};

const emi = (id: string, date: string, amount = 13_213): Expense => ({
  id,
  date,
  category: EMI_CATEGORY,
  subcategory: '',
  isAnnual: false,
  amount,
  loanId: 'home',
  repaymentType: 'emi',
});

describe('paidBeforeTracking', () => {
  it('starts a month after the start date, on the EMI day', () => {
    expect(firstEmiDue(loan)).toBe('2021-02-05');
    expect(firstEmiDue({ ...loan, emiDueDay: undefined })).toBe('2021-02-10');
    expect(firstEmiDue({ ...loan, firstEmiDate: '2021-03-05' })).toBe('2021-03-05');
  });

  it('counts every EMI due up to today as standard amortisation', () => {
    const result = estimate(loan);
    // February 2021 to October 2026. The 5 November EMI isn't due yet.
    expect(result).toMatchObject({ count: 69, from: '2021-02-05', to: '2026-10-05' });
    expect(result.total).toBe(69 * 13_213);
    const growth = 1.01 ** 69;
    const balance = 1_200_000 * growth - (13_213 * (growth - 1)) / 0.01;
    expect(Math.abs(1_200_000 - result.principal - balance)).toBeLessThan(5);
    expect(result.principal + result.interest).toBeCloseTo(69 * 13_213, 2);
  });

  it('leaves the next EMI as it would be had every past EMI been recorded', () => {
    const reduced = withEstimate(loan);
    const ledger = rebuildLoan(reduced, [emi('next', '2026-11-05')], { asOf: '2026-11-05' });
    if (isLoanFailure(ledger)) throw new Error(ledger.error);
    // 1% a month on the reduced balance of 10,80,293.
    expect(ledger.payments[0]).toMatchObject({ interestPaid: 10_803, principalPaid: 2_410 });
    expect(remainingEmis(ledger)).toBe(171);
  });

  it('moves with the start date', () => {
    expect(estimate({ ...loan, date: '2024-01-10' }).count).toBe(33);
    expect(estimate({ ...loan, date: '2026-10-20' })).toEqual({
      count: 0,
      total: 0,
      principal: 0,
      interest: 0,
    });
  });

  it('ignores figures already entered, so editing a loan gives the same answer', () => {
    expect(estimate(withEstimate(loan))).toEqual(estimate(loan));
  });

  it('stops before the first payment recorded here', () => {
    expect(estimate(loan, [emi('june', '2021-06-05')]).count).toBe(4);
  });

  it('stops once the loan is paid off', () => {
    const small = { ...loan, principal: 30_000, openingEmi: 10_000 };
    const result = estimate(small);
    expect(result).toMatchObject({ count: 4, principal: 30_000 });
    expect(result.total).toBe(result.principal + result.interest);
    expect(result.total).toBeLessThan(40_000);
  });

  it('leaves daily-interest loans alone', () => {
    expect(paidBeforeTracking({ ...loan, dailyInterestBasis: true }, [], today)).toBeNull();
  });
});
