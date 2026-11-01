import type { MonthTrend } from '../../domain/cashflow';
import { formatCompactMoney, formatMoney, formatMonth, formatShortMonth } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './TrendChart.module.css';

/** Full house expense stays pending until both bank balances are recorded. */
export interface TrendRow extends MonthTrend {
  pending?: boolean;
}

export function TrendChart({ months }: { months: TrendRow[] }) {
  const peak = Math.max(...months.flatMap((row) => [row.income, row.expenses]), 1);
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
      </figcaption>
      <div aria-hidden="true" className={styles.plot}>
        <span className={styles.gridTop}>{formatCompactMoney(peak)}</span>
        <span className={styles.gridMiddle}>{formatCompactMoney(peak / 2)}</span>
        {months.map((row) => (
          <div className={styles.month} key={row.month}>
            <div className={styles.bars}>
              <span className={styles.barIncome} style={{ height: height(row.income) }} />
              {row.pending ? null : (
                <span className={styles.barExpense} style={{ height: height(row.expenses) }} />
              )}
            </div>
            <span className={styles.label}>{formatShortMonth(row.month)}</span>
            <div className={styles.tooltip}>
              <strong>{formatMonth(row.month)}</strong>
              <span>Income {formatMoney(row.income)}</span>
              <span>Expenses {row.pending ? 'Pending' : formatMoney(row.expenses)}</span>
            </div>
          </div>
        ))}
      </div>
      <div className={ui.visuallyHidden}>
        <table>
          <caption>Income and expenses by month</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col">Income</th>
              <th scope="col">Expenses</th>
            </tr>
          </thead>
          <tbody>
            {months.map((row) => (
              <tr key={row.month}>
                <th scope="row">{formatMonth(row.month)}</th>
                <td>{formatMoney(row.income)}</td>
                <td>{row.pending ? 'Pending' : formatMoney(row.expenses)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
