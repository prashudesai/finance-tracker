import { Link } from 'react-router';
import type { FigureChange, OverviewTrends } from '../../domain/analytics';
import {
  formatCompactMoney,
  formatDay,
  formatMoney,
  formatMonth,
  formatShortMonth,
} from '../../ui/format';
import { TrendLine } from '../../ui/TrendLine';
import ui from '../../ui/ui.module.css';
import styles from './MonthOverview.module.css';

type Hue = 'income' | 'expense' | 'savings' | 'balance';

const LINE: Record<Hue, string> = {
  income: 'var(--series-income)',
  expense: 'var(--series-expense)',
  savings: 'var(--scenario-base)',
  balance: 'var(--accent)',
};

/** "vs Oct", or "vs 9 Oct" when spending is compared by the same day. */
const versus = (against: string) =>
  `vs ${against.length > 7 ? formatDay(against) : formatShortMonth(against)}`;

function Change({ change }: { change: FigureChange }) {
  const percent = Math.round(Math.abs(change.change) * 100);
  if (percent === 0)
    return <span className={styles.note}>Same as {versus(change.against).slice(3)}</span>;
  const up = change.change > 0;
  return (
    <>
      <span className={change.better ? styles.better : styles.worse}>
        <span aria-hidden="true">{up ? '▲' : '▼'}</span>
        <span className={ui.visuallyHidden}>{up ? 'Up' : 'Down'}</span> {percent}%
      </span>
      <span className={styles.note}>{versus(change.against)}</span>
    </>
  );
}

function Figure({
  hue,
  label,
  value,
  empty,
  series,
  detail,
  to,
  state,
}: {
  hue: Hue;
  label: string;
  value: number;
  empty: boolean;
  series: number[];
  detail: React.ReactNode;
  to: string;
  state?: object;
}) {
  return (
    <Link className={styles.figure} state={state} to={to}>
      <span className={styles.head}>
        <i aria-hidden="true" className={styles.dot} style={{ background: LINE[hue] }} />
        {label}
      </span>
      <span className={styles.row}>
        <span className={empty ? styles.empty : styles.value}>
          {empty ? 'Not yet' : formatMoney(value)}
        </span>
        {series.length >= 2 && !empty ? (
          <TrendLine area color={LINE[hue]} height={22} values={series} width={46} />
        ) : null}
      </span>
      <span className={styles.detail}>{detail}</span>
    </Link>
  );
}

/**
 * This month's income, spending, savings and balance in one card, each with its recent trend and
 * how it compares with last month. Each figure opens where it comes from.
 */
export function MonthOverview({
  month,
  income,
  spent,
  savings,
  available,
  opening,
  trends,
}: {
  month: string;
  income: number;
  spent: number;
  savings: number;
  available: number;
  opening: number | null;
  trends: OverviewTrends;
}) {
  const moved = trends.balance.moved;
  return (
    <section aria-labelledby="month-overview" className={`${ui.card} ${styles.card}`}>
      <div className={styles.top}>
        <h2 className={styles.title} id="month-overview">
          This month
        </h2>
        <span className={styles.month}>{formatMonth(month)}</span>
      </div>
      <div className={styles.grid}>
        <Figure
          detail={trends.income.change ? <Change change={trends.income.change} /> : null}
          empty={income === 0}
          hue="income"
          label="Income"
          series={trends.income.series}
          state={{ show: 'income' }}
          to="/cash-flow"
          value={income}
        />
        <Figure
          detail={trends.expenses.change ? <Change change={trends.expenses.change} /> : null}
          empty={spent === 0}
          hue="expense"
          label="Expenses"
          series={trends.expenses.series}
          state={{ show: 'expense' }}
          to="/cash-flow"
          value={spent}
        />
        <Figure
          detail={trends.savings.change ? <Change change={trends.savings.change} /> : null}
          empty={savings === 0}
          hue="savings"
          label="Savings"
          series={trends.savings.series}
          to="/investments"
          value={savings}
        />
        <Figure
          detail={
            opening === null ? (
              <span className={styles.note}>Opening balance not set</span>
            ) : moved !== null && moved !== 0 ? (
              <>
                <span className={moved > 0 ? styles.better : styles.worse}>
                  <span aria-hidden="true">{moved > 0 ? '▲' : '▼'}</span>
                  <span className={ui.visuallyHidden}>{moved > 0 ? 'Up' : 'Down'}</span>{' '}
                  {formatCompactMoney(Math.abs(moved))}
                </span>
                <span className={styles.note}>since 1 {formatShortMonth(month)}</span>
              </>
            ) : null
          }
          empty={false}
          hue="balance"
          label="Available balance"
          series={trends.balance.series}
          to="/cash-flow"
          value={available}
        />
      </div>
    </section>
  );
}
