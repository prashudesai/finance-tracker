import type { TrackerData } from '../data/repository';
import type { Expense } from '../schema/records';
import { isEmi, isMarket, monthlyOverview, netWorthHistory, pmsGainChange } from './analytics';
import { addDays, financialYearStart, previousMonth, roundMoney, toDayNumber } from './calendar';
import { monthTotals } from './cashflow';
import { goalPlan } from './goals';
import { holdingValue } from './holdings';
import { estimateSchedule } from './loan';
import { amountAt, upcomingCommitments } from './recurring';
import { summarizeLoans } from './summary';

/**
 * Patterns worth telling someone about, worked out from their records alone. Nothing here
 * leaves the device, and every figure can be traced back to records (see each insight's
 * fields). Wording lives with the screen, so amounts follow "hide amounts".
 */

export type InsightTone = 'good' | 'neutral' | 'watch';

interface Base {
  id: string;
  tone: InsightTone;
  /** Higher shows first. */
  score: number;
}

export type Insight = Base &
  (
    | { kind: 'milestone'; milestone: number; netWorth: number }
    | { kind: 'quiet'; days: number; lastDate: string }
    | { kind: 'dueSoon'; name: string; amount: number; date: string }
    | { kind: 'category'; category: string; month: string; amount: number; usual: number }
    | {
        kind: 'savings';
        month: string;
        rate: number;
        income: number;
        expenses: number;
        averageRate: number | null;
        best: boolean;
      }
    | { kind: 'emiLoad'; share: number; emi: number; income: number }
    | {
        kind: 'prepay';
        loanId: string;
        loan: string;
        rate: number;
        extra: number;
        interestSaved: number;
        emisSaved: number;
      }
    | { kind: 'netWorthChange'; month: string; change: number; netWorth: number }
    | { kind: 'allocation'; share: number; earlier: number; since: string }
    | { kind: 'commitments'; total: number; count: number; emis: number }
    | { kind: 'invested'; month: string; amount: number }
    | { kind: 'principal'; month: string; amount: number }
    | { kind: 'pmsGain'; month: string; change: number }
    | { kind: 'weekend'; share: number; spent: number; days: number }
    | {
        kind: 'goalBehind';
        goalId: string;
        name: string;
        extra: number;
        needed: number;
        projected: number;
        date: string;
      }
    | { kind: 'goalReached'; goalId: string; name: string; saved: number; needed: number }
    | {
        kind: 'biggest';
        month: string;
        category: string;
        amount: number;
        date: string;
        note: string;
      }
  );

const MILESTONES = [
  1_00_000, 5_00_000, 10_00_000, 25_00_000, 50_00_000, 75_00_000, 1_00_00_000, 2_00_00_000,
  5_00_00_000, 10_00_00_000,
];
const QUIET_DAYS = 7;
const CATEGORY_CHANGE = 0.25;
const CATEGORY_MIN_DIFF = 1_000;
const ALLOCATION_SHIFT = 0.05;
const WEEKEND_SHARE = 0.4;
const WEEKEND_WINDOW = 90;
const WEEKEND_MIN_ROWS = 10;
const PREPAY = 1_00_000;
const PMS_MIN_CHANGE = 1_000;

const sum = (rows: { amount: number }[]) => rows.reduce((total, row) => total + row.amount, 0);
const within = (date: string, month: string) => date.startsWith(month);

/** Everyday spending: not EMIs, not yearly bills, not scheduled payments. */
const everyday = (row: Expense) => !isEmi(row) && !row.isAnnual && !row.recurringRuleId;

/** 0 is Sunday. 1 January 1970 was a Thursday. */
const weekday = (date: string) => (((toDayNumber(date) + 4) % 7) + 7) % 7;

function milestone(data: TrackerData, today: string): Insight | null {
  const history = netWorthHistory(data, today, 2);
  const [before, now] = history;
  if (!before || !now) return null;
  const crossed = [...MILESTONES]
    .reverse()
    .find((mark) => before.netWorth < mark && now.netWorth >= mark);
  if (!crossed) return null;
  return {
    id: `milestone-${crossed}`,
    kind: 'milestone',
    tone: 'good',
    score: 100,
    milestone: crossed,
    netWorth: now.netWorth,
  };
}

function quiet(data: TrackerData, today: string): Insight | null {
  const last = [...data.income, ...data.expenses]
    .map((row) => row.date)
    .filter((date) => date <= today)
    .sort()
    .at(-1);
  if (!last) return null;
  const days = toDayNumber(today) - toDayNumber(last);
  if (days < QUIET_DAYS) return null;
  return { id: 'quiet', kind: 'quiet', tone: 'watch', score: 80, days, lastDate: last };
}

