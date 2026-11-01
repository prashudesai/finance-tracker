import type { MonthTrend } from '../../domain/cashflow';
import { formatCompactMoney, formatMoney, formatMonth, formatShortMonth } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './TrendChart.module.css';

export function TrendChart({ months }: { months: MonthTrend[] }) {
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
              <span className={styles.barExpense} style={{ height: height(row.expenses) }} />
            </div>
            <span className={styles.label}>{formatShortMonth(row.month)}</span>
            <div className={styles.tooltip}>
              <strong>{formatMonth(row.month)}</strong>
              <span>Income {formatMoney(row.income)}</span>
              <span>Expenses {formatMoney(row.expenses)}</span>
            </div>
          </div>
        ))}
      </div>
      <table className={ui.visuallyHidden}>
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
              <td>{formatMoney(row.expenses)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
