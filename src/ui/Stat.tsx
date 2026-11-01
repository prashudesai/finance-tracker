import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import ui from './ui.module.css';

export function Stat({
  label,
  value,
  icon: Icon,
  detail,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  detail?: ReactNode;
  tone?: string | undefined;
}) {
  return (
    <div className={ui.tile}>
      <span aria-hidden="true" className={ui.tileIcon}>
        <Icon size={20} />
      </span>
      <div>
        <div className={ui.statLabel}>{label}</div>
        <div className={`${ui.statValue} ${tone ?? ''}`}>{value}</div>
        {detail ? <div className={ui.caption}>{detail}</div> : null}
      </div>
    </div>
  );
}

/** A small labelled figure inside a card. */
export function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail?: ReactNode;
  tone?: string | undefined;
}) {
  return (
    <div className={ui.metric}>
      <div className={ui.label}>{label}</div>
      <div className={`${ui.metricValue} ${tone ?? ''}`}>{value}</div>
      {detail ? <div className={ui.caption}>{detail}</div> : null}
    </div>
  );
}
