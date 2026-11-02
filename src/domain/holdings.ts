import {
  PMS_TYPE,
  type Contribution,
  type EpsUpdate,
  type Holding,
  type InterestCredit,
  type TrackerSettings,
  type Valuation,
} from '../schema/records';
import { addMonths } from './calendar';
import { absoluteReturn, cagr, calculateXirr, type Cashflow } from './returns';

export type GrowthType = 'market' | 'fixed' | 'no-return';

const MAX_SCHEDULED_MONTHS = 1200;

const BUILT_IN_GROWTH: Record<string, GrowthType> = {
  'Mutual Funds': 'market',
  [PMS_TYPE]: 'market',
  Bonds: 'fixed',
  'Fixed Deposits': 'fixed',
};

export function growthType(type: string, settings?: Pick<TrackerSettings, 'growthTypes'>) {
  return BUILT_IN_GROWTH[type] ?? settings?.growthTypes[type] ?? 'market';
}

export interface HoldingData {
  contributions: Contribution[];
  valuations: Valuation[];
  interestCredits?: InterestCredit[];
  epsUpdates?: EpsUpdate[];
}

const indexes = new WeakMap<object, Map<string, unknown[]>>();

/** Rows by holding. Lists are replaced rather than edited, so each is grouped only once. */
function rowsOfHolding<Row extends { holdingId: string }>(holdingId: string, rows: Row[]) {
  let index = indexes.get(rows) as Map<string, Row[]> | undefined;
  if (!index) {
    index = new Map();
    for (const row of rows) {
      const group = index.get(row.holdingId);
      if (group) group.push(row);
      else index.set(row.holdingId, [row]);
    }
    indexes.set(rows, index);
  }
  return index.get(holdingId) ?? [];
}

