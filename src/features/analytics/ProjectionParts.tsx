import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { realValue, runProjection, type ProjectionAsset } from '../../domain/projection';
import { SCENARIOS, type ProjectionAdjustment, type Scenario } from '../../schema/records';
import { useSaveSettings, useSettings, useTracker } from '../../store/tracker';
import { Field } from '../../ui/Field';
import { formatMoney, localDate } from '../../ui/format';
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
        // A cleared field keeps the saved rate, instead of becoming 0%.
        const next = event.target.value === '' ? value : Number(event.target.value);
        if (Number.isFinite(next) && next !== value) onChange(next);
      }}
      step="0.1"
      style={{ width: 76, borderRadius: 8 }}
      type="number"
    />
  );
}

export function GoalPlanner({ assets }: { assets: ProjectionAsset[] }) {
  const settings = useSettings();
  const save = useSaveSettings();
  const today = localDate();
  const { goal } = settings;
  const [years, setYears] = useState(String(goal.years));
  const [inflation, setInflation] = useState(String(goal.inflation));
  const [target, setTarget] = useState(goal.target > 0 ? String(goal.target) : '');
  const parsed = { years: Number(years), inflation: Number(inflation), target: Number(target) };
  const valid =
    years !== '' &&
    inflation !== '' &&
    Number.isInteger(parsed.years) &&
    parsed.years >= 1 &&
    parsed.years <= 40 &&
    parsed.inflation >= 0 &&
    parsed.inflation <= 30 &&
    parsed.target >= 0;

  let error = '';
  const rows: { scenario: Scenario; nominal: number; real: number }[] = [];
  if (valid) {
    try {
      for (const scenario of SCENARIOS) {
        const nominal = runProjection(assets, {
          years: parsed.years,
          scenario,
          currentMonth: today.slice(0, 7),
          includeMonthly: settings.includeMonthlyContributions,
          excluded: settings.excludedContributions,
          adjustments: [],
          gratuityAccounts: [],
        }).ending;
        rows.push({ scenario, nominal, real: realValue(nominal, parsed.inflation, parsed.years) });
      }
    } catch (failure) {
      error = failure instanceof Error ? failure.message : 'This goal could not be calculated.';
    }
  }

  return (
    <div className={ui.page}>
      <form
        className={ui.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) save({ goal: parsed });
        }}
      >
        <Field label="Years to goal">
          <input
            max="40"
            min="1"
            onChange={(event) => setYears(event.target.value)}
            type="number"
            value={years}
          />
        </Field>
        <Field label="Annual inflation assumption (%)">
          <input
            max="30"
            min="0"
            onChange={(event) => setInflation(event.target.value)}
            step="0.1"
            type="number"
            value={inflation}
          />
        </Field>
        <Field label="Portfolio goal in today's rupees">
          <input
            min="0"
            onChange={(event) => setTarget(event.target.value)}
            type="number"
            value={target}
          />
        </Field>
        <div className={ui.formActions}>
          <button className={ui.button} disabled={!valid} type="submit">
            Save goal
          </button>
        </div>
      </form>
      {error ? (
        <p className={ui.notice} role="alert">
          {error}
        </p>
      ) : null}
      <p className={ui.caption}>Portfolio only. Debt and gratuity are excluded.</p>
      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th>Scenario</th>
              <th className={ui.numeric}>Projected</th>
              <th className={ui.numeric}>In today's rupees</th>
              {parsed.target > 0 ? <th className={ui.numeric}>Gap to goal</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.scenario}>
                <td>{SCENARIO_LABELS[row.scenario]}</td>
                <td className={ui.numeric}>{formatMoney(row.nominal)}</td>
                <td className={ui.numeric}>{formatMoney(row.real)}</td>
                {parsed.target > 0 ? (
                  <td className={ui.numeric}>
                    {formatMoney(Math.max(0, parsed.target - row.real))}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
          >
            <Trash2 size={14} />
          </button>
        </li>
      ))}
    </ul>
  );
}
