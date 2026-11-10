import type { ReactNode } from 'react';
import type { Payout } from '../../schema/records';
import { useTracker } from '../../store/tracker';
import ui from '../../ui/ui.module.css';
import { usePayouts } from './payouts';

/** Received or skipped, right where a due payout is listed. */
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
  if (!canEdit) return fallback;
  return (
    <span className={ui.emiActions}>
      <button
        aria-label={`Received: ${label}`}
        className={ui.textLink}
        onClick={() => receive(payout)}
        type="button"
      >
        Received
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
