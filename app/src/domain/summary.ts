import type { TrackerData } from '../data/repository';
import { isLoanFailure, rebuildLoan, type LoanLedger } from './loan';
import { loanPayments } from './recurring';

export interface LoanSummary {
  id: string;
  type: string;
  member: string;
  ledger: LoanLedger | null;
  error: string | null;
}

export function summarizeLoans(data: Pick<TrackerData, 'loans' | 'expenses'>, today: string) {
  return data.loans.map((loan): LoanSummary => {
    const { id, type, member } = loan;
    const result = rebuildLoan(loan, loanPayments(data.expenses, id), { asOf: today });
    return isLoanFailure(result)
      ? { id, type, member, ledger: null, error: result.error }
      : { id, type, member, ledger: result, error: null };
  });
}

export const totalOutstanding = (loans: LoanSummary[]) =>
  loans.reduce((sum, loan) => sum + (loan.ledger?.remaining ?? 0), 0);

export const totalMonthlyEmi = (loans: LoanSummary[]) =>
  loans.reduce(
    (sum, loan) => sum + ((loan.ledger?.remaining ?? 0) > 0 ? (loan.ledger?.emi ?? 0) : 0),
    0,
  );
