import { useState, type ReactNode } from 'react';
import { isLoanFailure, quotePayment } from '../../domain/loan';
import { loanPayments } from '../../domain/recurring';
import { EMI_CATEGORY, type Expense } from '../../schema/records';
import { useTracker } from '../../store/tracker';
import { localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';

const HIDDEN_KEY = 'emiRemindersHidden';

/** EMI reminders hidden on this device, as `loanId:YYYY-MM`, each for one month only. */
export function useHiddenEmis() {
  const [hidden, setHidden] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[];
    } catch {
      return [];
    }
  });
  const hide = (loanId: string, date: string) => {
    // Only this month and later are kept, so the list never grows.
    const month = localDate().slice(0, 7);
    const next = [
      ...hidden.filter((key) => (key.split(':')[1] ?? '') >= month),
      `${loanId}:${date.slice(0, 7)}`,
    ];
    setHidden(next);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    } catch {
      // Shown again next visit.
    }
  };
  const isHidden = (loanId: string, date: string) =>
    hidden.includes(`${loanId}:${date.slice(0, 7)}`);
  return { hide, isHidden };
}

/**
 * Mark an EMI as paid in one tap, at the loan's own EMI amount, on its due date or today if
 * that's earlier. A reminder that isn't overdue can also be hidden for the month instead.
 */
export function EmiActions({
  loanId,
  date,
  missed,
  label,
  onHide,
  fallback,
}: {
  loanId: string;
  date: string;
  missed: boolean;
  label: string;
  onHide: () => void;
  /** Shown instead to those who can only view, or if the loan is gone. */
  fallback: ReactNode;
}) {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const canEdit = useTracker((state) => state.canEdit);
  const [error, setError] = useState('');
  const loan = data.loans.find((row) => row.id === loanId);
  if (!loan || !canEdit) return fallback;

  const markPaid = () => {
    const today = localDate();
    const paidOn = date < today ? date : today;
    const quote = quotePayment(loan, loanPayments(data.expenses, loan.id), paidOn);
    if (isLoanFailure(quote)) {
      setError(quote.error);
      return;
    }
    if (quote.paidOff) {
      setError('This loan is already paid off.');
      return;
    }
    const id = crypto.randomUUID();
    const row: Expense = {
      id,
      date: paidOn,
      category: EMI_CATEGORY,
      subcategory: '',
      isAnnual: false,
      loanId: loan.id,
      amount: quote.amount,
      repaymentType: 'emi',
    };
    commit([{ type: 'set', collection: 'expenses', id, value: row }]);
  };

  return (
    <span className={ui.emiActions}>
      <button
        aria-label={`Mark as paid: ${label}`}
        className={ui.textLink}
        onClick={markPaid}
        type="button"
      >
        Mark as paid
      </button>
      {missed ? null : (
        <button
          aria-label={`Hide this month: ${label}`}
          className={ui.quietLink}
          onClick={onHide}
          type="button"
        >
          Hide this month
        </button>
      )}
      {error ? (
        <span className={ui.fieldError} role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
