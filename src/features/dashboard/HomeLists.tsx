import { Link } from 'react-router';
import { isAnyHouseExpense, isRepayment } from '../../domain/analytics';
import { budgetReminders } from '../../domain/budget';
import { addDays } from '../../domain/calendar';
import { upcomingCommitments } from '../../domain/recurring';
import type { TrackerData } from '../../data/repository';
import { CategoryLabel } from '../../ui/CategoryLabel';
import { formatDay, formatMoney, formatShortMonth } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './Home.module.css';

const SHOWN = 6;

/**
 * The next 30 days of scheduled payments and EMIs, and the yearly budget's big bills due this
 * month or next, soonest first.
 */
export function ComingUp({ data, today }: { data: TrackerData; today: string }) {
  const scheduled = upcomingCommitments(
    {
      rules: data.recurringRules,
      occurrences: data.recurringOccurrences,
      income: data.income,
      expenses: data.expenses,
      loans: data.loans,
    },
    today,
    addDays(today, 30),
  )
    .filter((row) => row.kind !== 'income')
    .map((row) => ({
      key: `${row.ruleId}-${row.date}`,
      when: formatDay(row.date),
      sort: row.date,
      name: row.name,
      amount: row.amount,
      to: '/cash-flow',
      state: { commitments: true },
    }));
  const bills = budgetReminders(data, today).map(({ line, month, amount }) => ({
    key: `${line.id}-${month}`,
    when: formatShortMonth(month),
    sort: `${month}-99`,
    name: line.name,
    amount,
    to: '/analytics/budget',
    state: {},
  }));
  const rows = [...scheduled, ...bills]
    .sort((a, b) => a.sort.localeCompare(b.sort))
    .slice(0, SHOWN);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="coming-up" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id="coming-up">Coming up</h2>
        <Link className={ui.textLink} state={{ commitments: true }} to="/cash-flow">
          Next 30 days ›
        </Link>
      </div>
      <ul className={styles.strip}>
        {rows.map((row) => (
          <li key={row.key}>
            <Link className={styles.bill} state={row.state} to={row.to}>
              <span className={styles.billWhen}>{row.when}</span>
              <strong className={styles.billName}>{row.name}</strong>
              <span className={styles.billAmount}>{formatMoney(row.amount)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The latest three entries, income and spending together, newest first. */
export function RecentEntries({ data }: { data: TrackerData }) {
  const rows = [
    ...data.income.map((row) => ({
      kind: 'income' as const,
      id: row.id,
      date: row.date,
      name: row.source,
      icon: row.source,
      detail: row.member,
      amount: row.amount,
      repayment: false,
    })),
    ...data.expenses
      .filter((row) => !isAnyHouseExpense(row))
      .map((row) => ({
        kind: 'expense' as const,
        id: row.id,
        date: row.date,
        // A loan payment shows the loan's own name, such as "Home Loan EMI".
        name: row.loanId
          ? `${data.loans.find((loan) => loan.id === row.loanId)?.type ?? 'Loan'} ${row.repaymentType === 'part-payment' ? 'part payment' : 'EMI'}`
          : row.category,
        icon: row.category,
        detail: row.subcategory || row.notes || row.member || '',
        amount: row.amount,
        repayment: isRepayment(row, data.loans),
      })),
  ]
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
    .slice(0, 3);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="recent" className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 id="recent">Recent</h2>
        <Link className={ui.textLink} to="/cash-flow">
          All ›
        </Link>
      </div>
      <ul className={`${ui.card} ${styles.recent}`}>
        {rows.map((row) => (
          <li key={`${row.kind}-${row.id}`}>
            <Link
              className={styles.entry}
              state={{ found: { kind: row.kind, id: row.id, month: row.date.slice(0, 7) } }}
              to="/cash-flow"
            >
              <span className={styles.entryName}>
                <CategoryLabel icon={row.icon} income={row.kind === 'income'} name={row.name} />
                <small>
                  {formatDay(row.date)}
                  {row.detail ? ` · ${row.detail}` : ''}
                  {row.repayment ? ' · Repays a loan' : ''}
                </small>
              </span>
              <strong className={row.kind === 'income' ? ui.gain : undefined}>
                {row.kind === 'income' ? '+' : '−'}
                {formatMoney(row.amount)}
              </strong>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
