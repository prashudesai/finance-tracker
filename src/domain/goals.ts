import type { TrackerData } from '../data/repository';
import type { Goal, GoalKind, Holding } from '../schema/records';
import { addMonths, previousMonth, roundMoney } from './calendar';
import { netWorth } from './analytics';
import { holdingValue } from './holdings';
import { summarizeLoans } from './summary';

/** Sensible starting points for each kind of goal. Every figure can be changed. */
export const GOAL_DEFAULTS: Record<GoalKind, { label: string; inflation: number; years: number }> =
  {
    education: { label: "Child's education", inflation: 10, years: 10 },
    house: { label: 'House down payment', inflation: 7, years: 5 },
    retirement: { label: 'Retirement', inflation: 6, years: 20 },
    wedding: { label: 'Wedding', inflation: 7, years: 8 },
    car: { label: 'Car', inflation: 5, years: 3 },
    emergency: { label: 'Emergency fund', inflation: 6, years: 1 },
    vacation: { label: 'Vacation', inflation: 6, years: 1 },
    portfolio: { label: 'Portfolio target', inflation: 0, years: 5 },
    custom: { label: 'Something else', inflation: 6, years: 5 },
  };

/** A whole portfolio's yearly return when none is chosen: a mix of market and fixed. */
export const PORTFOLIO_RETURN = 8;

/** Longest look ahead for when a goal is reached: 50 years. */
const MAX_MONTHS = 600;
/** Within this share of the target counts as close, not behind. */
const CLOSE_SHARE = 0.9;
export const MILESTONES = [25, 50, 75, 100] as const;

/** Whole calendar months from one date to another, never negative. */
export function monthsUntil(today: string, date: string) {
  const index = (value: string) => Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7));
  return Math.max(0, index(date) - index(today));
}

/** A cautious yearly return for the time left: shorter goals sit in safer places. */
export function defaultReturn(kind: GoalKind, months: number) {
  if (kind === 'emergency') return 6;
  if (months < 36) return 7;
  if (months < 84) return 9;
  return 11;
}

/** What a holding is planned to add each month, whether or not it's scheduled. */
export function plannedMonthly(holding: Holding) {
  if (holding.kind !== 'pf') return holding.monthly;
  const split = (holding.employee ?? 0) + (holding.employer ?? 0);
  return split > 0 ? split - (holding.epsMonthly ?? 0) : holding.monthly;
}

const monthlyRate = (yearly: number) => Math.pow(1 + yearly / 100, 1 / 12) - 1;

/** Growth of a lump sum and a monthly amount, each added at the end of its month. */
export function projectSavings(
  saved: number,
  monthly: number,
  yearlyReturn: number,
  months: number,
) {
  const rate = monthlyRate(yearlyReturn);
  const growth = Math.pow(1 + rate, months);
  const annuity = rate === 0 ? months : (growth - 1) / rate;
  return saved * growth + monthly * annuity;
}

/** The monthly amount that grows `saved` to `needed` in `months`. */
export function monthlyNeeded(saved: number, needed: number, yearlyReturn: number, months: number) {
  if (months <= 0) return null;
  const rate = monthlyRate(yearlyReturn);
  const growth = Math.pow(1 + rate, months);
  const annuity = rate === 0 ? months : (growth - 1) / rate;
  return Math.max(0, (needed - saved * growth) / annuity);
}

export const futureCost = (target: number, inflation: number, months: number) =>
  target * Math.pow(1 + inflation / 100, months / 12);

export interface GoalPlan {
  months: number;
  saved: number;
  monthly: number;
  expectedReturn: number;
  /** The target grown by inflation to the goal's date. */
  needed: number;
  projected: number;
  /** Extra each month to reach it on time, beyond what's already planned. */
  extraMonthly: number | null;
  /** First month the plan as it stands reaches the goal, or null past 50 years. */
  reachedBy: string | null;
  progress: number;
  status: 'reached' | 'onTrack' | 'close' | 'behind';
}

export interface GoalInputs {
  /** What's set aside today. For a net worth target, everything owned. */
  saved: number;
  monthly: number;
  expectedReturn: number;
  target: number;
  inflation: number;
  /** Months to the goal's date, or null when it has none and the question is when. */
  months: number | null;
  /** Loans owed today, taken off the value, for a net worth target. */
  debts?: number;
  /** Loan principal repaid each month, which shrinks the debts. */
  principal?: number;
}

