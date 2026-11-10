import type { LucideIcon } from 'lucide-react';
import { useId, type KeyboardEvent } from 'react';
import styles from './Choices.module.css';

export interface Choice<Value extends string> {
  value: Value;
  label: string;
  hint?: string;
  icon?: LucideIcon;
}

/**
 * A set of tappable options in place of a dropdown, all visible at once. Works as a radio
 * group: arrow keys move between options and choose.
 */
export function Choices<Value extends string>({
  label,
  options,
  value,
  onChange,
  error,
  extra,
  large = false,
}: {
  label: string;
  options: Choice<Value>[];
  value: Value | '';
  onChange: (value: Value) => void;
  error?: string | undefined;
  /** A trailing action, such as adding a new option. */
  extra?: { label: string; onClick: () => void };
  /** Bigger tiles with icons and hints, for the main choice of a form. */
  large?: boolean;
}) {
  const id = useId();
  const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    if (!next) return;
    onChange(next.value);
    const group = event.currentTarget.parentElement;
    group?.querySelector<HTMLButtonElement>(`[data-value="${CSS.escape(next.value)}"]`)?.focus();
  };
  const current = options.some((option) => option.value === value) ? value : options[0]?.value;

  return (
    <div className={styles.field}>
      <span className={styles.label} id={id}>
        {label}
      </span>
      <div aria-labelledby={id} className={large ? styles.tiles : styles.chips} role="radiogroup">
        {options.map((option, index) => {
          const Icon = option.icon;
          return (
            <button
              aria-checked={option.value === value}
              className={large ? styles.tile : styles.chip}
              data-value={option.value}
              key={option.value}
              onClick={() => onChange(option.value)}
              onKeyDown={(event) => move(event, index)}
              role="radio"
              tabIndex={option.value === current ? 0 : -1}
              type="button"
            >
              {Icon ? <Icon aria-hidden="true" size={large ? 18 : 15} /> : null}
              <span>
                {option.label}
                {option.hint ? <small>{option.hint}</small> : null}
              </span>
            </button>
          );
        })}
        {extra ? (
          <button
            className={`${large ? styles.tile : styles.chip} ${styles.extra}`}
            onClick={extra.onClick}
            type="button"
          >
            <span>{extra.label}</span>
          </button>
        ) : null}
      </div>
      {error ? (
        <span className={styles.error} role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
