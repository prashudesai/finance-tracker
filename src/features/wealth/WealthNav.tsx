import { Link, useLocation } from 'react-router';
import { holdingRows, netWorth } from '../../domain/analytics';
import { debtFreeMonth, summarizeLoans } from '../../domain/summary';
import { useView } from '../../store/tracker';
import {
  formatAmount,
  formatPercent,
  formatShortMonthYear,
  localDate,
  signedMoney,
} from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './WealthNav.module.css';

export type WealthSection = 'investments' | 'retirement' | 'loans';

const NAMES: Record<WealthSection, string> = {
  investments: 'Investments',
  retirement: 'Retirement',
  loans: 'Loans',
};
const KEY = 'investmentSection';

/**
 * Wealth's top: what's owned and its return, what's owed and when it ends, then chips for
 * investments, retirement accounts and loans. Net worth itself leads Home.
 */
export function WealthNav({
  section,
  onSection,
  chips = true,
}: {
  section: WealthSection;
  /** On the investments page, picks which of its parts to show. */
  onSection?: (next: 'investments' | 'retirement') => void;
  /** Off where the page places the chips itself, such as under the asset pie. */
  chips?: boolean;
}) {
  const data = useView();
  const today = localDate();
  const worth = netWorth(data, today);
  const rows = holdingRows(data, today);
  const owned = rows.reduce((sum, row) => sum + row.position.current, 0);
  const invested = rows.reduce((sum, row) => sum + row.position.invested, 0);
  const gain = owned - invested;
  const freeBy = debtFreeMonth(summarizeLoans(data, today), today.slice(0, 7));

  return (
    <>
      <section aria-label="Wealth" className={`${ui.hero} ${styles.card}`}>
        <div className={styles.half}>
          <span className={styles.label}>You own</span>
          <strong className={styles.value}>{formatAmount(owned)}</strong>
          {invested > 0 ? (
            <span className={gain < 0 ? styles.down : styles.up}>
              {signedMoney(gain)} · {formatPercent(gain / invested)} return
            </span>
          ) : null}
        </div>
        <div className={styles.half}>
          <span className={styles.label}>You owe</span>
          <strong className={`${styles.value} ${ui.debt}`}>{formatAmount(worth.debts)}</strong>
          <span className={styles.note}>
            {freeBy
              ? `Debt-free by ${formatShortMonthYear(freeBy)}`
              : worth.debts > 0
                ? 'Across your loans'
                : 'No loans'}
          </span>
        </div>
      </section>
      {chips ? <WealthChips section={section} {...(onSection ? { onSection } : {})} /> : null}
    </>
  );
}

/** Chips for Wealth's parts: investments and retirement accounts on one page, loans on another. */
export function WealthChips({
  section,
  onSection,
}: {
  section: WealthSection;
  onSection?: (next: 'investments' | 'retirement') => void;
}) {
  const { pathname } = useLocation();
  const pick = (next: 'investments' | 'retirement') => {
    onSection?.(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  };
  return (
    <nav aria-label="Wealth sections" className={styles.chips}>
      {(['investments', 'retirement'] as const).map((key) =>
        onSection ? (
          <button
            aria-pressed={section === key}
            className={styles.chip}
            key={key}
            onClick={() => pick(key)}
            type="button"
          >
            {NAMES[key]}
          </button>
        ) : (
          <Link className={styles.chip} key={key} onClick={() => pick(key)} to="/investments">
            {NAMES[key]}
          </Link>
        ),
      )}
      <Link
        aria-current={pathname.startsWith('/debts') ? 'page' : undefined}
        className={styles.chip}
        to="/debts"
      >
        {NAMES.loans}
      </Link>
    </nav>
  );
}
