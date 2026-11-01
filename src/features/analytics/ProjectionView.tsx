import { ChevronDown, Plus } from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { financialYearLabel } from '../../domain/calendar';
import type { GrowthType } from '../../domain/holdings';
import type { ProjectionAsset, ProjectionResult, ProjectionYear } from '../../domain/projection';
import { SCENARIOS, type Scenario } from '../../schema/records';
import { useSaveSettings, useSettings, useTracker } from '../../store/tracker';
import { LineChart } from '../../ui/charts';
import { formatLakhs, formatMoney, formatPercent } from '../../ui/format';
import { Modal } from '../../ui/Modal';
import { Metric } from '../../ui/Stat';
import ui from '../../ui/ui.module.css';
import { useIsPhone } from '../../ui/useIsPhone';
import { SortHeader, useSort, type SortValue } from '../../ui/useSort';
import styles from './Projection.module.css';
import {
  AdjustmentForm,
  GoalPlanner,
  PlannedChanges,
  RateInput,
  SCENARIO_LABELS,
  useAssumptions,
} from './ProjectionParts';

const MAX_YEARS = 10;
/** Longer than the slider, for anyone planning further ahead. */
const MAX_TYPED_YEARS = 40;

const toneOf = (scenario: Scenario) =>
  ({ '--tone': `var(--scenario-${scenario})` }) as CSSProperties;

function contributionGroup({ kind }: ProjectionAsset) {
  if (kind === 'pf' || kind === 'eps') return 'PF + EPS';
  if (kind === 'ppf') return 'PPF';
  if (kind === 'nps') return 'NPS';
  return 'Investments';
}

