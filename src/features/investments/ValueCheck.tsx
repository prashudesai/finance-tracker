import { useState } from 'react';
import type { PositionRow } from '../../domain/analytics';
import { useTracker } from '../../store/tracker';
import { formatDay, formatMoney } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './CategoryDetail.module.css';

const checkedText = (days: number | null, date: string | undefined) => {
  if (days === null || date === undefined) return 'Not checked yet';
  if (days < 0) return `Dated ${formatDay(date)}, after today`;
  if (days === 0) return 'Checked today';
  if (days === 1) return 'Checked yesterday';
  return `Checked ${days} days ago · ${formatDay(date)}`;
};

/**
 * One holding in Record freshness. Confirm records today's value as it stands; Change takes the
 * value from a statement instead. Either way the holding counts as checked today.
 */
export function ValueCheck({
  row,
  label,
  days,
  date,
  due,
  today,
}: {
  row: PositionRow;
  label: string;
  days: number | null;
  date: string | undefined;
  /** Not checked lately, so Confirm is offered as well as Change. */
  due: boolean;
  today: string;
}) {
  const commit = useTracker((state) => state.commit);
  const canEdit = useTracker((state) => state.canEdit);
  const [changing, setChanging] = useState(false);
  const [amount, setAmount] = useState('');
  const value = Number(amount);
  const valid = amount !== '' && Number.isFinite(value) && value >= 0;

  const record = (next: number) => {
    const id = crypto.randomUUID();
    commit([
      {
        type: 'set',
        collection: 'valuations',
        id,
        value: { id, holdingId: row.holding.id, date: today, value: next },
      },
    ]);
    setChanging(false);
  };

  return (
    <li className={ui.row}>
      <div className={ui.rowMain}>
        <div className={ui.rowTitle}>{label}</div>
        <div className={ui.rowDetail}>{checkedText(days, date)}</div>
      </div>
      <span className={ui.amount}>{formatMoney(row.position.current)}</span>
      {!canEdit ? null : changing ? (
        <form
          className={`${ui.emiActions} ${styles.payoutEntry}`}
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) record(value);
          }}
        >
          <input
            aria-label={`Value today: ${label}`}
            autoFocus
            inputMode="decimal"
            min="0"
            onChange={(event) => setAmount(event.target.value)}
            placeholder={String(Math.round(row.position.current))}
            step="0.01"
            type="number"
            value={amount}
          />
          <button className={ui.textLink} disabled={!valid} type="submit">
            Save
          </button>
          <button className={ui.quietLink} onClick={() => setChanging(false)} type="button">
            Cancel
          </button>
        </form>
      ) : (
        <span className={ui.emiActions}>
          {due ? (
            <button
              aria-label={`Confirm value of ${label}`}
              className={ui.textLink}
              onClick={() => record(row.position.current)}
              type="button"
            >
              Confirm
            </button>
          ) : null}
          <button
            aria-label={`Change value of ${label}`}
            className={due ? ui.quietLink : ui.textLink}
            onClick={() => {
              setAmount('');
              setChanging(true);
            }}
            type="button"
          >
            Change
          </button>
        </span>
      )}
    </li>
  );
}
