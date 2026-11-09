import { Link } from 'react-router';
import { debtFreeMonth, paidShare, remainingEmis, summarizeLoans } from '../../domain/summary';
import type { TrackerData } from '../../data/repository';
import { formatMoney, formatPercent, formatShortMonthYear } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './LoansSummary.module.css';

/** What's still owed on each loan, how far it's paid, and when the last one ends. */
export function LoansSummary({ data, today }: { data: TrackerData; today: string }) {
  const loans = summarizeLoans(data, today).filter(({ ledger }) => ledger && ledger.remaining > 0);
  if (loans.length === 0) return null;
  const freeBy = debtFreeMonth(loans, today.slice(0, 7));
  return (
    <section aria-labelledby="wealth-loans" className={styles.section}>
      <div className={styles.head}>
        <h2 id="wealth-loans">Loans</h2>
        <Link className={ui.textLink} to="/debts">
          {freeBy ? `Debt-free by ${formatShortMonthYear(freeBy)} ›` : 'All loans ›'}
        </Link>
      </div>
      <ul className={`${ui.card} ${styles.list}`}>
        {loans.map(({ id, type, member, ledger }) => {
          if (!ledger) return null;
          const paid = paidShare(ledger);
          const left = remainingEmis(ledger);
          return (
            <li key={id}>
              <Link className={styles.loan} state={{ loan: id }} to="/debts">
                <span className={styles.top}>
                  <strong>{type}</strong>
                  <strong>{formatMoney(ledger.remaining)}</strong>
                </span>
                <span className={styles.bar}>
                  <i style={{ width: `${paid * 100}%` }} />
                </span>
                <span className={styles.foot}>
                  <span>
                    {formatPercent(paid, 0)} paid · {formatMoney(ledger.emi)} a month
                    {member ? ` · ${member.split(' ')[0]}` : ''}
                  </span>
                  <span>{left === null ? '' : `${left} EMIs left`}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
