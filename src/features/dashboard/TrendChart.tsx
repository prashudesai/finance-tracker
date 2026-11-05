import { useState } from 'react';
import type { MonthTrend } from '../../domain/cashflow';
import { formatCompactMoney, formatMoney, formatMonth, formatShortMonth } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './TrendChart.module.css';

/** A month's income, and what went out: spending, with savings contributions on top. */
export interface TrendRow extends MonthTrend {
  invested?: number;
}

export function TrendChart({ months }: { months: TrendRow[] }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const detail = months.find((row) => row.month === chosen);
  const showInvested = months.some((row) => (row.invested ?? 0) > 0);
  const peak = Math.max(
    ...months.flatMap((row) => [row.income, row.expenses + (row.invested ?? 0)]),
    1,
  );
  const summary = (row: TrendRow) => [
    `Income ${formatMoney(row.income)}`,
    `Expenses ${formatMoney(row.expenses)}`,
    ...(showInvested ? [`Invested ${formatMoney(row.invested ?? 0)}`] : []),
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
        {showInvested ? (
          <span>
            <i className={styles.swatchInvested} /> Invested
          </span>
        ) : null}
      </figcaption>
      <div aria-hidden="true" className={styles.plot}>
        <span className={styles.gridTop}>{formatCompactMoney(peak)}</span>
        <span className={styles.gridMiddle}>{formatCompactMoney(peak / 2)}</span>
        {months.map((row) => (
          <div className={styles.month} key={row.month} onClick={() => setChosen(row.month)}>
            <div className={styles.bars}>
              <span className={styles.barIncome} style={{ height: height(row.income) }} />
              {/* Spending at the base, what was invested stacked on it. */}
              <span className={styles.stack}>
                {row.invested ? (
                  <span className={styles.barInvested} style={{ height: height(row.invested) }} />
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
          <caption>Income, expenses and investing by month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Income</th>
              <th scope="col">Expenses</th>
              {showInvested ? <th scope="col">Invested</th> : null}
            </tr>
          </thead>
          <tbody>
            {months.map((row) => (
              <tr key={row.month}>
                <th scope="row">{formatMonth(row.month)}</th>
                <td>{formatMoney(row.income)}</td>
                <td>{formatMoney(row.expenses)}</td>
                {showInvested ? <td>{formatMoney(row.invested ?? 0)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