function Settings({
  assets,
  starting,
  gratuityNow,
  contributions,
}: {
  assets: ProjectionAsset[];
  starting: ProjectionAsset[];
  gratuityNow: number;
  contributions: number | undefined;
}) {
  const settings = useSettings();
  const save = useSaveSettings();
  const hasGratuity = useTracker((state) => state.data.gratuityAccounts.length > 0);
  const phone = useIsPhone();
  const [years, setYears] = useState(settings.projectionYears);
  const [typed, setTyped] = useState(String(settings.projectionYears));
  const [managing, setManaging] = useState(false);
  const paying = assets.filter((asset) => asset.monthly > 0);
  const included = paying.filter((asset) => !settings.excludedContributions.includes(asset.name));
  const monthly = settings.includeMonthlyContributions
    ? included.reduce((sum, asset) => sum + asset.monthly, 0)
    : 0;
  const groups = new Map<string, number>();
  for (const asset of included) {
    const group = contributionGroup(asset);
    groups.set(group, (groups.get(group) ?? 0) + asset.monthly);
  }
  const gratuityIncluded = hasGratuity && settings.includeGratuity;
  const saveYears = (value: number) => {
    const next = Math.min(MAX_TYPED_YEARS, Math.max(1, Math.round(value) || 1));
    setYears(next);
    setTyped(String(next));
    if (next !== settings.projectionYears) save({ projectionYears: next });
  };
  const commitYears = () => saveYears(years);
  // Follows the saved value, so the slider doesn't shift while it's being dragged.
  const sliderEnd = Math.max(MAX_YEARS, settings.projectionYears);

  return (
    <section className={`${ui.card} ${styles.settings}`}>
      <h2 style={{ fontSize: '1.2rem' }}>Projection Settings</h2>
      <div className={styles.overline}>Investment horizon</div>
      <div className={styles.horizon}>
        <input
          aria-label="Projection years"
          max={sliderEnd}
          min="1"
          onChange={(event) => {
            setYears(Number(event.target.value));
            setTyped(event.target.value);
          }}
          onKeyUp={commitYears}
          onMouseUp={commitYears}
          onTouchEnd={commitYears}
          type="range"
          value={years}
        />
        <label className={styles.years}>
          <input
            aria-label="Number of years"
            inputMode="numeric"
            max={MAX_TYPED_YEARS}
            min="1"
            onBlur={() => saveYears(Number(typed))}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
            type="number"
            value={typed}
          />
          {Number(typed) === 1 ? 'year' : 'years'}
        </label>
      </div>
      <div className={styles.range}>
        <span>1 year</span>
        <span>{sliderEnd} years</span>
      </div>
      <div className={styles.toggleBox}>
        <label className={ui.toggleRow}>
          <span className={styles.overline}>Include monthly contributions</span>
          <input
            checked={settings.includeMonthlyContributions}
            className={ui.switch}
            onChange={(event) => save({ includeMonthlyContributions: event.target.checked })}
            role="switch"
            type="checkbox"
          />
        </label>
        {settings.includeMonthlyContributions && paying.length > 0 ? (
          <div className={styles.contribution}>
            <span>
              {formatMoney(monthly)}/month · {included.length} of {paying.length} included
            </span>
            <button className={ui.quiet} onClick={() => setManaging(true)} type="button">
              Manage ›
            </button>
          </div>
        ) : null}
      </div>
      {hasGratuity ? (
        <div className={styles.toggleBox}>
          <label className={ui.toggleRow}>
            <span className={styles.overline}>Gratuity balance</span>
            <input
              checked={settings.includeGratuity}
              className={ui.switch}
              onChange={(event) => save({ includeGratuity: event.target.checked })}
              role="switch"
              type="checkbox"
            />
          </label>
        </div>
      ) : null}
      <div className={styles.inputs} hidden={phone}>
        <div className={styles.overline}>Your projection inputs</div>
        <div>
          <div className={styles.inputRow}>
            <span>Starting portfolio</span>
            <strong>{formatMoney(starting.reduce((sum, row) => sum + row.current, 0))}</strong>
          </div>
          {gratuityIncluded ? (
            <div className={ui.caption}>Includes gratuity shown below.</div>
          ) : null}
        </div>
        <div>
          <div className={styles.inputRow}>
            <span>Monthly contributions</span>
            <strong>{formatMoney(monthly)}</strong>
          </div>
          {monthly > 0 ? (
            <div className={ui.caption}>
              {[...groups].map(([name, amount]) => `${name} ${formatMoney(amount)}`).join(' · ')}
            </div>
          ) : null}
        </div>
        {contributions === undefined ? null : (
          <div>
            <div className={styles.inputRow}>
              <span>
                Contributions over {settings.projectionYears}{' '}
                {settings.projectionYears === 1 ? 'year' : 'years'}
              </span>
              <strong>{formatMoney(contributions)}</strong>
            </div>
            <div className={ui.caption}>Uses your selected contributions and annual increases.</div>
          </div>
        )}
        {gratuityIncluded ? (
          <div className={styles.inputRow}>
            <span>Gratuity included</span>
            <strong>{formatMoney(gratuityNow)}</strong>
          </div>
        ) : null}
      </div>
      {phone ? null : (
        <p className={ui.caption}>Changing these settings affects projections only.</p>
      )}
      {managing ? (
        <Modal onClose={() => setManaging(false)} title="Monthly contributions">
          <div className={ui.page}>
            {paying.map((asset) => (
              <label className={ui.check} key={asset.name}>
                <input
                  checked={!settings.excludedContributions.includes(asset.name)}
                  onChange={() =>
                    save({
                      excludedContributions: settings.excludedContributions.includes(asset.name)
                        ? settings.excludedContributions.filter((name) => name !== asset.name)
                        : [...settings.excludedContributions, asset.name],
                    })
                  }
                  type="checkbox"
                />
                {asset.name} · {formatMoney(asset.monthly)}
              </label>
            ))}
          </div>
        </Modal>
      ) : null}
    </section>
  );
}

