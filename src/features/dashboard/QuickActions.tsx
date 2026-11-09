import { ArrowDownToLine, CheckCircle2, Plus, TrendingUp, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router';
import { monthsToReview } from '../../domain/analytics';
import { useTracker } from '../../store/tracker';
import { localDate } from '../../ui/format';
import styles from './Home.module.css';

/** One tap to the things done most: add spending or income, invest, review the month. */
export function QuickActions() {
  const canEdit = useTracker((state) => state.canEdit);
  const household = useTracker((state) => state.data);
  if (!canEdit) return null;
  const today = localDate();
  const review = monthsToReview(household, today)[0] ?? today.slice(0, 7);
  const actions: { label: string; icon: LucideIcon; to: string; state: object }[] = [
    { label: 'Expense', icon: Plus, to: '/cash-flow', state: { add: 'expense' } },
    { label: 'Income', icon: ArrowDownToLine, to: '/cash-flow', state: { add: 'income' } },
    { label: 'Invest', icon: TrendingUp, to: '/investments', state: { add: 'investment' } },
    { label: 'Review', icon: CheckCircle2, to: '/cash-flow', state: { review } },
  ];
  return (
    <nav aria-label="Quick actions" className={styles.actions}>
      {actions.map(({ label, icon: Icon, to, state }) => (
        <Link className={styles.action} key={label} state={state} to={to}>
          <span aria-hidden="true" className={styles.actionIcon}>
            <Icon size={20} />
          </span>
          {label}
        </Link>
      ))}
    </nav>
  );
}