function dueSoon(data: TrackerData, today: string): Insight | null {
  const next = upcomingCommitments(
    {
      rules: data.recurringRules,
      occurrences: data.recurringOccurrences,
      income: data.income,
      expenses: data.expenses,
      loans: data.loans,
    },
    today,
    addDays(today, 7),
  )
    .filter((row) => row.kind !== 'income')
    .sort((a, b) => b.amount - a.amount)[0];
  if (!next) return null;
  return {
    id: `due-${next.ruleId}-${next.date}`,
    kind: 'dueSoon',
    tone: 'neutral',
    score: 70,
    name: next.name,
    amount: next.amount,
    date: next.date,
  };
}

/** The three months before `month` that have any spending at all. */
function priorMonths(data: TrackerData, month: string) {
  const months = new Set(data.expenses.map((row) => row.date.slice(0, 7)));
  const found: string[] = [];
  for (let at = previousMonth(month), tries = 0; found.length < 3 && tries < 12; tries++) {
    if (months.has(at)) found.push(at);
    at = previousMonth(at);
  }
  return found;
}

function category(data: TrackerData, month: string): Insight | null {
  const prior = priorMonths(data, month);
  if (prior.length < 2) return null;
  const totals = (key: string) => {
    const byCategory = new Map<string, number>();
    for (const row of data.expenses) {
      if (within(row.date, key) && everyday(row)) {
        byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount);
      }
    }
    return byCategory;
  };
  const now = totals(month);
  const before = prior.map(totals);
  const candidates = [...new Set([...now.keys(), ...before.flatMap((map) => [...map.keys()])])]
    .map((name) => {
      const amount = now.get(name) ?? 0;
      const usual = before.reduce((total, map) => total + (map.get(name) ?? 0), 0) / prior.length;
      return { name, amount, usual, diff: amount - usual };
    })
    .filter(
      ({ usual, diff }) =>
        usual > 0 &&
        Math.abs(diff) >= CATEGORY_MIN_DIFF &&
        Math.abs(diff) / usual >= CATEGORY_CHANGE,
    )
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
  const top = candidates[0];
  if (!top) return null;
  const up = top.diff > 0;
  return {
    id: `category-${month}-${top.name}`,
    kind: 'category',
    tone: up ? 'watch' : 'good',
    score: up ? 65 : 50,
    category: top.name,
    month,
    amount: roundMoney(top.amount),
    usual: roundMoney(top.usual),
  };
}

const savingsRate = ({ income, expenses }: { income: number; expenses: number }) =>
  income > 0 ? (income - expenses) / income : null;

function savings(data: TrackerData, month: string): Insight | null {
  const totals = monthTotals(data);
  const current = totals.get(month);
  const rate = current ? savingsRate(current) : null;
  if (!current || rate === null) return null;
  const fy = financialYearStart(month);
  const earlier = [...totals]
    .filter(([key]) => key < month && financialYearStart(key) === fy)
    .map(([, value]) => savingsRate(value))
    .filter((value): value is number => value !== null);
  const averageRate = earlier.length ? earlier.reduce((a, b) => a + b, 0) / earlier.length : null;
  const best = earlier.length >= 2 && earlier.every((value) => rate > value);
  const tone: InsightTone = rate < 0 ? 'watch' : rate >= 0.2 || best ? 'good' : 'neutral';
  return {
    id: `savings-${month}`,
    kind: 'savings',
    tone,
    score: best || rate < 0 ? 60 : 40,
    month,
    rate,
    income: current.income,
    expenses: current.expenses,
    averageRate,
    best,
  };
}

/** Average monthly income over the last three complete months that had any. */
function usualIncome(data: TrackerData, today: string) {
  const totals = monthTotals(data);
  const months = [...totals]
    .filter(([key, value]) => key < today.slice(0, 7) && value.income > 0)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 3);
  return months.length
    ? months.reduce((total, [, value]) => total + value.income, 0) / months.length
    : 0;
}

