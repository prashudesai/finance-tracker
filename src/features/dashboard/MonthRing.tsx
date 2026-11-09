import { Link } from 'react-router';
import type { FigureChange } from '../../domain/analytics';
import { formatAmount, formatMoney, formatMonth } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './Home.module.css';

const R = 38;
const C = 2 * Math.PI * R;

/**
 * This month so far: what's left in the middle of a ring, with spending, loan EMIs and investing
 * around it, and the figures beside it. Spending shows its change against last month.
 */
export function MonthRing({
  month,
  income,
  spent,
  repaid,
  invested,
  spentChange,
}: {
  month: string;
  income: number;
  spent: number;
  repaid: number;
  invested: number;
  spentChange: FigureChange | null;
}) {
  const left = income - spent - repaid - invested;
  const whole = Math.max(income, spent + repaid + invested, 1);
  const parts = [
    { key: 'spent', amount: spent, color: 'var(--series-expense)' },
    { key: 'emis', amount: repaid, color: 'var(--loss)' },
    { key: 'invested', amount: invested, color: 'var(--scenario-base)' },
  ];
  let offset = 0;
  const arcs = parts.map((part) => {
    const length = (part.amount / whole) * C;
    const arc = { ...part, length, offset };
    offset += length;
    return arc;
  });
  const percent = spentChange ? Math.round(Math.abs(spentChange.change) * 100) : 0;
  const rows = [
    { label: 'Income', value: income, color: 'var(--series-income)' },
    { label: 'Spent', value: spent, color: 'var(--series-expense)', change: true },
    { label: 'Loan EMIs', value: repaid, color: 'var(--loss)' },
    { label: 'Invested', value: invested, color: 'var(--scenario-base)' },
  ];

  return (
    <section aria-labelledby="month-so-far" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id="month-so-far">{formatMonth(month).split(' ')[0]} so far</h2>
        <Link className={ui.textLink} to="/cash-flow">
          Cash flow ›
        </Link>
      </div>
      <Link className={`${ui.card} ${styles.ring}`} to="/cash-flow">
        <svg aria-hidden="true" className={styles.ringChart} viewBox="0 0 96 96">
          <circle className={styles.ringTrack} cx="48" cy="48" r={R} />
          {arcs.map((arc) =>
            arc.length > 0 ? (
              <circle
                cx="48"
                cy="48"
                key={arc.key}
                r={R}
                style={{
                  stroke: arc.color,
                  strokeDasharray: `${Math.max(arc.length - 2, 0.1)} ${C}`,
                  strokeDashoffset: -arc.offset,
                }}
                className={styles.ringArc}
              />
            ) : null,
          )}
          <text className={styles.ringLabel} x="48" y="44">
            {left < 0 ? 'short' : 'left'}
          </text>
          <text className={styles.ringValue} x="48" y="61">
            {formatAmount(Math.abs(left))}
          </text>
        </svg>
        <dl className={styles.ringRows}>
          {rows.map((row) => (
            <div key={row.label}>
              <dt>
                <i style={{ background: row.color }} />
                {row.label}
              </dt>
              <dd>
                {row.value > 0 ? (
                  formatMoney(row.value)
                ) : (
                  <span className={styles.notYet}>Not yet</span>
                )}
                {row.change && spentChange && percent > 0 ? (
                  <small data-better={spentChange.better || undefined}>
                    {spentChange.change > 0 ? '▲' : '▼'}
                    {percent}%
                  </small>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </Link>
    </section>
  );
}
