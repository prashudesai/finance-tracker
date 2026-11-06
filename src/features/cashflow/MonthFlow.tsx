import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { nextMonth, previousMonth } from '../../domain/calendar';
import { formatMoney, formatMonth, formatShortMonth } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './MonthFlow.module.css';

interface Part {
  label: string;
  amount: number;
  color: string;
}

/** How far a finger must travel sideways before it counts as a swipe. */
const SWIPE = 50;

/**
 * The month as a flow: income at the top, what went out under it, and the balance left,
 * each with its share of income, and one bar showing how the income was split. Swipe it, or
 * use the arrows, to move between months; the whole page follows.
 */
export function MonthFlow({
  income,
  spent,
  unrecorded,
  invested,
  explainer,
  month,
  current,
  earliest,
  onMonth,
}: {
  /** The month shown, the running month, and the oldest that can be chosen. */
  month: string;
  current: string;
  earliest: string;
  onMonth: (month: string) => void;
  income: number;
  /** Recorded spending, EMIs included. */
  spent: number;
  unrecorded: number;
  invested: number;
  explainer: ReactNode;
}) {
  const balance = income - spent - unrecorded - invested;
  const outgoing: Part[] = [
    { label: 'Spent', amount: spent, color: 'var(--series-expense)' },
    ...(unrecorded > 0
      ? [{ label: 'Unrecorded spending', amount: unrecorded, color: 'var(--debt)' }]
      : []),
    { label: 'Invested from income', amount: invested, color: 'var(--scenario-base)' },
  ];
  const parts: Part[] = [
    ...outgoing,
    ...(balance > 0 ? [{ label: 'Balance', amount: balance, color: 'var(--series-income)' }] : []),
  ];
  const share = (amount: number) => (income > 0 ? amount / income : 0);
  const percent = (amount: number) => `${Math.round(share(amount) * 100)}%`;
  const total = Math.max(income, spent + unrecorded + invested, 1);
  const before = month > earliest ? previousMonth(month) : null;
  const after = month < current ? nextMonth(month) : null;
  const start = useRef<{ x: number; y: number } | null>(null);

  return (
    <section
      aria-label="Selected month"
      className={`${ui.hero} ${styles.flow}`}
      onTouchEnd={(event) => {
        const touch = event.changedTouches[0];
        const from = start.current;
        start.current = null;
        if (!touch || !from) return;
        const dx = touch.clientX - from.x;
        // Sideways and far enough, so scrolling the page isn't taken for a swipe.
        if (Math.abs(dx) < SWIPE || Math.abs(dx) < Math.abs(touch.clientY - from.y) * 1.5) return;
        if (dx < 0 && after) onMonth(after);
        if (dx > 0 && before) onMonth(before);
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        start.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
      }}
    >
      <div className={styles.months}>
        <button
          aria-label={before ? `Previous month, ${formatMonth(before)}` : 'No earlier month'}
          className={styles.step}
          disabled={!before}
          onClick={() => before && onMonth(before)}
          type="button"
        >
          <ChevronLeft aria-hidden="true" size={16} />
          {before ? formatShortMonth(before) : ''}
        </button>
        {/* Tapping the month opens the phone's own month picker, to jump straight to one. */}
        <label className={styles.pick}>
          <strong aria-live="polite">{formatMonth(month)}</strong>
          <ChevronDown aria-hidden="true" size={16} />
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
        <button
          aria-label={after ? `Next month, ${formatMonth(after)}` : 'No later month'}
          className={styles.step}
          disabled={!after}
          onClick={() => after && onMonth(after)}
          type="button"
        >
          {after ? formatShortMonth(after) : ''}
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </div>
      <div className={styles.head}>
        <span className={styles.label}>Balance</span>
        <strong className={styles.balance} data-negative={balance < 0 || undefined}>
          {formatMoney(balance)}
        </strong>
        <span className={styles.sub}>
          {income > 0
            ? balance >= 0
              ? `${percent(balance)} of ${formatMoney(income)} income left after spending and investing`
              : `${formatMoney(-balance)} more went out than came in`
            : 'No income recorded for this month yet'}
        </span>
      </div>

      {income > 0 || spent > 0 ? (
        <div aria-hidden="true" className={styles.bar}>
          {parts.map((part) =>
            part.amount > 0 ? (
              <span
                key={part.label}
                style={{ background: part.color, flexGrow: part.amount / total }}
              />
            ) : null,
          )}
        </div>
      ) : null}

      <ol className={styles.rows}>
        <li className={styles.income}>
          <span className={styles.sign}>+</span>
          <span className={styles.name}>Income recorded</span>
          <span className={styles.amount}>{formatMoney(income)}</span>
        </li>
        {outgoing.map((part) => (
          <li key={part.label}>
            <span className={styles.sign} style={{ background: part.color }}>
              −
            </span>
            <span className={styles.name}>
              {part.label}
              {income > 0 ? <small>{percent(part.amount)}</small> : null}
            </span>
            <span className={styles.amount}>{formatMoney(part.amount)}</span>
          </li>
        ))}
        <li className={styles.total}>
          <span className={styles.sign} style={{ background: 'var(--series-income)' }}>
            =
          </span>
          <span className={styles.name}>Balance</span>
          <span className={styles.amount}>{formatMoney(balance)}</span>
        </li>
      </ol>
      {explainer}
    </section>
  );
}