function emiLoad(data: TrackerData, today: string): Insight | null {
  const emi = summarizeLoans(data, today)
    .filter((loan) => (loan.ledger?.remaining ?? 0) > 0)
    .reduce((total, loan) => total + (loan.ledger?.emi ?? 0), 0);
  const income = usualIncome(data, today);
  if (emi <= 0 || income <= 0) return null;
  const share = emi / income;
  const tone: InsightTone = share < 0.3 ? 'good' : share < 0.4 ? 'neutral' : 'watch';
  return {
    id: 'emi-load',
    kind: 'emiLoad',
    tone,
    score: tone === 'watch' ? 55 : 30,
    share,
    emi,
    income,
  };
}

/** Everything paid over a schedule, from what's owed now. */
function totalPaid(balance: number, emi: number, rate: number) {
  const { count, final } = estimateSchedule(balance, emi, rate);
  return count === null ? null : { count, paid: emi * Math.max(0, count - 1) + final };
}

function prepay(data: TrackerData, today: string): Insight | null {
  const loans = summarizeLoans(data, today)
    .map((summary) => ({ summary, loan: data.loans.find((row) => row.id === summary.id) }))
    .filter(
      ({ summary, loan }) =>
        loan && !loan.dailyInterestBasis && summary.ledger && summary.ledger.remaining > 0,
    )
    .sort((a, b) => (b.summary.ledger?.rate ?? 0) - (a.summary.ledger?.rate ?? 0));
  const top = loans[0];
  const ledger = top?.summary.ledger;
  if (!top || !ledger) return null;
  const { remaining, emi, rate } = ledger;
  const extra = remaining >= 2 * PREPAY ? PREPAY : Math.floor(remaining / 2 / 10_000) * 10_000;
  if (extra < 10_000) return null;
  const now = totalPaid(remaining, emi, rate);
  const after = totalPaid(remaining - extra, emi, rate);
  if (!now || !after) return null;
  const interestSaved = roundMoney(now.paid - remaining - (after.paid - (remaining - extra)));
  const emisSaved = now.count - after.count;
  if (interestSaved <= 0 || emisSaved < 1) return null;
  return {
    id: `prepay-${top.summary.id}`,
    kind: 'prepay',
    tone: 'good',
    score: 45,
    loanId: top.summary.id,
    loan: top.summary.type,
    rate,
    extra,
    interestSaved,
    emisSaved,
  };
}

function netWorthChange(data: TrackerData, month: string, today: string): Insight | null {
  const history = netWorthHistory(data, today, 3);
  const index = history.findIndex((point) => point.month === month);
  const point = history[index];
  const before = history[index - 1];
  if (!point || !before) return null;
  const change = roundMoney(point.netWorth - before.netWorth);
  if (change === 0) return null;
  return {
    id: `net-worth-${month}`,
    kind: 'netWorthChange',
    tone: change > 0 ? 'good' : 'watch',
    score: 35,
    month,
    change,
    netWorth: point.netWorth,
  };
}

function marketShare(data: TrackerData, date: string) {
  let market = 0;
  let total = 0;
  for (const holding of data.holdings) {
    if (holding.date > date) continue;
    const value = holdingValue(holding, data, date);
    total += value;
    if (isMarket(holding, data.settings[0])) market += value;
  }
  return total > 0 ? market / total : null;
}

function allocation(data: TrackerData, today: string): Insight | null {
  const since = addDays(today, -182);
  const now = marketShare(data, today);
  const earlier = marketShare(data, since);
  if (now === null || earlier === null || Math.abs(now - earlier) < ALLOCATION_SHIFT) return null;
  return {
    id: 'allocation',
    kind: 'allocation',
    tone: 'neutral',
    score: 30,
    share: now,
    earlier,
    since,
  };
}

function commitments(data: TrackerData, today: string): Insight | null {
  const month = today.slice(0, 7);
  const loans = summarizeLoans(data, today);
  let total = 0;
  let count = 0;
  let emis = 0;
  for (const rule of data.recurringRules) {
    if (rule.paused || rule.startMonth > month || (rule.endMonth && rule.endMonth < month))
      continue;
    if (rule.kind === 'income') continue;
    if (rule.kind === 'emi') {
      const ledger = loans.find((loan) => loan.id === rule.loanId)?.ledger;
      if (!ledger || ledger.remaining <= 0) continue;
      total += ledger.emi;
      emis++;
    } else {
      total += amountAt(rule, month) ?? 0;
    }
    count++;
  }
  if (count < 2) return null;
  return {
    id: 'commitments',
    kind: 'commitments',
    tone: 'neutral',
    score: 25,
    total: roundMoney(total),
    count,
    emis,
  };
}

