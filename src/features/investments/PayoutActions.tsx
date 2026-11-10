import { useState, type ReactNode } from 'react';
import type { Payout } from '../../schema/records';
import { useTracker } from '../../store/tracker';
import ui from '../../ui/ui.module.css';
import styles from './CategoryDetail.module.css';
import { usePayouts } from './payouts';

/**
 * Received or skipped, right where a due payout is listed. A payout that varies, such as a
 * profit share, asks for the amount first.
 */
export function PayoutActions({
  payout,
  label,
  fallback,
}: {
  payout: Payout;
  label: string;
  /** Shown instead to those who can only view. */
  fallback: ReactNode;
}) {
  const canEdit = useTracker((state) => state.canEdit);
  const { receive, skip } = usePayouts();
  const [entering, setEntering] = useState(false);
  const [amount, setAmount] = useState('');
  if (!canEdit) return fallback;
  const varies = payout.amount <= 0;
  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value > 0;

  if (entering) {
    return (
      <form
        className={`${ui.emiActions} ${styles.payoutEntry}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) receive(payout, value);
        }}
      >
        <input
          aria-label={`Amount received: ${label}`}
          autoFocus
          inputMode="decimal"
          min="0"
          onChange={(event) => setAmount(event.target.value)}
          placeholder="₹ received"
          step="0.01"
          type="number"
          value={amount}
        />
        <button className={ui.textLink} disabled={!valid} type="submit">
          Save
        </button>
        <button className={ui.quietLink} onClick={() => setEntering(false)} type="button">
          Cancel
        </button>
      </form>
    );
  }

  return (
    <span className={ui.emiActions}>
      <button
        aria-label={`${varies ? 'Enter amount' : 'Received'}: ${label}`}
        className={ui.textLink}
        onClick={() => (varies ? setEntering(true) : receive(payout))}
        type="button"
      >
        {varies ? 'Enter amount' : 'Received'}
      </button>
      <button
        aria-label={`Not received: ${label}`}
        className={ui.quietLink}
        onClick={() => skip(payout)}
        type="button"
      >
        Skip
      </button>
    </span>
  );
}
