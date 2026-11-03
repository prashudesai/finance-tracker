import type { Expense, Loan } from '../schema/records';
import { addDays, addMonths, roundMoney } from './calendar';
import { isLoanFailure, quotePayment, rebuildLoan, type LoanPayment } from './loan';
import { loanPayments } from './recurring';

const MAX_PAST_EMIS = 600;

/** The first EMI date: the one entered, or a month after the start on the EMI day. */
export const firstEmiDue = (loan: Pick<Loan, 'date' | 'firstEmiDate' | 'emiDueDay'>) =>
  loan.firstEmiDate ?? addMonths(loan.date, 1, loan.emiDueDay);

export interface PaidBeforeTracking {
  /** EMIs counted, from the first EMI date up to today or the first recorded payment. */
  count: number;
  /** The first and last EMI counted, when there are any. */
  from?: string;
  to?: string;
  /** What those EMIs added up to: principal plus interest. */
  total: number;
  principal: number;
  interest: number;
}

/**
 * What the loan's own EMIs repaid before anything was recorded here, as if each was
 * paid on time. It counts up to `today`, or the day before the loan's first recorded
 * payment, so nothing is counted twice. Daily-interest loans aren't estimated, because
 * their ledger charges interest on the opening balance from the start date.
 */
export function paidBeforeTracking(
  loan: Loan,
  expenses: Expense[],
  today: string,
): PaidBeforeTracking | { error: string } | null {
  if (loan.dailyInterestBasis) return null;
  const opening: Loan = {
    ...loan,
    principalPaidBeforeTracking: undefined,
    interestPaidBeforeTracking: undefined,
  };
  const firstEmiDate = firstEmiDue(loan);
  const anchor = loan.emiDueDay ?? Number(firstEmiDate.slice(-2));
  const recorded = loanPayments(expenses, loan.id)
    .map((row) => row.date)
    .sort()[0];
  const until = recorded && recorded <= today ? addDays(recorded, -1) : today;
  const rows: LoanPayment[] = [];

  for (let index = 0; index < MAX_PAST_EMIS; index++) {
    const date = addMonths(firstEmiDate, index, anchor);
    if (date > until) break;
    const quote = quotePayment({ ...opening, firstEmiDate }, rows, date);
    if (isLoanFailure(quote)) return quote;
    if (quote.paidOff || !(quote.amount > 0)) break;
    rows.push({ id: `past_${index}`, date, amount: quote.amount, repaymentType: 'emi' });
  }
  const ledger = rebuildLoan({ ...opening, firstEmiDate }, rows, { asOf: until });
  if (isLoanFailure(ledger)) return ledger;
  const sum = (key: 'principalPaid' | 'interestPaid') =>
    roundMoney(ledger.payments.reduce((total, row) => total + row[key], 0));
  const [first, last] = [rows[0], rows.at(-1)];
  return {
    count: rows.length,
    ...(first && last ? { from: first.date, to: last.date } : {}),
    total: roundMoney(rows.reduce((total, row) => total + row.amount, 0)),
    principal: sum('principalPaid'),
    interest: sum('interestPaid'),
  };
}