function Growth({
  results,
  scenario,
  onScenario,
  years,
}: {
  results: Record<Scenario, ProjectionResult>;
  scenario: Scenario;
  onScenario: (scenario: Scenario) => void;
  years: number;
}) {
  const chosen = results[scenario];
  const phone = useIsPhone();
  const label = (row: ProjectionYear) => financialYearLabel(row.fyStart);
  const span = `${years}-year`;
  return (
    <section className={ui.card}>
      <h2 style={{ fontSize: '1.2rem' }}>Projected Portfolio Growth</h2>
      <LineChart
        height={phone ? undefined : 400}
        narrow={phone}
        series={SCENARIOS.map((item) => ({
          name: SCENARIO_LABELS[item],
          color: `var(--scenario-${item})`,
          points: [
            { label: 'Today', value: results[item].rows[0]?.opening ?? 0 },
            ...results[item].rows.map((row) => ({ label: label(row), value: row.closing })),
          ],
        }))}
        title="Projected closing value by financial year"
      />
      <h3 style={{ margin: 0, fontSize: '1rem' }}>{span} scenario comparison</h3>
      <div className={styles.scenarios}>
        {SCENARIOS.map((item) => (
          <button
            aria-pressed={item === scenario}
            className={styles.scenario}
            key={item}
            onClick={() => onScenario(item)}
            style={toneOf(item)}
            type="button"
          >
            <span className={styles.overline}>{SCENARIO_LABELS[item]}</span>
            <span className={styles.scenarioValue}>{formatLakhs(results[item].ending, 1)}</span>
          </button>
        ))}
      </div>
      <p className={ui.caption}>Choose a scenario for exact values and its yearly breakdown.</p>
      <div className={styles.detail}>
        <div className={styles.detailTitle} style={toneOf(scenario)}>
          <i aria-hidden="true" />
          {SCENARIO_LABELS[scenario]} · {span} projection
        </div>
        <div className={`${ui.compact} ${phone ? '' : styles.fourAcross}`}>
          <Metric label="Projected value" value={formatMoney(chosen.ending)} />
          <Metric label="Monthly contributions" value={formatMoney(chosen.totalContributions)} />
          <Metric label="Projected growth" value={formatMoney(chosen.totalGrowth)} />
          <Metric label="Planned additions" value={formatMoney(chosen.totalAdditions)} />
        </div>
      </div>
    </section>
  );
}

