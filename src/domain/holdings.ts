import {
  PMS_TYPE,
  type Contribution,
  type EpsUpdate,
  type Holding,
  type InterestCredit,
  type Payout,
  type PayoutEvery,
  type TrackerSettings,
  type Valuation,
  type Withdrawal,
} from '../schema/records';
import {
  addMonths,
  financialYearStart,
  lastDayOfMonth,
  previousMonth,
  roundMoney,
} from './calendar';
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

/**
 * How a holding's return is best measured: its interest rate for fixed-rate ones (deposits,
 * bonds, PF, PPF), plain gain over what was put in when it earns nothing on its own, and XIRR
 * for market-linked ones, where the timing of contributions matters.
 */
export function returnMeasure(
  holding: Pick<Holding, 'kind' | 'type'>,
  settings?: Pick<TrackerSettings, 'growthTypes'>,
): 'rate' | 'absolute' | 'xirr' {
  if (holding.kind === 'pf' || holding.kind === 'ppf') return 'rate';
  if (holding.kind !== 'investment') return 'xirr';
  const growth = growthType(holding.type, settings);
  return growth === 'fixed' ? 'rate' : growth === 'no-return' ? 'absolute' : 'xirr';
}

export interface HoldingData {
  contributions: Contribution[];
  valuations: Valuation[];
  interestCredits?: InterestCredit[];
  epsUpdates?: EpsUpdate[];
  withdrawals?: Withdrawal[];
  payouts?: Payout[];
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

/** Withdrawals for one holding, oldest first. */
export const holdingWithdrawals = (holdingId: string, withdrawals: Withdrawal[] = []) =>
  [...rowsOfHolding(holdingId, withdrawals)].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );

/** The newest valuation, or with `asOf`, the newest one known on that date. */
export function latestValuation(holdingId: string, valuations: Valuation[], asOf?: string) {
  return rowsOfHolding(holdingId, valuations).reduce<Valuation | null>((latest, row) => {
    if (asOf !== undefined && row.date > asOf) return latest;
    return latest && latest.date > row.date ? latest : row;
  }, null);
}

export interface HoldingPosition {
  /** Still invested, after the cost of anything withdrawn. */
  invested: number;
  current: number;
  /** Profit taken out by withdrawals: what was received less its average cost. */
  booked: number;
  /** Pension balance held alongside PF. */
  eps: number;
  /** Interest paid out to the bank, which counts towards the gain. */
  paidOut: number;
  gain: number;
  absolute: number | null;
  cagr: number | null;
  xirr: number | null;
}

/** A holding's value on a date, without the slower return figures. */
export function holdingValue(holding: Holding, data: HoldingData, asOf: string) {
  const valuation = latestValuation(holding.id, data.valuations, asOf);
  const since = valuation?.date ?? '';
  const interest = (data.interestCredits ?? [])
    .filter(
      (row) => row.holdingId === holding.id && row.creditedDate <= asOf && row.creditedDate > since,
    )
    .reduce((sum, row) => sum + row.amount, 0);
  const added = holdingContributions(holding.id, data.contributions)
    .filter((row) => row.date <= asOf && row.date > since)
    .reduce((sum, row) => sum + row.amount, 0);
  const taken = holdingWithdrawals(holding.id, data.withdrawals)
    .filter((row) => row.date <= asOf && row.date > since)
    .reduce((sum, row) => sum + row.amount, 0);
  return (valuation?.value ?? holding.openingValue) + interest + added - taken;
}

export interface WithdrawalEntry {
  id: string;
  date: string;
  amount: number;
  /** The share of the invested amount it took out. */
  cost: number;
  profit: number;
}

/**
 * The invested amount after withdrawals, by average cost. Each withdrawal takes the same
 * share of the invested amount as it took of the value: the value that day after it,
 * plus what was taken. Contributions on the same day count first.
 */
export function withdrawalLedger(holding: Holding, data: HoldingData, asOf: string) {
  const contributions = holdingContributions(holding.id, data.contributions).filter(
    (row) => row.date <= asOf,
  );
  const withdrawals = holdingWithdrawals(holding.id, data.withdrawals).filter(
    (row) => row.date <= asOf,
  );
  let invested = holding.openingInvested;
  let next = 0;
  const entries: WithdrawalEntry[] = [];
  withdrawals.forEach((row, index) => {
    for (
      let item = contributions[next];
      item && item.date <= row.date;
      item = contributions[++next]
    ) {
      invested += item.amount;
    }
    const laterSameDay = withdrawals
      .slice(index + 1)
      .filter((item) => item.date === row.date)
      .reduce((sum, item) => sum + item.amount, 0);
    const before = holdingValue(holding, data, row.date) + laterSameDay + row.amount;
    const share = before > 0 ? Math.min(1, row.amount / before) : 1;
    const cost = roundMoney(invested * share);
    invested -= cost;
    const { id, date, amount } = row;
    entries.push({ id, date, amount, cost, profit: roundMoney(amount - cost) });
  });
  for (; next < contributions.length; next++) invested += contributions[next]?.amount ?? 0;
  return { invested: roundMoney(invested), entries };
}

