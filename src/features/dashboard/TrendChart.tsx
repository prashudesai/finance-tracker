import { useState } from 'react';
import type { MonthTrend } from '../../domain/cashflow';
import { formatCompactMoney, formatMoney, formatMonth, formatShortMonth } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './TrendChart.module.css';

/**
 * A month's income, and what went out: spending, then loan EMIs, then what was invested from
 * it, stacked in that order.
 */
export interface TrendRow extends MonthTrend {
  emis?: number;
  invested?: number;
}

/** The width of the axis labels before the first bar. */
const AXIS = 44;

export function TrendChart({ months }: { months: TrendRow[] }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const detail = months.find((row) => row.month === chosen);
  const showInvested = months.some((row) => (row.invested ?? 0) > 0);
  const showEmis = months.some((row) => (row.emis ?? 0) > 0);
  const peak = Math.max(
    ...months.flatMap((row) => [row.income, row.expenses + (row.emis ?? 0) + (row.invested ?? 0)]),
    1,
  );
  const summary = (row: TrendRow) => [
    `Income ${formatMoney(row.income)}`,
    `Expenses ${formatMoney(row.expenses)}`,
    ...(showEmis ? [`EMIs ${formatMoney(row.emis ?? 0)}`] : []),
    ...(showInvested ? [`Invested from income ${formatMoney(row.invested ?? 0)}`] : []),
  ];
  const height = (value: number) => `${(value / peak) * 100}%`;

  return (
    <figure className={styles.figure}>
      <figcaption className={styles.legend}>
        <span>
          <i className={styles.swatchIncome} /> Income
        </span>
        <span>
          <i className={styles.swatchExpense} /> Expenses
        </span>
        {showEmis ? (
          <span>
            <i className={styles.swatchEmi} /> EMIs
          </span>
        ) : null}
        {showInvested ? (
          <span>
            <i className={styles.swatchInvested} /> Invested from income
          </span>
        ) : null}
      </figcaption>
      <div
        aria-hidden="true"
        className={styles.plot}
        // A finger dragged across the bars reads each month in turn.
        onPointerMove={(event) => {
          if (event.pointerType === 'mouse' || event.buttons === 0) return;
          // The bars start after the axis labels' 44px, as in the stylesheet.
          const rect = event.currentTarget.getBoundingClientRect();
          const ratio = (event.clientX - rect.left - AXIS) / Math.max(1, rect.width - AXIS);
          const index = Math.floor(ratio * months.length);
          const row = months[Math.min(months.length - 1, Math.max(0, index))];
          if (row) setChosen(row.month);
        }}
      >
        <span className={styles.gridTop}>{formatCompactMoney(peak)}</span>
        <span className={styles.gridMiddle}>{formatCompactMoney(peak / 2)}</span>
        {months.map((row) => (
          <div
            className={styles.month}
            data-chosen={chosen === row.month || undefined}
            data-dimmed={(chosen !== null && chosen !== row.month) || undefined}
            key={row.month}
            onClick={() => setChosen(row.month)}
          >
            <div className={styles.bars}>
              <span className={styles.barIncome} style={{ height: height(row.income) }} />
              {/* Spending at the base, then EMIs, then what was invested, stacked up. */}
              <span className={styles.stack}>
                {row.invested ? (
                  <span className={styles.barInvested} style={{ height: height(row.invested) }} />
                ) : null}
                {row.emis ? (
                  <span className={styles.barEmi} style={{ height: height(row.emis) }} />
                ) : null}
                <span className={styles.barExpense} style={{ height: height(row.expenses) }} />
              </span>
            </div>
            <span className={styles.label}>{formatShortMonth(row.month)}</span>
            <div className={styles.tooltip}>
              <strong>{formatMonth(row.month)}</strong>
              {summary(row).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p aria-hidden="true" className={ui.chartDetail}>
        {detail ? [formatMonth(detail.month), ...summary(detail)].join(' · ') : null}
      </p>
      <div className={ui.visuallyHidden}>
        <table>
          <caption>Income, expenses, EMIs and investing by month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Income</th>
              <th scope="col">Expenses</th>
              {showEmis ? <th scope="col">EMIs</th> : null}
              {showInvested ? <th scope="col">Invested from income</th> : null}
            </tr>
          </thead>
          <tbody>
            {months.map((row) => (
              <tr key={row.month}>
                <th scope="row">{formatMonth(row.month)}</th>
                <td>{formatMoney(row.income)}</td>
                <td>{formatMoney(row.expenses)}</td>
                {showEmis ? <td>{formatMoney(row.emis ?? 0)}</td> : null}
                {showInvested ? <td>{formatMoney(row.invested ?? 0)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