function AssetCard({ asset, peak }: { asset: ProjectionAsset; peak: number }) {
  const { setRate, setStepUp } = useAssumptions();
  const market = asset.assumptionGroup === 'market';
  const fixed = asset.assumptionGroup === 'fixed';
  return (
    <details className={styles.asset}>
      <summary>
        <div className={styles.assetTop}>
          <span>{asset.name}</span>
          <span className={styles.assetValue}>
            {formatMoney(asset.current)}
            <ChevronDown aria-hidden="true" className={styles.chevron} size={14} />
          </span>
        </div>
        {asset.monthly > 0 ? (
          <div className={styles.assetMeta}>
            <span>Monthly {formatMoney(asset.monthly)}</span>
            <span>Step-up {asset.stepUpPercent}%</span>
          </div>
        ) : null}
        {market ? (
          <div className={styles.rates}>
            {SCENARIOS.map((item) => (
              <div className={styles.rate} key={item} style={toneOf(item)}>
                <div>
                  <span>{SCENARIO_LABELS[item]}</span>
                  <span>{asset.returns[item]}%</span>
                </div>
                <div className={styles.rateTrack}>
                  <span style={{ width: `${(asset.returns[item] / peak) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
        {fixed ? (
          <div className={styles.fixedRate}>
            <span>Fixed interest</span>
            <span>{asset.returns.base}%</span>
          </div>
        ) : null}
        {market || fixed ? null : <div className={ui.caption}>No growth assumed</div>}
      </summary>
      {market || fixed ? (
        <div className={styles.edit}>
          {(market ? SCENARIOS : (['base'] as const)).map((item) => (
            <label key={item}>
              {market ? SCENARIO_LABELS[item] : 'Fixed interest'} %
              <RateInput
                label={`${asset.name} ${item} return`}
                onChange={(value) => setRate(asset, item, value)}
                value={asset.returns[item]}
              />
            </label>
          ))}
          <label>
            Step-up %
            <RateInput
              label={`${asset.name} annual step-up`}
              onChange={(value) => setStepUp(asset, value)}
              value={asset.stepUpPercent}
            />
          </label>
        </div>
      ) : null}
    </details>
  );
}

const GROUPS = [
  { key: 'market', title: 'Market linked', text: 'Stress · Base · Optimistic' },
  { key: 'fixed', title: 'Fixed returns', text: 'One fixed interest rate or ROI' },
  { key: 'no-return', title: 'No return', text: 'Balance carried forward with no growth' },
] as const;

function Assumptions({ assets }: { assets: ProjectionAsset[] }) {
  const adjustments = useTracker((state) => state.data.projectionAdjustments);
  const phone = useIsPhone();
  const [adding, setAdding] = useState(false);
  const [openGroup, setOpenGroup] = useState<GrowthType | null>(null);
  const peak = Math.max(1, ...assets.flatMap((asset) => SCENARIOS.map((s) => asset.returns[s])));
  const planned = (type: 'add' | 'withdraw') =>
    adjustments.filter((row) => row.type === type).reduce((sum, row) => sum + row.amount, 0);
  return (
    <section className={ui.card}>
      <div>
        <h2 style={{ fontSize: '1.2rem' }}>Current Values and Assumptions</h2>
        <div className={ui.caption}>Choose a group to view or edit assumptions.</div>
      </div>
      {assets.length === 0 ? (
        <p className={ui.empty}>Add investments to project their growth.</p>
      ) : phone ? (
        <>
          <div className={styles.groupTiles}>
            {GROUPS.map(({ key, title }) => {
              const count = assets.filter((asset) => asset.assumptionGroup === key).length;
              return (
                <button
                  aria-pressed={openGroup === key}
                  className={styles.groupTile}
                  key={key}
                  onClick={() => setOpenGroup(openGroup === key ? null : key)}
                  type="button"
                >
                  <strong>{title}</strong>
                  <span className={ui.caption}>
                    {count} {count === 1 ? 'type' : 'types'}
                  </span>
                </button>
              );
            })}
          </div>
          {openGroup ? (
            assets
              .filter((asset) => asset.assumptionGroup === openGroup)
              .map((asset) => <AssetCard asset={asset} key={asset.name} peak={peak} />)
          ) : (
            <p className={ui.caption}>Tap a group to show its investments.</p>
          )}
        </>
      ) : (
        <div className={styles.groups}>
          {GROUPS.map(({ key, title, text }) => {
            const rows = assets.filter((asset) => asset.assumptionGroup === key);
            return (
              <div className={styles.group} key={key}>
                <div className={styles.groupHeader}>
                  <div>
                    <strong>{title}</strong>
                    <div className={ui.caption}>{text}</div>
                  </div>
                  <span className={styles.count}>
                    {rows.length} {rows.length === 1 ? 'TYPE' : 'TYPES'}
                  </span>
                </div>
                {rows.map((asset) => (
                  <AssetCard asset={asset} key={asset.name} peak={peak} />
                ))}
              </div>
            );
          })}
        </div>
      )}
      <details className={styles.planned}>
        <summary>
          <div>
            <strong>Planned one-time changes</strong>
            <div className={ui.caption}>{adjustments.length} planned</div>
          </div>
          <span className={styles.chips}>
            <span className={styles.added}>Additions {formatMoney(planned('add'))}</span>
            <span className={styles.withdrawn}>Withdrawals {formatMoney(planned('withdraw'))}</span>
            <ChevronDown aria-hidden="true" size={14} />
          </span>
        </summary>
        <div className={styles.plannedBody}>
          <PlannedChanges />
          <div>
            <button className={ui.quiet} onClick={() => setAdding(true)} type="button">
              <Plus size={16} /> Add
            </button>
          </div>
        </div>
      </details>
      {adding ? (
        <Modal onClose={() => setAdding(false)} title="Add planned change">
          <AdjustmentForm
            categories={assets.map((asset) => asset.name)}
            onDone={() => setAdding(false)}
          />
        </Modal>
      ) : null}
    </section>
  );
}

type BreakdownColumn = 'fy' | 'opening' | 'changes' | 'growth' | 'closing' | 'share';

const changesIn = (row: ProjectionYear) => row.contributions + row.additions - row.withdrawals;
const growthShare = (row: ProjectionYear) => (row.opening > 0 ? row.growth / row.opening : 0);

function breakdownValue(row: ProjectionYear, column: BreakdownColumn): SortValue {
  if (column === 'fy') return row.fyStart;
  if (column === 'changes') return changesIn(row);
  if (column === 'share') return growthShare(row);
  return row[column];
}

function Breakdown({ rows, scenario }: { rows: ProjectionYear[]; scenario: Scenario }) {
  const { sorted, sort, toggle } = useSort(rows, breakdownValue);
  const name = SCENARIO_LABELS[scenario];
  const heading = (column: BreakdownColumn, label: string) => (
    <SortHeader column={column} label={label} numeric onSort={toggle} sort={sort} />
  );
  return (
    <section className={ui.card}>
      <h2 style={{ fontSize: '1.2rem' }}>Financial Year Breakdown</h2>
      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <thead>
            <tr>
              <SortHeader column="fy" label="Financial year" onSort={toggle} sort={sort} />
              {heading('opening', 'Opening value')}
              {heading('changes', 'Contributions & changes')}
              {heading('growth', `${name} growth`)}
              {heading('closing', `${name} closing value`)}
              {heading('share', 'Growth / opening')}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.fyStart}>
                <td>{financialYearLabel(row.fyStart)}</td>
                <td className={ui.numeric}>{formatLakhs(row.opening)}</td>
                <td className={ui.numeric}>{formatLakhs(changesIn(row))}</td>
                <td className={ui.numeric}>{formatLakhs(row.growth)}</td>
                <td className={ui.numeric}>{formatLakhs(row.closing)}</td>
                <td className={ui.numeric}>{formatPercent(growthShare(row))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ProjectionView({
  assets,
  starting,
  gratuityNow,
  results,
  error,
  scenario,
  onScenario,
}: {
  assets: ProjectionAsset[];
  starting: ProjectionAsset[];
  gratuityNow: number;
  results: Record<Scenario, ProjectionResult> | null;
  error: string;
  scenario: Scenario;
  onScenario: (scenario: Scenario) => void;
}) {
  const { projectionYears } = useSettings();
  const [planning, setPlanning] = useState(false);
  return (
    <div className={ui.page}>
      {error ? (
        <p className={ui.notice} role="alert">
          {error}
        </p>
      ) : null}
      <div className={styles.layout}>
        <Settings
          assets={assets}
          contributions={results?.[scenario].totalContributions}
          gratuityNow={gratuityNow}
          starting={starting}
        />
        {results ? (
          <Growth
            onScenario={onScenario}
            results={results}
            scenario={scenario}
            years={projectionYears}
          />
        ) : null}
      </div>
      <Assumptions assets={assets} />
      {results ? <Breakdown rows={results[scenario].rows} scenario={scenario} /> : null}
      <details className={`${ui.card} ${ui.fold}`}>
        <summary>Goal planning</summary>
        <div>
          <button className={ui.quiet} onClick={() => setPlanning(true)} type="button">
            Portfolio goal planner
          </button>
        </div>
      </details>
      {planning ? (
        <Modal onClose={() => setPlanning(false)} title="Portfolio goal planner">
          <GoalPlanner assets={assets} />
        </Modal>
      ) : null}
    </div>
  );
}
