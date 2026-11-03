import { Plus } from 'lucide-react';
import { useRef } from 'react';
import { useNavigate } from 'react-router';
import { useTracker } from '../../store/tracker';
import styles from '../../Shell.module.css';

const MENU_ID = 'quick-add-menu';

const CHOICES = [
  { label: 'Income', path: '/cash-flow', add: 'income' },
  { label: 'Expense or loan payment', path: '/cash-flow', add: 'expense' },
  { label: 'Investment', path: '/investments', add: 'investment' },
  { label: 'PMS contribution', path: '/investments', add: 'pms' },
  { label: 'Loan or debt', path: '/debts', add: true },
];

/** The dashboard's + button. Each choice opens that entry on its own page. */
export function QuickAdd() {
  const canEdit = useTracker((state) => state.canEdit);
  const navigate = useNavigate();
  const menu = useRef<HTMLDivElement>(null);
  if (!canEdit) return null;

  return (
    <>
      <button
        aria-label="Add record"
        className={styles.quickAdd}
        popoverTarget={MENU_ID}
        title="Add record"
        type="button"
      >
        <Plus size={22} />
      </button>
      <div
        aria-label="Add a record"
        className={styles.quickMenu}
        id={MENU_ID}
        popover="auto"
        ref={menu}
      >
        {CHOICES.map(({ label, path, add }) => (
          <button
            key={label}
            onClick={() => {
              menu.current?.hidePopover?.();
              void navigate(path, { state: { add } });
            }}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