/** Rows for one holding, active only, oldest first. */
export function holdingContributions(holdingId: string, contributions: Contribution[]) {
  return rowsOfHolding(holdingId, contributions)
    .filter((row) => !row.skipped)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The newest valuation, or with `asOf`, the newest one known on that date. */
export function latestValuation(holdingId: string, valuations: Valuation[], asOf?: string) {
  return rowsOfHolding(holdingId, valuations).reduce<Valuation | null>((latest, row) => {
    if (asOf !== undefined && row.date > asOf) return latest;
    return latest && latest.date > row.date ? latest : row;
  }, null);
}

export interface HoldingPosition {
  invested: number;
  current: number;
  /** Pension balance held alongside PF. */
  eps: number;
  gain: number;
  absolute: number | null;
  cagr: number | null;
  xirr: number | null;
}

/**
 * Invested is the opening amount plus contributions. Current is the latest valuation,
 * or the opening value, plus contributions and interest credited after it.
 */
export function holdingPosition(
  holding: Holding,
  data: HoldingData,
  asOf: string,
): HoldingPosition {
  const rows = holdingContributions(holding.id, data.contributions).filter(
    (row) => row.date <= asOf,
  );
  const valuation = latestValuation(holding.id, data.valuations, asOf);
  const contributed = rows.reduce((sum, row) => sum + row.amount, 0);
  const invested = holding.openingInvested + contributed;
  const since = valuation?.date ?? '';
  const interest = (data.interestCredits ?? [])
    .filter(
      (row) => row.holdingId === holding.id && row.creditedDate <= asOf && row.creditedDate > since,
    )
    .reduce((sum, row) => sum + row.amount, 0);
  const current =
    (valuation?.value ?? holding.openingValue) +
    interest +
    rows.filter((row) => row.date > since).reduce((sum, row) => sum + row.amount, 0);
  const corrections = (data.epsUpdates ?? [])
    .filter((row) => row.holdingId === holding.id && row.date <= asOf)
    .reduce((sum, row) => sum + row.amount, 0);
  const eps =
    (holding.epsOpening ?? 0) +
    corrections +
    rows.reduce((sum, row) => sum + (row.epsAmount ?? 0), 0);

  const flows: Cashflow[] = [];
  if (holding.openingInvested > 0) {
    flows.push({ date: holding.date, amount: -holding.openingInvested });
  }
  for (const row of rows) if (row.amount > 0) flows.push({ date: row.date, amount: -row.amount });
  flows.push({ date: asOf, amount: current });

  return {
    invested,
    current,
    eps,
    gain: current - invested,
    absolute: absoluteReturn(invested, current),
    cagr: cagr(invested, current, holding.date, asOf),
    xirr: current > 0 ? calculateXirr(flows) : null,
  };
}

/** What each scheduled month contributes. PF excludes the EPS share. */
export function monthlyContribution(holding: Holding) {
  if (!holding.autoContribute) return 0;
  if (holding.kind !== 'pf') return holding.monthly;
  return (holding.employee ?? 0) + (holding.employer ?? 0) - (holding.epsMonthly ?? 0);
}

/**
 * Scheduled contributions due by `today` that have no record yet. IDs are fixed per
 * holding and month, so devices that run this at the same time write the same record.
 */
export function dueContributions(
  holdings: Holding[],
  contributions: Contribution[],
  today: string,
): Contribution[] {
  const recorded = new Set(contributions.map((row) => row.id));
  const due: Contribution[] = [];
  for (const holding of holdings) {
    const amount = monthlyContribution(holding);
    const eps = holding.kind === 'pf' ? (holding.epsMonthly ?? 0) : 0;
    if (!holding.autoStart || (amount <= 0 && eps <= 0)) continue;
    const anchor = Number(holding.autoStart.slice(-2));
    for (let step = 0; step < MAX_SCHEDULED_MONTHS; step++) {
      const date = addMonths(holding.autoStart, step, anchor);
      if (date > today) break;
      const id = `auto_${holding.id}_${date.slice(0, 7).replace('-', '')}`;
      if (date < holding.date || recorded.has(id)) continue;
      due.push({
        id,
        holdingId: holding.id,
        date,
        amount,
        automatic: true,
        ...(holding.kind === 'pf' ? { epsAmount: eps } : {}),
      });
    }
  }
  return due;
}

/** Combined return of several holdings, or null when any of them has no valid history. */
export function groupXirr(holdings: Holding[], data: HoldingData, asOf: string) {
  if (holdings.length === 0) return null;
  const flows: Cashflow[] = [];
  for (const holding of holdings) {
    if (holding.date > asOf) return null;
    if (holding.openingInvested > 0.01) {
      flows.push({ date: holding.date, amount: -holding.openingInvested });
    }
    for (const row of holdingContributions(holding.id, data.contributions)) {
      if (row.date <= asOf && row.amount > 0) flows.push({ date: row.date, amount: -row.amount });
    }
    const { current } = holdingPosition(holding, data, asOf);
    if (current > 0) flows.push({ date: asOf, amount: current });
  }
  return calculateXirr(flows);
}

export interface EpsEntry {
  id: string;
  date: string;
  amount: number;
  kind: 'contribution' | 'correction';
  balance: number;
}

/** EPS movements, oldest first, with the balance after each. EPS earns no interest. */
export function epsLedger(holding: Holding, data: HoldingData): EpsEntry[] {
  const entries = [
    ...holdingContributions(holding.id, data.contributions)
      .filter((row) => row.epsAmount !== undefined)
      .map((row) => ({
        id: row.id,
        date: row.date,
        amount: row.epsAmount ?? 0,
        kind: 'contribution' as const,
      })),
    ...(data.epsUpdates ?? [])
      .filter((row) => row.holdingId === holding.id)
      .map(({ id, date, amount }) => ({ id, date, amount, kind: 'correction' as const })),
  ].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(a.kind === 'correction') - Number(b.kind === 'correction'),
  );
  let balance = holding.epsOpening ?? 0;
  return entries.map((row) => {
    balance += row.amount;
    return { ...row, balance };
  });
}

export const interestCreditId = (holdingId: string, year: number) =>
  `interest_${holdingId}_${year}`;