/** Where a goal stands, from plain figures, so what-if changes can reuse it. */
export function planGoal(inputs: GoalInputs, today: string): GoalPlan {
  const { saved, monthly, expectedReturn, target, inflation, debts = 0, principal = 0 } = inputs;
  const valueAt = (month: number) =>
    projectSavings(saved, monthly, expectedReturn, month) - Math.max(0, debts - principal * month);
  let found: number | null = null;
  for (let month = 0; month <= MAX_MONTHS; month++) {
    if (valueAt(month) >= futureCost(target, inflation, month)) {
      found = month;
      break;
    }
  }
  const reachedBy = found === null ? null : addMonths(`${today.slice(0, 7)}-01`, found).slice(0, 7);
  // Without a date, the plan is measured at the month it gets there.
  const months = inputs.months ?? found ?? 0;
  const needed = futureCost(target, inflation, months);
  const projected = valueAt(months);
  const current = saved - debts;
  const required =
    inputs.months === null
      ? found === null
        ? null
        : monthly
      : monthlyNeeded(
          saved - Math.max(0, debts - principal * months),
          needed,
          expectedReturn,
          months,
        );
  const progress = needed > 0 ? current / needed : 1;
  const status =
    current >= needed
      ? 'reached'
      : inputs.months === null
        ? found === null
          ? 'behind'
          : 'onTrack'
        : projected >= needed
          ? 'onTrack'
          : months > 0 && projected >= needed * CLOSE_SHARE
            ? 'close'
            : 'behind';
  return {
    months,
    saved: roundMoney(current),
    monthly: roundMoney(monthly),
    expectedReturn,
    needed: roundMoney(needed),
    projected: roundMoney(projected),
    extraMonthly: required === null ? null : roundMoney(Math.max(0, required - monthly)),
    reachedBy,
    progress,
    status,
  };
}

/**
 * Average monthly income, spending and what's left, over recent complete months with
 * records. A month with neither is skipped, so a gap doesn't drag the average down.
 */
export function monthlyAverages(
  data: Pick<TrackerData, 'income' | 'expenses'>,
  today: string,
  span = 6,
) {
  let month = today.slice(0, 7);
  let income = 0;
  let expenses = 0;
  let months = 0;
  for (let step = 0; step < span; step++) {
    month = previousMonth(month);
    const key = month;
    const earned = data.income
      .filter((row) => row.date.startsWith(key))
      .reduce((sum, row) => sum + row.amount, 0);
    const spent = data.expenses
      .filter((row) => row.date.startsWith(key))
      .reduce((sum, row) => sum + row.amount, 0);
    if (earned === 0 && spent === 0) continue;
    income += earned;
    expenses += spent;
    months += 1;
  }
  if (months === 0) return null;
  return {
    income: roundMoney(income / months),
    expenses: roundMoney(expenses / months),
    surplus: roundMoney((income - expenses) / months),
    months,
  };
}

/** Principal repaid each month across loans still owed: each EMI less this month's interest. */
export function monthlyPrincipal(data: TrackerData, today: string) {
  return roundMoney(
    summarizeLoans(data, today).reduce((sum, { ledger }) => {
      if (!ledger || ledger.remaining <= 0) return sum;
      return sum + Math.max(0, ledger.emi - (ledger.remaining * ledger.rate) / 1200);
    }, 0),
  );
}

/** A portfolio target follows the whole portfolio, or net worth, not a share of holdings. */
export function portfolioInputs(goal: Goal, data: TrackerData, today: string) {
  const worth = netWorth(data, today);
  const averages = monthlyAverages(data, today);
  const byNetWorth = (goal.measure ?? 'netWorth') === 'netWorth';
  return {
    assets: worth.assets,
    debts: byNetWorth ? worth.debts : 0,
    principal: byNetWorth ? monthlyPrincipal(data, today) : 0,
    averages,
    monthly: Math.max(0, averages?.surplus ?? 0),
  };
}

/** The value and monthly amount a goal's funding brings, from today's records. */
export function goalFunds(goal: Goal, data: TrackerData, today: string) {
  let saved = 0;
  let monthly = 0;
  for (const { holdingId, share } of goal.funding) {
    const holding = data.holdings.find((row) => row.id === holdingId);
    if (!holding || holding.date > today) continue;
    saved += holdingValue(holding, data, today) * share;
    monthly += plannedMonthly(holding) * share;
  }
  return { saved, monthly };
}

