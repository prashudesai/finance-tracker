import { Link, useLocation } from 'react-router';
import { netWorth } from '../../domain/analytics';
import { useView } from '../../store/tracker';
import { formatMoney, localDate } from '../../ui/format';
import ui from '../../ui/ui.module.css';
import styles from './WealthNav.module.css';

const SECTIONS = [
  { to: '/investments', label: 'Investments' },
  { to: '/debts', label: 'Loans' },
];

/**
 * Wealth's top: net worth, what's owned against what's owed, and a switch between investments
 * and loans, which are its two pages.
 */
export function WealthNav() {
  const data = useView();
  const { pathname } = useLocation();
  const worth = netWorth(data, localDate());
  return (
    <section aria-label="Wealth" className={styles.card}>
      <div className={styles.row}>
        <span className={styles.label}>Net worth</span>
        <strong className={styles.value}>{formatMoney(worth.netWorth)}</strong>
      </div>
      <div className={ui.meter}>
        <span className={ui.meterFill} style={{ width: `${worth.assetShare * 100}%` }} />
        <span className={ui.meterDebt} style={{ flex: 1 }} />
      </div>
      <div className={styles.legend}>
        <span>
          Own <strong>{formatMoney(worth.assets)}</strong>
        </span>
        <span>
          Owe <strong className={ui.debt}>{formatMoney(worth.debts)}</strong>
        </span>
      </div>
      <nav aria-label="Wealth sections" className={ui.segmented}>
        {SECTIONS.map(({ to, label }) => (
          <Link
            aria-current={pathname.startsWith(to) ? 'page' : undefined}
            className={pathname.startsWith(to) ? ui.segmentActive : ui.segment}
            key={to}
            to={to}
          >
            {label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
