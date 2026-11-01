import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { financialYearLabel } from '../../domain/calendar';
import { totalGratuity } from '../../domain/gratuity';
import {
  gratuityAsset,
  projectionAssets,
  realValue,
  runProjection,
  type ProjectionAsset,
  type ProjectionResult,
} from '../../domain/projection';
import {
  SCENARIOS,
  TRACKER_SETTINGS_ID,
  type ProjectionAdjustment,
  type Scenario,
  type TrackerSettings,
} from '../../schema/records';
import { useSettings, useTracker, useView } from '../../store/tracker';
import { LineChart } from '../../ui/charts';
import { Field } from '../../ui/Field';
import { formatCompactMoney, formatMoney, localDate } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { Metric } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';

const SCENARIO_LABELS: Record<Scenario, string> = {
  stress: 'Stress',
  base: 'Base',
  optimistic: 'Optimistic',
};

const useSaveSettings = () => {
  const commit = useTracker((state) => state.commit);
  const settings = useSettings();
  return (patch: Partial<TrackerSettings>) =>
    commit([
      {
        type: 'set',
        collection: 'settings',
        id: TRACKER_SETTINGS_ID,
        value: { ...settings, ...patch, id: TRACKER_SETTINGS_ID },
      },
    ]);
};

function RateInput({
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
        const next = Number(event.target.value);
        if (Number.isFinite(next) && next !== value) onChange(next);
      }}
      step="0.1"
      style={{ width: 76, borderRadius: 8 }}
      type="number"
    />
  );
}