/** The figures a goal's plan starts from, from today's records. */
export function goalInputs(goal: Goal, data: TrackerData, today: string): GoalInputs {
  if (goal.kind === 'portfolio') {
    const funds = portfolioInputs(goal, data, today);
    return {
      saved: funds.assets,
      monthly: funds.monthly,
      expectedReturn: goal.expectedReturn ?? PORTFOLIO_RETURN,
      target: goal.target,
      inflation: goal.inflation,
      months: goal.targetDate ? monthsUntil(today, goal.targetDate) : null,
      debts: funds.debts,
      principal: funds.principal,
    };
  }
  const months = monthsUntil(today, goal.targetDate ?? today);
  return {
    ...goalFunds(goal, data, today),
    expectedReturn: goal.expectedReturn ?? defaultReturn(goal.kind, months),
    target: goal.target,
    inflation: goal.inflation,
    months,
  };
}

export const goalPlan = (goal: Goal, data: TrackerData, today: string): GoalPlan =>
  planGoal(goalInputs(goal, data, today), today);

/** The date a goal is due, or for an open-ended one, when it's expected. */
export const goalDate = (goal: Goal, plan: GoalPlan) =>
  goal.targetDate ?? (plan.reachedBy ? `${plan.reachedBy}-01` : null);

/** The highest milestone a goal has passed, or 0. */
export const milestoneOf = (progress: number) =>
  [...MILESTONES].reverse().find((step) => progress * 100 >= step) ?? 0;

/** How much of each holding is already set aside, leaving out one goal being edited. */
export function assignedShares(goals: Goal[], exceptGoalId?: string) {
  const shares = new Map<string, number>();
  for (const goal of goals) {
    if (goal.id === exceptGoalId) continue;
    for (const { holdingId, share } of goal.funding) {
      shares.set(holdingId, (shares.get(holdingId) ?? 0) + share);
    }
  }
  return shares;
}

/** Holdings promised past their whole value across goals. */
export function overAssigned(goals: Goal[]) {
  return [...assignedShares(goals)].filter(([, share]) => share > 1 + 1e-9).map(([id]) => id);
}

/** Investment value not yet set aside for any goal. */
export function unassignedValue(data: TrackerData, today: string) {
  const shares = assignedShares(data.goals);
  return roundMoney(
    data.holdings
      .filter((holding) => holding.date <= today)
      .reduce(
        (sum, holding) =>
          sum + holdingValue(holding, data, today) * Math.max(0, 1 - (shares.get(holding.id) ?? 0)),
        0,
      ),
  );
}

/** Six months of spending, from the average of recent complete months with records. */
export function emergencyTarget(data: Pick<TrackerData, 'expenses'>, today: string, cover = 6) {
  let month = today.slice(0, 7);
  const totals: number[] = [];
  for (let step = 0; step < 6; step++) {
    month = previousMonth(month);
    const key = month;
    const total = data.expenses
      .filter((row) => row.date.startsWith(key))
      .reduce((sum, row) => sum + row.amount, 0);
    if (total > 0) totals.push(total);
  }
  if (totals.length === 0) return null;
  const average = totals.reduce((sum, value) => sum + value, 0) / totals.length;
  return {
    average: roundMoney(average),
    months: totals.length,
    target: roundMoney(average * cover),
  };
}

/**
 * What retirement needs in today's rupees: a monthly spend paid for `years` after retiring,
 * at the start of each year, with savings earning `growth` while prices rise by `inflation`.
 */
export function retirementTarget(
  monthlyExpenses: number,
  { years = 25, growth = 7, inflation = 6 } = {},
) {
  const real = (1 + growth / 100) / (1 + inflation / 100) - 1;
  const yearly = monthlyExpenses * 12;
  const factor = real === 0 ? years : ((1 - Math.pow(1 + real, -years)) / real) * (1 + real);
  return roundMoney(yearly * factor);
}

/** Retirement accounts not already fully set aside, offered for a retirement goal. */
export function retirementFunding(data: TrackerData, exceptGoalId?: string) {
  const shares = assignedShares(data.goals, exceptGoalId);
  return data.holdings
    .filter((holding) => holding.kind !== 'investment')
    .map((holding) => ({
      holdingId: holding.id,
      share: roundMoney(Math.max(0, 1 - (shares.get(holding.id) ?? 0)) * 100) / 100,
    }))
    .filter((row) => row.share > 0);
}

/** Each goal's milestone today, by id. */
export const goalMilestones = (data: TrackerData, today: string) =>
  new Map(data.goals.map((goal) => [goal.id, milestoneOf(goalPlan(goal, data, today).progress)]));

/** Goals that passed a new milestone since `before`. A goal new since then doesn't count. */
export function passedMilestones(before: Map<string, number>, now: Map<string, number>) {
  return [...now]
    .filter(([id, step]) => before.has(id) && step > (before.get(id) ?? 0))
    .map(([id, step]) => ({ id, step }));
}
