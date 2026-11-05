import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import ui from './ui.module.css';

export function Stat({
  label,
  value,
  icon: Icon,
  detail,
  tone,
  hue,
  empty = false,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  detail?: ReactNode;
  tone?: string | undefined;
  /** Colours the icon to match the figure's chart series. */
  hue?: 'income' | 'expense' | 'savings';
  /** Nothing recorded yet: says so quietly, rather than showing a bright ₹0. */
  empty?: boolean;
}) {
  return (
    <div className={ui.tile}>
      <div className={ui.tileHead}>
        <span aria-hidden="true" className={ui.tileIcon} data-hue={hue}>
          <Icon size={18} />
        </span>
        <span className={ui.statLabel}>{label}</span>
      </div>
      <div className={`${ui.statValue} ${empty ? ui.statEmpty : (tone ?? '')}`}>
        {empty ? 'Not yet' : value}
      </div>
      {detail ? <div className={ui.caption}>{detail}</div> : null}
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
