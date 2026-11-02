import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTracker } from '../store/tracker';
import ui from './ui.module.css';

/** Says what belongs here and how to start. Viewers can't add, so they see no action. */
export function EmptyState({
  icon: Icon,
  title,
  text,
  action,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  const canEdit = useTracker((state) => state.canEdit);
  return (
    <div className={ui.emptyState}>
      <span aria-hidden="true" className={ui.tileIcon}>
        <Icon size={20} />
      </span>
      <strong>{title}</strong>
      <span className={ui.caption}>{text}</span>
      {canEdit ? action : null}
    </div>
  );
}
