import { X, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import ui from './ui.module.css';

/** A one-line prompt with one action, such as installing the app, set aside with ✕. */
export function Nudge({
  label,
  icon: Icon,
  title,
  detail,
  action,
  closeLabel,
  onClose,
  children,
}: {
  label: string;
  icon: LucideIcon;
  title: string;
  detail: ReactNode;
  action: ReactNode;
  closeLabel: string;
  onClose: () => void;
  /** A dialog the action opens. */
  children?: ReactNode;
}) {
  return (
    <section aria-label={label} className={ui.nudge}>
      <span aria-hidden="true" className={ui.tileIcon}>
        <Icon size={18} />
      </span>
      <div className={ui.nudgeText}>
        <strong>{title}</strong>
        <span className={ui.caption}>{detail}</span>
      </div>
      {action}
      <button aria-label={closeLabel} className={ui.nudgeClose} onClick={onClose} type="button">
        <X size={16} />
      </button>
      {children}
    </section>
  );
}