/** Booked profit by financial year, newest first. Years with no withdrawals are left out. */
export function bookedProfitByYear(holdings: Holding[], data: HoldingData, asOf: string) {
  const years = new Map<number, number>();
  for (const holding of holdings) {
    for (const row of withdrawalLedger(holding, data, asOf).entries) {
      const year = financialYearStart(row.date);
      years.set(year, roundMoney((years.get(year) ?? 0) + row.profit));
    }
  }
  return [...years].sort(([a], [b]) => b - a).map(([year, profit]) => ({ year, profit }));
}

/**
 * Invested is the opening amount plus contributions, less the average cost of anything
 * withdrawn. Current is the latest valuation, or the opening value, plus contributions
 * and interest credited after it, less withdrawals after it.
 */
export function holdingPosition(
  holding: Holding,
  data: HoldingData,
  asOf: string,
): HoldingPosition {
  const rows = holdingContributions(holding.id, data.contributions).filter(
    (row) => row.date <= asOf,
  );
  const { invested, entries } = withdrawalLedger(holding, data, asOf);
  const current = holdingValue(holding, data, asOf);
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
  for (const row of entries) flows.push({ date: row.date, amount: row.amount });
  const payouts = receivedPayouts(holding.id, data.payouts).filter((row) => row.date <= asOf);
  for (const row of payouts) flows.push({ date: row.date, amount: row.amount });
  const paidOut = roundMoney(payouts.reduce((sum, row) => sum + row.amount, 0));
  flows.push({ date: asOf, amount: current });

  return {
    invested,
    current,
    booked: roundMoney(entries.reduce((sum, row) => sum + row.profit, 0)),
    eps,
    paidOut,
    gain: current + paidOut - invested,
    absolute: absoluteReturn(invested, current + paidOut),
    cagr: cagr(invested, current + paidOut, holding.date, asOf),
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

/** Payouts received by one holding, skipped ones left out, oldest first. */
export const receivedPayouts = (holdingId: string, payouts: Payout[] = []) =>
  rowsOfHolding(holdingId, payouts)
    .filter((row) => !row.skipped)
    .sort((a, b) => a.date.localeCompare(b.date));

export const PAYOUT_MONTHS: Record<PayoutEvery, number> = {
  month: 1,
  quarter: 3,
  'half-year': 6,
  year: 12,
};

/** One payout's interest on `value` at `rate`% a year, as a suggestion for the form. */
export const suggestedPayout = (value: number, rate: number, every: PayoutEvery) =>
  Math.round((value * rate) / 100 / (12 / PAYOUT_MONTHS[every]));

/**
 * Scheduled payouts due by `today` that have no record yet, oldest first. IDs are fixed per
 * holding and payout month, so a payout is never asked for twice.
 */
export function duePayouts(holdings: Holding[], payouts: Payout[], today: string): Payout[] {
  const recorded = new Set(payouts.map((row) => row.id));
  const due: Payout[] = [];
  for (const holding of holdings) {
    const plan = holding.payout;
    if (!plan) continue;
    const anchor = Number(plan.start.slice(-2));
    const step = PAYOUT_MONTHS[plan.every];
    for (let index = 0; index * step < MAX_SCHEDULED_MONTHS; index++) {
      const date = addMonths(plan.start, index * step, anchor);
      if (date > today) break;
      const id = payoutId(holding.id, date);
      if (date < holding.date || recorded.has(id)) continue;
      due.push({ id, holdingId: holding.id, date, amount: plan.amount });
    }
  }
  return due.sort((a, b) => a.date.localeCompare(b.date));
}

export const payoutId = (holdingId: string, date: string) =>
  `payout_${holdingId}_${date.slice(0, 7).replace('-', '')}`;

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
    for (const row of holdingWithdrawals(holding.id, data.withdrawals)) {
      if (row.date <= asOf) flows.push({ date: row.date, amount: row.amount });
    }
    for (const row of receivedPayouts(holding.id, data.payouts)) {
      if (row.date <= asOf) flows.push({ date: row.date, amount: row.amount });
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

export interface ValuePoint {
  month: string;
  value: number;
  invested: number;
}

/**
 * Month-end value and invested amount for a set of holdings, from the month the first one
 * started up to today, at most `limit` months. The current month is valued on `today`.
 */
export function valueHistory(
  holdings: Holding[],
  data: HoldingData,
  today: string,
  limit = 600,
): ValuePoint[] {
  const first = holdings.map((row) => row.date.slice(0, 7)).sort()[0];
  const current = today.slice(0, 7);
  if (!first || first > current) return [];
  const months = [current];
  while (months.length < limit && (months[0] ?? current) > first) {
    months.unshift(previousMonth(months[0] ?? current));
  }
  return months.map((month) => {
    const date = month === current ? today : lastDayOfMonth(month);
    const active = holdings.filter((row) => row.date <= date);
    return {
      month,
      value: roundMoney(active.reduce((sum, row) => sum + holdingValue(row, data, date), 0)),
      invested: roundMoney(
        active.reduce((sum, row) => sum + withdrawalLedger(row, data, date).invested, 0),
      ),
    };
  });
}
