import { CalendarDays } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { previousMonth } from '../../domain/calendar';
import { formatMonth, formatShortMonth } from '../../ui/format';
import styles from './CashFlowPage.module.css';

const SHOWN = 12;

/**
 * Months as pills in a row that scrolls sideways, the latest at the right, and a calendar to
 * jump further back.
 */
export function MonthPills({
  month,
  current,
  earliest,
  onMonth,
}: {
  month: string;
  current: string;
  earliest: string;
  onMonth: (month: string) => void;
}) {
  const months: string[] = [];
  for (let key = current; months.length < SHOWN && key >= earliest; key = previousMonth(key)) {
    months.unshift(key);
  }
  if (!months.includes(month)) months.unshift(month);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    row.current
      ?.querySelector('[aria-pressed="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [month]);
  const year = current.slice(0, 4);

  return (
    <div aria-label="Months" className={styles.pills} ref={row} role="group">
      <label className={styles.pillPick}>
        <CalendarDays aria-hidden="true" size={16} />
        <input
          aria-label="Month"
          max={current}
          min={earliest}
          onChange={(event) => {
            const picked = event.target.value;
            if (picked && picked >= earliest && picked <= current) onMonth(picked);
          }}
          type="month"
          value={month}
        />
      </label>
      {months.map((key) => (
        <button
          aria-label={formatMonth(key)}
          aria-pressed={key === month}
          className={styles.pill}
          key={key}
          onClick={() => onMonth(key)}
          type="button"
        >
          {key === month
            ? new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long' })
            : formatShortMonth(key)}
          {key.slice(0, 4) === year ? '' : ` ${key.slice(2, 4)}`}
        </button>
      ))}
    </div>
  );
}
