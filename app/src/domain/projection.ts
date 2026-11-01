import type {
  Holding,
  GratuityAccount,
  ProjectionAdjustment,
  Scenario,
  TrackerSettings,
} from '../schema/records';
import { PMS_TYPE } from '../schema/records';
import { lastDayOfMonth, nextMonth } from './calendar';
import { totalGratuity } from './gratuity';
import {
  growthType,
  holdingPosition,
  monthlyContribution,
  type GrowthType,
  type HoldingData,
} from './holdings';

export type AssetKind = 'investment' | 'pf' | 'eps' | 'ppf' | 'nps' | 'pms' | 'gratuity';

export interface ProjectionAsset {
  name: string;
  kind: AssetKind;
  current: number;
  invested: number;
  monthly: number;
  sourceMonthly: number;
  stepUpPercent: number;
  assumptionGroup: GrowthType;
  returns: Record<Scenario, number>;
}

export interface ProjectionYear {
  fyStart: number;
  opening: number;
  contributions: number;
  additions: number;
  withdrawals: number;
  growth: number;
  closing: number;
}

export interface ProjectionResult {
  rows: ProjectionYear[];
  ending: number;
  totalContributions: number;
  totalAdditions: number;
  totalWithdrawals: number;
  totalGrowth: number;
}

export interface ProjectionOptions {
  years: number;
  scenario: Scenario;
  currentMonth: string;
  includeMonthly: boolean;
  excluded: string[];
  adjustments: ProjectionAdjustment[];
  gratuityAccounts: GratuityAccount[];
}

const ASSET_ORDER = ['PF', 'PPF', 'NPS', PMS_TYPE];
const NPS_RETURNS = { stress: 7, base: 7.5, optimistic: 8 };
const PMS_RETURNS = { stress: 8, base: 11, optimistic: 15 };

/** Rate weighted by current value, or a plain average when nothing has value yet. */
function weightedRate(rows: { current: number; rate: number | undefined }[]) {
  const valid = rows.filter(
    (row): row is { current: number; rate: number } => row.rate !== undefined && row.rate >= 0,
  );
  if (valid.length === 0) return 0;
  const weight = valid.reduce((sum, row) => sum + row.current, 0);
  return weight > 0
    ? valid.reduce((sum, row) => sum + row.current * row.rate, 0) / weight
    : valid.reduce((sum, row) => sum + row.rate, 0) / valid.length;
}

interface Draft {
  name: string;
  kind: AssetKind;
  current: number;
  invested: number;
  monthly: number;
  defaults: Record<Scenario, number>;
}

const flatRates = (rate: number) => ({ stress: rate, base: rate, optimistic: rate });

const assumptionGroup = (draft: Draft, settings: TrackerSettings): GrowthType => {
  if (draft.kind === 'eps') return 'no-return';
  if (draft.kind === 'investment') return growthType(draft.name, settings);
  return draft.kind === 'pf' || draft.kind === 'ppf' ? 'fixed' : 'market';
};

