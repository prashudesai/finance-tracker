import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ProjectionAsset } from '../../domain/projection';
import type { ProjectionAdjustment, Scenario } from '../../schema/records';
import { useSaveSettings, useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney } from '../../ui/format';
import ui from '../../ui/ui.module.css';

export const SCENARIO_LABELS: Record<Scenario, string> = {
  stress: 'Stress',
  base: 'Base',
  optimistic: 'Optimistic',
};

/** Saves a changed return or step-up assumption. */
export function useAssumptions() {
  const settings = useSettings();
  const save = useSaveSettings();
  return {
    setRate: (asset: ProjectionAsset, scenario: Scenario, value: number) =>
      save({
        returns: {
          ...settings.returns,
          [asset.name]: { ...settings.returns[asset.name], [scenario]: value },
        },
      }),
    setStepUp: (asset: ProjectionAsset, value: number) =>
      save({ stepUps: { ...settings.stepUps, [asset.name]: value } }),
  };
}

export function RateInput({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  return (
    <input
      aria-label={label}
      className={ui.fieldSelect}
      defaultValue={Number(value.toFixed(2))}
      disabled={disabled}
      inputMode="decimal"
      key={value}
      onBlur={(event) => {
        // A cleared field shows the saved rate again, instead of becoming 0%.
        if (event.target.value === '') {
          event.target.value = String(Number(value.toFixed(2)));
          return;
        }
        const next = Number(event.target.value);
        if (Number.isFinite(next) && next !== value) onChange(next);
      }}
      step="0.1"
      style={{ width: 76, borderRadius: 8 }}
      type="number"
    />
  );
}

export function AdjustmentForm({
  categories,
  onDone,
}: {
  categories: string[];
  onDone: () => void;
}) {
  const commit = useTracker((state) => state.commit);
  const [category, setCategory] = useState(categories[0] ?? '');
  const [type, setType] = useState<'add' | 'withdraw'>('add');
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const valid = category !== '' && date !== '' && Number(amount) > 0;
  return (
    <form
      className={ui.form}
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        const id = crypto.randomUUID();
        const value: ProjectionAdjustment = { id, category, type, date, amount: Number(amount) };
        commit([{ type: 'set', collection: 'projectionAdjustments', id, value }]);
        onDone();
      }}
    >
      <Field label="Asset">
        <select onChange={(event) => setCategory(event.target.value)} value={category}>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Change">
        <select
          onChange={(event) => setType(event.target.value as 'add' | 'withdraw')}
          value={type}
        >
          <option value="add">Add money</option>
          <option value="withdraw">Withdraw money</option>
        </select>
      </Field>
      <Field label="Date">
        <input onChange={(event) => setDate(event.target.value)} type="date" value={date} />
      </Field>
      <Field label="Amount (₹)">
        <input
          inputMode="decimal"
          onChange={(event) => setAmount(event.target.value)}
          type="number"
          value={amount}
        />
      </Field>
      <div className={ui.formActions}>
        <button className={ui.button} disabled={!valid} type="submit">
          Save planned change
        </button>
      </div>
    </form>
  );
}

export function PlannedChanges() {
  const commit = useTracker((state) => state.commit);
  const adjustments = useTracker((state) => state.data.projectionAdjustments);
  if (adjustments.length === 0) {
    return <p className={ui.empty}>No planned additions or withdrawals.</p>;
  }
  return (
    <ul className={ui.list}>
      {adjustments.map((row) => (
        <li className={ui.row} key={row.id}>
          <div className={ui.rowMain}>
            <div className={ui.rowTitle}>{row.category}</div>
            <div className={ui.rowDetail}>
              {row.type === 'add' ? 'Add' : 'Withdraw'} on {row.date}
            </div>
          </div>
          <span className={ui.amount}>{formatMoney(row.amount)}</span>
          <button
            aria-label={`Delete planned change for ${row.category}`}
            className={ui.smallIcon}
            onClick={() =>
              commit([{ type: 'delete', collection: 'projectionAdjustments', id: row.id }])
            }
            type="button"
            data-tip="Delete"
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
