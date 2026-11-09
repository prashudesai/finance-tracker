import { Link, useLocation } from 'react-router';
import { holdingRows, netWorth, portfolioCategories } from '../../domain/analytics';
import { useView } from '../../store/tracker';
import { chartColor } from '../../ui/charts';
import { formatAmount, formatMoney, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './WealthNav.module.css';

export type WealthSection = 'investments' | 'retirement' | 'loans';

const NAMES: Record<WealthSection, string> = {
  investments: 'Investments',
  retirement: 'Retirement',
  loans: 'Loans',
};
const KEY = 'investmentSection';
const SHOWN = 4;

/**
 * Wealth's top: what's owned after what's owed, the split between them, what the investments
 * are made of, and chips for investments, retirement accounts and loans.
 */
export function WealthNav({
  section,
  onSection,
}: {
  section: WealthSection;
  /** On the investments page, picks which of its parts to show. */
  onSection?: (next: 'investments' | 'retirement') => void;
}) {
  const data = useView();
  const today = localDate();
  const { pathname } = useLocation();
  const worth = netWorth(data, today);
  const categories = portfolioCategories(holdingRows(data, today)).filter((row) => row.current > 0);
  const total = categories.reduce((sum, row) => sum + row.current, 0);

  const pick = (next: 'investments' | 'retirement') => {
    onSection?.(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  };

  return (
    <>
      <section aria-label="Wealth" className={`${ui.hero} ${styles.card}`}>
        <span className={styles.label}>What you own, after what you owe</span>
        <strong className={styles.value}>{formatMoney(worth.netWorth)}</strong>
        <div className={styles.legend}>
          <span>
            Assets <strong>{formatAmount(worth.assets)}</strong>
          </span>
          <span>
            Debts <strong className={ui.debt}>{formatAmount(worth.debts)}</strong>
          </span>
        </div>
        <div className={ui.meter}>
          <span className={ui.meterFill} style={{ width: `${worth.assetShare * 100}%` }} />
          <span className={ui.meterDebt} style={{ flex: 1 }} />
        </div>
        {total > 0 ? (
          <ul aria-label="What your investments are made of" className={styles.mix}>
            {categories.slice(0, SHOWN).map((row, index) => (
              <li key={row.name}>
                <i style={{ background: chartColor(index) }} />
                {row.name} {Math.round((row.current / total) * 100)}%
              </li>
            ))}
            {categories.length > SHOWN ? <li>+{categories.length - SHOWN} more</li> : null}
          </ul>
        ) : null}
      </section>
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
    </>
  );
}