/** Groups holdings into the assets a projection tracks, applying saved assumptions. */
export function projectionAssets(
  holdings: Holding[],
  data: HoldingData,
  settings: TrackerSettings,
  adjustments: ProjectionAdjustment[],
  asOf: string,
): ProjectionAsset[] {
  const positions = holdings.map((holding) => ({
    holding,
    ...holdingPosition(holding, data, asOf),
  }));
  const ofKind = (kind: Holding['kind']) => positions.filter((row) => row.holding.kind === kind);
  const sum = <Row>(rows: Row[], value: (row: Row) => number) =>
    rows.reduce((total, row) => total + value(row), 0);
  const drafts: Draft[] = [];

  const retirement = (kind: 'pf' | 'ppf' | 'nps', name: string) => {
    const rows = ofKind(kind);
    if (rows.length === 0) return;
    const rate = weightedRate(
      rows.map((row) => ({ current: row.current, rate: row.holding.rate })),
    );
    drafts.push({
      name,
      kind,
      current: sum(rows, (row) => row.current),
      invested: sum(rows, (row) => row.invested),
      monthly: sum(rows, (row) => monthlyContribution(row.holding)),
      defaults: kind === 'nps' ? NPS_RETURNS : flatRates(rate),
    });
  };

  retirement('pf', 'PF');
  const pf = ofKind('pf');
  if (pf.some((row) => row.eps > 0 || (row.holding.epsMonthly ?? 0) > 0)) {
    const eps = sum(pf, (row) => row.eps);
    drafts.push({
      name: 'EPS',
      kind: 'eps',
      current: eps,
      invested: eps,
      monthly: sum(pf, (row) => (row.holding.autoContribute ? (row.holding.epsMonthly ?? 0) : 0)),
      defaults: flatRates(0),
    });
  }
  retirement('ppf', 'PPF');
  retirement('nps', 'NPS');

  const groups = new Map<string, typeof positions>();
  for (const row of ofKind('investment')) {
    if (row.holding.type === PMS_TYPE) continue;
    const list = groups.get(row.holding.type);
    if (list) list.push(row);
    else groups.set(row.holding.type, [row]);
  }
  for (const [name, rows] of groups) {
    const noReturn = growthType(name, settings) === 'no-return';
    const current = (row: (typeof rows)[number]) => (noReturn ? row.invested : row.current);
    const rate = weightedRate(
      rows.map((row) => ({ current: current(row), rate: row.holding.rate })),
    );
    drafts.push({
      name,
      kind: 'investment',
      current: sum(rows, current),
      invested: sum(rows, (row) => row.invested),
      monthly: sum(rows, (row) => monthlyContribution(row.holding)),
      defaults: flatRates(rate),
    });
  }

  const pms = ofKind('investment').filter((row) => row.holding.type === PMS_TYPE);
  if (pms.length > 0) {
    drafts.push({
      name: PMS_TYPE,
      kind: 'pms',
      current: sum(pms, (row) => row.current),
      invested: sum(pms, (row) => row.invested),
      monthly: sum(pms, (row) => monthlyContribution(row.holding)),
      defaults: PMS_RETURNS,
    });
  }

  for (const { category } of adjustments) {
    if (!drafts.some((draft) => draft.name === category)) {
      drafts.push({
        name: category,
        kind: 'investment',
        current: 0,
        invested: 0,
        monthly: 0,
        defaults: flatRates(0),
      });
    }
  }

  const rank = (name: string) => {
    const index = ASSET_ORDER.indexOf(name);
    return index === -1 ? ASSET_ORDER.length : index;
  };
  const hasEps = drafts.some((draft) => draft.kind === 'eps');

  return drafts
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
    .map((draft): ProjectionAsset => {
      const saved = settings.returns[draft.name] ?? {};
      const group = assumptionGroup(draft, settings);
      const sourceMonthly = draft.monthly;
      const fallbackMonthly =
        group === 'market' ? (settings.projectionMonthly[draft.name] ?? 0) : 0;
      let returns: Record<Scenario, number> = {
        stress: saved.stress ?? draft.defaults.stress,
        base: saved.base ?? draft.defaults.base,
        optimistic: saved.optimistic ?? draft.defaults.optimistic,
      };
      if (group === 'fixed') returns = flatRates(saved.base ?? draft.defaults.base);
      if (group === 'no-return') returns = flatRates(0);
      const steps = group === 'market' || (group === 'fixed' && sourceMonthly > 0);
      return {
        name: draft.name,
        kind: draft.kind,
        current: draft.current,
        invested: draft.invested,
        monthly: sourceMonthly > 0 ? sourceMonthly : fallbackMonthly,
        sourceMonthly,
        stepUpPercent: steps ? (settings.stepUps[draft.name] ?? 0) : 0,
        assumptionGroup: group,
        returns,
      };
    })
    .filter(
      (asset) =>
        asset.current > 0 ||
        asset.invested > 0 ||
        asset.monthly > 0 ||
        (asset.kind === 'pf' && hasEps) ||
        adjustments.some((row) => row.category === asset.name),
    );
}

const financialYear = (month: string) =>
  Number(month.slice(0, 4)) - (Number(month.slice(5, 7)) < 4 ? 1 : 0);

export const gratuityAsset = (current: number): ProjectionAsset => ({
  name: 'Gratuity',
  kind: 'gratuity',
  current,
  invested: current,
  monthly: 0,
  sourceMonthly: 0,
  stepUpPercent: 0,
  assumptionGroup: 'no-return',
  returns: flatRates(0),
});

/**
 * Projects each asset month by month from next month. PF and PPF earn interest on each
 * month's balance but only credit it in March. Other assets compound monthly.
 * Throws when a planned withdrawal exceeds the projected balance.
 */
