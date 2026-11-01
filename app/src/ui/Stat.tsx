import type { LucideIcon } from 'lucide-react';
import ui from './ui.module.css';

export function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className={ui.tile}>
      <span aria-hidden="true" className={ui.tileIcon}>
        <Icon size={20} />
      </span>
      <div>
        <div className={ui.statLabel}>{label}</div>
        <div className={ui.statValue}>{value}</div>
      </div>
    </div>
  );
}
