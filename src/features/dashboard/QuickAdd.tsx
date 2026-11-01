import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useTracker } from '../../store/tracker';
import { Modal } from '../../ui/Modal';
import styles from '../../Shell.module.css';
import ui from '../../ui/ui.module.css';

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
  const [open, setOpen] = useState(false);
  if (!canEdit) return null;

  return (
    <>
      <button
        aria-label="Add record"
        className={styles.quickAdd}
        onClick={() => setOpen(true)}
        title="Add record"
        type="button"
      >
        <Plus size={22} />
      </button>
      {open ? (
        <Modal onClose={() => setOpen(false)} title="Add a record">
          <div className={ui.page}>
            {CHOICES.map(({ label, path, add }) => (
              <button
                className={ui.quiet}
                key={label}
                onClick={() => {
                  setOpen(false);
                  void navigate(path, { state: { add } });
                }}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