export function runProjection(
  assets: ProjectionAsset[],
  options: ProjectionOptions,
): ProjectionResult {
  const { years, scenario, currentMonth, includeMonthly, adjustments, gratuityAccounts } = options;
  const balances = new Map(assets.map((asset) => [asset.name, asset.current]));
  const pendingInterest = new Map(assets.map((asset) => [asset.name, 0]));
  const total = () => [...balances.values()].reduce((sum, value) => sum + value, 0);
  const excluded = new Set(options.excluded);
  if (excluded.has('PF')) excluded.add('EPS');

  const inputs = new Map(
    assets.map((asset) => {
      const pension = asset.kind === 'eps';
      const rate = pension ? 0 : asset.returns[scenario];
      const step = pension ? 0 : Math.min(100, Math.max(0, asset.stepUpPercent));
      return [
        asset.name,
        {
          rate,
          monthlyFactor: Math.pow(1 + rate / 100, 1 / 12),
          monthly: includeMonthly && !excluded.has(asset.name) ? asset.monthly : 0,
          stepFactor: 1 + step / 100,
          yearMonthly: 0,
        },
      ];
    }),
  );

  const planned = new Map<string, Map<string, { additions: number; withdrawals: number }>>();
  for (const row of adjustments) {
    const month = row.date.slice(0, 7);
    const categories = planned.get(month) ?? new Map();
    planned.set(month, categories);
    const totals = categories.get(row.category) ?? { additions: 0, withdrawals: 0 };
    categories.set(row.category, totals);
    if (row.type === 'add') totals.additions += row.amount;
    else totals.withdrawals += row.amount;
  }

  const rows: ProjectionYear[] = [];
  const firstMonth = nextMonth(currentMonth);
  const firstYear = financialYear(firstMonth);
  let yearRow: ProjectionYear | undefined;
  let month = firstMonth;

  for (let offset = 0; offset < years * 12; offset++, month = nextMonth(month)) {
    const fyStart = financialYear(month);
    if (yearRow?.fyStart !== fyStart) {
      const fyStep = Math.max(0, fyStart - firstYear);
      for (const input of inputs.values()) {
        input.yearMonthly = input.monthly * Math.pow(input.stepFactor, fyStep);
      }
      yearRow = {
        fyStart,
        opening: total(),
        contributions: 0,
        additions: 0,
        withdrawals: 0,
        growth: 0,
        closing: 0,
      };
      rows.push(yearRow);
    }

    const flows = planned.get(month);
    const isYearEnd = month.endsWith('-03');
    let growth = 0;

    for (const asset of assets) {
      const balance = balances.get(asset.name) ?? 0;
      if (asset.kind === 'gratuity') {
        const next = totalGratuity(gratuityAccounts, lastDayOfMonth(month));
        growth += next - balance;
        balances.set(asset.name, next);
        continue;
      }
      const input = inputs.get(asset.name);
      if (!input) continue;
      const monthly = input.yearMonthly;
      const additions = flows?.get(asset.name)?.additions ?? 0;
      const withdrawals = flows?.get(asset.name)?.withdrawals ?? 0;
      const preReturn = balance + monthly + additions - withdrawals;
      if (preReturn < -0.005) {
        throw new Error(
          `${asset.name} withdrawal in ${month} exceeds its projected available balance in the ${scenario} scenario.`,
        );
      }
      let afterReturn: number;
      if (asset.kind === 'pf' || asset.kind === 'ppf') {
        const interest =
          (pendingInterest.get(asset.name) ?? 0) +
          (Math.max(0, preReturn) * Math.max(0, input.rate)) / 1200;
        const credit = isYearEnd ? interest : 0;
        pendingInterest.set(asset.name, isYearEnd ? 0 : interest);
        afterReturn = Math.max(0, preReturn) + credit;
        growth += credit;
      } else {
        afterReturn = Math.max(0, preReturn) * input.monthlyFactor;
        growth += afterReturn - preReturn;
      }
      balances.set(asset.name, afterReturn);
      yearRow.contributions += monthly;
      yearRow.additions += additions;
      yearRow.withdrawals += withdrawals;
    }
    yearRow.growth += growth;
    yearRow.closing = total();
  }

  const add = (key: 'contributions' | 'additions' | 'withdrawals' | 'growth') =>
    rows.reduce((sum, row) => sum + row[key], 0);
  return {
    rows,
    ending: rows.at(-1)?.closing ?? 0,
    totalContributions: add('contributions'),
    totalAdditions: add('additions'),
    totalWithdrawals: add('withdrawals'),
    totalGrowth: add('growth'),
  };
}
