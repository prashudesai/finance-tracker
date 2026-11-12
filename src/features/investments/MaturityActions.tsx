import { useState, type ReactNode } from 'react';
import { useTracker } from '../../store/tracker';
import { formatMoney, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './CategoryDetail.module.css';

/**
 * Principal received, right where a maturing holding is listed: it's taken out in full as a
 * withdrawal on the maturity date (or today, if it came back early), which closes the holding
 * and books any profit. The amount can be changed first, when what came back differs.
 */
export function MaturityActions({
  maturity,
  label,
  fallback,
}: {
  maturity: { holdingId: string; date: string; value: number };
  label: string;
  /** Shown instead to those who can only view. */
  fallback: ReactNode;
}) {
  const canEdit = useTracker((state) => state.canEdit);
  const commit = useTracker((state) => state.commit);
  const [entering, setEntering] = useState(false);
  const [amount, setAmount] = useState(String(Math.round(maturity.value)));
  if (!canEdit) return fallback;
  const today = localDate();
  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value > 0;
  const date = maturity.date <= today ? maturity.date : today;

  const receive = (received: number) => {
    const id = crypto.randomUUID();
    const valuationId = crypto.randomUUID();
    commit([
      // Nothing is left in it afterwards, so the holding shows as closed.
      {
        type: 'set',
        collection: 'valuations',
        id: valuationId,
        value: { id: valuationId, holdingId: maturity.holdingId, date, value: 0 },
      },
      {
        type: 'set',
        collection: 'withdrawals',
        id,
        value: { id, holdingId: maturity.holdingId, date, amount: received, valuationId },
      },
    ]);
  };

  if (entering) {
    return (
      <form
        className={`${ui.emiActions} ${styles.payoutEntry}`}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) receive(value);
        }}
      >
        <input
          aria-label={`Amount received: ${label}`}
          autoFocus
          inputMode="decimal"
          min="0"
          onChange={(event) => setAmount(event.target.value)}
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
        aria-label={`Principal received, ${formatMoney(maturity.value)}: ${label}`}
        className={ui.textLink}
        onClick={() => receive(maturity.value)}
        type="button"
      >
        Received
      </button>
      <button
        aria-label={`Different amount: ${label}`}
        className={ui.quietLink}
        onClick={() => setEntering(true)}
        type="button"
      >
        Different amount
      </button>
    </span>
  );
}
