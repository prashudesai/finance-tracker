import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ForwardedRef,
  type SelectHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { useSaveSettings, useSettings, useTracker } from '../store/tracker';
import { Field } from './Field';
import { Modal } from './Modal';
import ui from './ui.module.css';

const ADD_NEW = '__add_new__';

export type CustomList = 'incomeSources' | 'expenseCategories' | 'debtTypes' | 'investmentTypes';

const LABELS: Record<CustomList, string> = {
  incomeSources: 'Income source',
  expenseCategories: 'Expense category',
  debtTypes: 'Debt type',
  investmentTypes: 'Investment type',
};

function AddValueForm({
  list,
  existing,
  onCancel,
  onSaved,
}: {
  list: CustomList;
  existing: string[];
  onCancel: () => void;
  onSaved: (value: string) => void;
}) {
  const settings = useSettings();
  const save = useSaveSettings();
  const [name, setName] = useState('');
  const [growth, setGrowth] = useState('');
  const [error, setError] = useState('');
  const investment = list === 'investmentTypes';

  return (
    // Rendered in a portal, so this submit must not reach the form behind it.
    <form
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const value = name.trim();
        if (!value) {
          setError('Enter a name using 1 to 60 characters.');
          return;
        }
        if (existing.some((item) => item.toLowerCase() === value.toLowerCase())) {
          setError('That value already exists.');
          return;
        }
        if (investment && !growth) {
          setError('Choose a growth calculation.');
          return;
        }
        save({
          [list]: [...settings[list], value],
          ...(investment
            ? {
                growthTypes: {
                  ...settings.growthTypes,
                  [value]: growth as 'market' | 'fixed' | 'no-return',
                },
              }
            : {}),
        });
        onSaved(value);
      }}
    >
      <Field label="Name">
        <input
          autoFocus
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </Field>
      {investment ? (
        <Field label="Growth calculation">
          <select onChange={(event) => setGrowth(event.target.value)} value={growth}>
            <option value="">Choose calculation</option>
            <option value="market">Market linked</option>
            <option value="fixed">Fixed return</option>
            <option value="no-return">No return</option>
          </select>
        </Field>
      ) : null}
      {error ? (
        <p className={ui.fieldError} role="alert" style={{ gridColumn: '1 / -1', margin: 0 }}>
          {error}
        </p>
      ) : null}
      <div className={ui.formActions}>
        <button className={ui.quiet} onClick={onCancel} type="button">
          Cancel
        </button>
        <button className={ui.button} type="submit">
          Save and select
        </button>
      </div>
    </form>
  );
}

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  options: string[];
  placeholder?: string;
  /** Adds a "+ Add new…" option that saves to this list. */
  addTo?: CustomList;
};

function assign(ref: ForwardedRef<HTMLSelectElement>, node: HTMLSelectElement | null) {
  if (typeof ref === 'function') ref(node);
  else if (ref) ref.current = node;
}

/** A select that can offer "+ Add new…", as the older app's dropdowns did. */
export const Select = forwardRef<HTMLSelectElement, Props>(function Select(
  { options, placeholder, addTo, onChange, ...props },
  ref,
) {
  const canEdit = useTracker((state) => state.canEdit);
  const element = useRef<HTMLSelectElement | null>(null);
  const previous = useRef('');
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<string | null>(null);

  // A new value can only be selected once its option has rendered.
  useEffect(() => {
    const node = element.current;
    if (!node || pending === null || !options.includes(pending)) return;
    node.value = pending;
    previous.current = pending;
    onChange?.({ target: node, type: 'change' } as unknown as ChangeEvent<HTMLSelectElement>);
    setPending(null);
  }, [pending, options, onChange]);

  return (
    <>
      <select
        ref={(node) => {
          element.current = node;
          assign(ref, node);
        }}
        {...props}
        onChange={(event) => {
          if (event.target.value === ADD_NEW) {
            event.target.value = previous.current;
            setAdding(true);
            return;
          }
          previous.current = event.target.value;
          onChange?.(event);
        }}
        onFocus={(event) => {
          previous.current = event.target.value;
          props.onFocus?.(event);
        }}
      >
        {placeholder === undefined ? null : <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        {addTo && canEdit ? <option value={ADD_NEW}>+ Add new…</option> : null}
      </select>
      {adding && addTo
        ? createPortal(
            <Modal onClose={() => setAdding(false)} title={`Add ${LABELS[addTo].toLowerCase()}`}>
              <AddValueForm
                existing={options}
                list={addTo}
                onCancel={() => setAdding(false)}
                onSaved={(value) => {
                  setAdding(false);
                  setPending(value);
                }}
              />
            </Modal>,
            document.body,
          )
        : null}
    </>
  );
});
