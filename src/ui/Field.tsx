import type { ReactNode } from 'react';
import ui from './ui.module.css';

/** The error sits outside the label so a field keeps its name when validation fails. */
export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={ui.field}>
      <label>
        {label}
        {children}
      </label>
      {error ? (
        <span className={ui.fieldError} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
