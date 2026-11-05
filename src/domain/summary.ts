import type { TrackerData } from '../data/repository';
import { addMonths } from './calendar';
import { estimateSchedule, isLoanFailure, rebuildLoan, type LoanLedger } from './loan';
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

/** Share of everything borrowed that has been repaid, from 0 to 1. */
export function paidShare({ remaining, totalPrincipal }: LoanLedger) {
  if (totalPrincipal <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - remaining / totalPrincipal));
}

export const remainingEmis = ({ remaining, emi, rate }: LoanLedger) =>
  estimateSchedule(remaining, emi, rate).count;

/**
 * The month by which every loan is repaid at today's EMIs, or null when nothing is owed
 * or a loan's EMI never clears it.
 */
export function debtFreeMonth(loans: LoanSummary[], month: string) {
  const owing = loans.flatMap(({ ledger }) => (ledger && ledger.remaining > 0 ? [ledger] : []));
  if (owing.length === 0) return null;
  const counts = owing.map(remainingEmis);
  if (counts.some((count) => count === null)) return null;
  return addMonths(`${month}-01`, Math.max(...(counts as number[]))).slice(0, 7);
}

/** Loan ids by state: still owing, or fully paid. A loan that can't be replayed is neither. */
export function loanStates(data: Pick<TrackerData, 'loans' | 'expenses'>, today: string) {
  const owing = new Set<string>();
  const paid = new Set<string>();
  for (const { id, ledger } of summarizeLoans(data, today)) {
    if (!ledger) continue;
    (ledger.remaining > 0 ? owing : paid).add(id);
  }
  return { owing, paid };
}

/** Loans that were owing before and are paid now: the ones just paid off. */
export const newlyPaidOff = (owingBefore: Set<string>, paidNow: Set<string>) =>
  [...owingBefore].filter((id) => paidNow.has(id));

/** "Good morning, Sam", from the hour and the first word of a display name. */
export function greeting(hour: number, name: string) {
  const part =
    hour < 5
      ? 'Good evening'
      : hour < 12
        ? 'Good morning'
        : hour < 17
          ? 'Good afternoon'
          : 'Good evening';
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first && !first.includes('@') && first !== 'You' ? `${part}, ${first}` : part;
}
