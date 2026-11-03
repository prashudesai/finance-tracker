import type { ReactNode } from 'react';
import ui from './ui.module.css';

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className={ui.pageHeader}>
      <div>
        <p className={ui.eyebrow}>{eyebrow}</p>
        <h1 className={ui.titleBar}>{title}</h1>
        {subtitle ? <p className={ui.subtitle}>{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}