function weekend(data: TrackerData, today: string): Insight | null {
  const from = addDays(today, -WEEKEND_WINDOW);
  const rows = data.expenses.filter((row) => row.date > from && row.date <= today && everyday(row));
  if (rows.length < WEEKEND_MIN_ROWS) return null;
  const all = sum(rows);
  const spent = sum(rows.filter((row) => [0, 6].includes(weekday(row.date))));
  const share = all > 0 ? spent / all : 0;
  if (share < WEEKEND_SHARE) return null;
  return {
    id: 'weekend',
    kind: 'weekend',
    tone: 'neutral',
    score: 20,
    share,
    spent: roundMoney(spent),
    days: WEEKEND_WINDOW,
  };
}

function biggest(data: TrackerData, month: string): Insight | null {
  const top = data.expenses
    .filter((row) => within(row.date, month) && !isEmi(row))
    .sort((a, b) => b.amount - a.amount)[0];
  if (!top) return null;
  return {
    id: `biggest-${top.id}`,
    kind: 'biggest',
    tone: 'neutral',
    score: 10,
    month,
    category: top.subcategory || top.category,
    amount: top.amount,
    date: top.date,
    note: top.notes ?? '',
  };
}

/** This month so far: what went into investments, and loan principal paid off. */
function monthSoFar(data: TrackerData, today: string): Insight[] {
  const month = today.slice(0, 7);
  const overview = monthlyOverview(data, month, today);
  const found: Insight[] = [];
  if (overview.savings > 0) {
    found.push({
      id: `invested-${month}`,
      kind: 'invested',
      tone: 'good',
      score: 32,
      month,
      amount: roundMoney(overview.savings),
    });
  }
  if (overview.principalRepaid > 0) {
    found.push({
      id: `principal-${month}`,
      kind: 'principal',
      tone: 'good',
      score: 33,
      month,
      amount: roundMoney(overview.principalRepaid),
    });
  }
  return found;
}

/** PMS gain from last month's end to this month's, once both have a valuation. */
function pmsGain(data: TrackerData, today: string): Insight | null {
  const month = today.slice(0, 7);
  const change = pmsGainChange(data, month);
  if (change === null || Math.abs(change) < PMS_MIN_CHANGE) return null;
  return {
    id: `pms-${month}`,
    kind: 'pmsGain',
    tone: change > 0 ? 'good' : 'watch',
    score: 34,
    month,
    change: roundMoney(change),
  };
}

/** The goal furthest behind, with the monthly amount that would put it back on track. */
function goalBehind(data: TrackerData, today: string): Insight | null {
  const behind = data.goals
    .map((goal) => ({ goal, plan: goalPlan(goal, data, today) }))
    .filter(({ plan }) => plan.status === 'behind' && plan.extraMonthly !== null && plan.needed > 0)
    .sort((a, b) => a.plan.projected / a.plan.needed - b.plan.projected / b.plan.needed)[0];
  if (!behind) return null;
  return {
    id: `goalBehind-${behind.goal.id}`,
    kind: 'goalBehind',
    tone: 'watch',
    score: 72,
    goalId: behind.goal.id,
    name: behind.goal.name,
    extra: behind.plan.extraMonthly ?? 0,
    needed: behind.plan.needed,
    projected: behind.plan.projected,
    date: behind.goal.targetDate,
  };
}

function goalReached(data: TrackerData, today: string): Insight | null {
  const reached = data.goals
    .map((goal) => ({ goal, plan: goalPlan(goal, data, today) }))
    .find(({ plan }) => plan.status === 'reached');
  if (!reached) return null;
  return {
    id: `goalReached-${reached.goal.id}`,
    kind: 'goalReached',
    tone: 'good',
    score: 88,
    goalId: reached.goal.id,
    name: reached.goal.name,
    saved: reached.plan.saved,
    needed: reached.plan.needed,
  };
}

/** Every insight that applies today, most useful first. */
export function insights(data: TrackerData, today: string): Insight[] {
  const lastMonth = previousMonth(today.slice(0, 7));
  return [
    milestone(data, today),
    quiet(data, today),
    dueSoon(data, today),
    category(data, lastMonth),
    savings(data, lastMonth),
    emiLoad(data, today),
    prepay(data, today),
    netWorthChange(data, lastMonth, today),
    allocation(data, today),
    commitments(data, today),
    weekend(data, today),
    biggest(data, lastMonth),
    pmsGain(data, today),
    goalBehind(data, today),
    goalReached(data, today),
    ...monthSoFar(data, today),
  ]
    .filter((insight): insight is Insight => insight !== null)
    .sort((a, b) => b.score - a.score);
}