function Assumptions({ assets }: { assets: ProjectionAsset[] }) {
  const settings = useSettings();
  const save = useSaveSettings();
  const setRate = (asset: ProjectionAsset, scenario: Scenario, value: number) =>
    save({
      returns: {
        ...settings.returns,
        [asset.name]: { ...settings.returns[asset.name], [scenario]: value },
      },
    });
  return (
    <section className={ui.card}>
      <div>
        <h2 style={{ fontSize: '1.2rem' }}>Current Values and Assumptions</h2>
        <div className={ui.caption}>Annual return by scenario. Fixed-rate assets use one rate.</div>
      </div>
      {assets.length === 0 ? (
        <p className={ui.empty}>Add investments to project their growth.</p>
      ) : (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <thead>
              <tr>
                <th>Asset</th>
                <th className={ui.numeric}>Current</th>
                <th className={ui.numeric}>Monthly</th>
                <th>Stress %</th>
                <th>Base %</th>
                <th>Optimistic %</th>
                <th>Step-up %</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((asset) => {
                const locked = asset.assumptionGroup !== 'market';
                const noReturn = asset.assumptionGroup === 'no-return';
                return (
                  <tr key={asset.name}>
                    <td>
                      <strong>{asset.name}</strong>
                    </td>
                    <td className={ui.numeric}>{formatMoney(asset.current)}</td>
                    <td className={ui.numeric}>{formatMoney(asset.monthly)}</td>
                    {SCENARIOS.map((scenario) => (
                      <td key={scenario}>
                        <RateInput
                          disabled={noReturn || (locked && scenario !== 'base')}
                          label={`${asset.name} ${scenario} return`}
                          onChange={(value) => setRate(asset, scenario, value)}
                          value={asset.returns[scenario]}
                        />
                      </td>
                    ))}
                    <td>
                      <RateInput
                        disabled={noReturn}
                        label={`${asset.name} annual step-up`}
                        onChange={(value) =>
                          save({ stepUps: { ...settings.stepUps, [asset.name]: value } })
                        }
                        value={asset.stepUpPercent}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function GoalPlanner({ assets }: { assets: ProjectionAsset[] }) {
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

function AdjustmentForm({ categories, onDone }: { categories: string[]; onDone: () => void }) {
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

export function ProjectionPage() {
  const data = useView();
  const settings = useSettings();
  const save = useSaveSettings();
  const commit = useTracker((state) => state.commit);
  const today = localDate();
  const [scenario, setScenario] = useState<Scenario>('base');
  const [adding, setAdding] = useState(false);
  const [planning, setPlanning] = useState(false);

  const assets = projectionAssets(data.holdings, data, settings, data.projectionAdjustments, today);
  const gratuityNow = totalGratuity(data.gratuityAccounts, today);
  const withGratuity =
    data.gratuityAccounts.length > 0 && settings.includeGratuity
      ? [...assets, gratuityAsset(gratuityNow)]
      : assets;

  let error = '';
  const results = {} as Record<Scenario, ProjectionResult>;
  for (const item of SCENARIOS) {
    try {
      results[item] = runProjection(withGratuity, {
        years: settings.projectionYears,
        scenario: item,
        currentMonth: today.slice(0, 7),
        includeMonthly: settings.includeMonthlyContributions,
        excluded: settings.excludedContributions,
        adjustments: data.projectionAdjustments,
        gratuityAccounts: data.gratuityAccounts,
      });
    } catch (failure) {
      error =
        failure instanceof Error ? failure.message : 'This projection could not be calculated.';
    }
  }
  const complete = SCENARIOS.every((item) => results[item]);
  const chosen = results[scenario];
  const toggleExcluded = (name: string) =>
    save({
      excludedContributions: settings.excludedContributions.includes(name)
        ? settings.excludedContributions.filter((item) => item !== name)
        : [...settings.excludedContributions, name],
    });
  const paying = assets.filter((asset) => asset.monthly > 0);

  return (
    <div className={ui.page}>
      <section className={ui.card}>
        <h2 style={{ fontSize: '1.2rem' }}>Projection Settings</h2>
        <label className={ui.field}>
          Years: {settings.projectionYears}
          <input
            aria-label="Projection years"
            defaultValue={settings.projectionYears}
            key={settings.projectionYears}
            max="30"
            min="1"
            onMouseUp={(event) => save({ projectionYears: Number(event.currentTarget.value) })}
            onTouchEnd={(event) => save({ projectionYears: Number(event.currentTarget.value) })}
            onKeyUp={(event) => save({ projectionYears: Number(event.currentTarget.value) })}
            style={{ padding: 0 }}
            type="range"
          />
        </label>
        <label className={ui.check}>
          <input
            checked={settings.includeMonthlyContributions}
            onChange={(event) => save({ includeMonthlyContributions: event.target.checked })}
            type="checkbox"
          />
          Include monthly contributions
        </label>
        {data.gratuityAccounts.length > 0 ? (
          <label className={ui.check}>
            <input
              checked={settings.includeGratuity}
              onChange={(event) => save({ includeGratuity: event.target.checked })}
              type="checkbox"
            />
            Include gratuity balance
          </label>
        ) : null}
        {settings.includeMonthlyContributions && paying.length > 0 ? (
          <details className={ui.fold}>
            <summary>Monthly contributions</summary>
            {paying.map((asset) => (
              <label className={ui.check} key={asset.name}>
                <input
                  checked={!settings.excludedContributions.includes(asset.name)}
                  onChange={() => toggleExcluded(asset.name)}
                  type="checkbox"
                />
                {asset.name} · {formatMoney(asset.monthly)}
              </label>
            ))}
          </details>
        ) : null}
      </section>

      <Assumptions assets={assets} />

      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <div>
            <h2 style={{ fontSize: '1.2rem' }}>Goal planning</h2>
            <div className={ui.caption}>See whether your portfolio reaches a target</div>
          </div>
          <button className={ui.quiet} onClick={() => setPlanning(true)} type="button">
            Portfolio goal planner
          </button>
        </div>
      </section>

      <section className={ui.card}>
        <div className={ui.cardHeader}>
          <h2 style={{ fontSize: '1.2rem' }}>Planned changes</h2>
          <button className={ui.quiet} onClick={() => setAdding(true)} type="button">
            <Plus size={16} /> Add
          </button>
        </div>
        {data.projectionAdjustments.length === 0 ? (
          <p className={ui.empty}>No planned additions or withdrawals.</p>
        ) : (
          <ul className={ui.list}>
            {data.projectionAdjustments.map((row) => (
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
        )}
      </section>

      {error ? (
        <p className={ui.notice} role="alert">
          {error}
        </p>
      ) : null}

      {complete ? (
        <>
          <section className={ui.card}>
            <h2 style={{ fontSize: '1.2rem' }}>Projected Portfolio Growth</h2>
            <div className={ui.metrics}>
              {SCENARIOS.map((item) => (
                <Metric
                  key={item}
                  label={SCENARIO_LABELS[item]}
                  value={formatCompactMoney(results[item].ending)}
                />
              ))}
            </div>
            <LineChart
              series={SCENARIOS.map((item) => ({
                name: SCENARIO_LABELS[item],
                points: results[item].rows.map((row) => ({
                  label: financialYearLabel(row.fyStart).replace('FY ', ''),
                  value: row.closing,
                })),
              }))}
              title="Projected closing value by financial year"
            />
          </section>
          <section className={ui.card}>
            <div className={ui.cardHeader} style={{ flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.2rem' }}>Financial Year Breakdown</h2>
              <select
                aria-label="Scenario"
                className={ui.fieldSelect}
                onChange={(event) => setScenario(event.target.value as Scenario)}
                value={scenario}
              >
                {SCENARIOS.map((item) => (
                  <option key={item} value={item}>
                    {SCENARIO_LABELS[item]}
                  </option>
                ))}
              </select>
            </div>
            <div className={ui.tableWrap}>
              <table className={ui.table}>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th className={ui.numeric}>Opening</th>
                    <th className={ui.numeric}>Contributions</th>
                    <th className={ui.numeric}>Added</th>
                    <th className={ui.numeric}>Withdrawn</th>
                    <th className={ui.numeric}>Growth</th>
                    <th className={ui.numeric}>Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {chosen.rows.map((row) => (
                    <tr key={row.fyStart}>
                      <td>{financialYearLabel(row.fyStart)}</td>
                      <td className={ui.numeric}>{formatMoney(row.opening)}</td>
                      <td className={ui.numeric}>{formatMoney(row.contributions)}</td>
                      <td className={ui.numeric}>{formatMoney(row.additions)}</td>
                      <td className={ui.numeric}>{formatMoney(row.withdrawals)}</td>
                      <td className={ui.numeric}>{formatMoney(row.growth)}</td>
                      <td className={ui.numeric}>{formatMoney(row.closing)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}

      {planning ? (
        <Modal onClose={() => setPlanning(false)} title="Portfolio goal planner">
          <GoalPlanner assets={assets} />
        </Modal>
      ) : null}
      {adding ? (
        <Modal onClose={() => setAdding(false)} title="Add planned change">
          <AdjustmentForm
            categories={assets.map((asset) => asset.name)}
            onDone={() => setAdding(false)}
          />
        </Modal>
      ) : null}
    </div>
  );
}
