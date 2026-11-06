import type { TrackerData } from '../data/repository';
import type { Expense } from '../schema/records';
import {
  isEmi,
  isMarket,
  monthlyOverview,
  netWorthHistory,
  pmsGainChange,
  trackingStart,
} from './analytics';
import {
  addDays,
  addMonths,
  daysInMonth,
  financialYearRange,
  financialYearStart,
  previousMonth,
  roundMoney,
  toDayNumber,
} from './calendar';
import { monthTotals } from './cashflow';
import {
  goalInputs,
  goalPlan,
  monthlyAverages,
  monthsUntil,
  planGoal,
  portfolioInputs,
} from './goals';
import { holdingValue, latestValuation } from './holdings';
import {
  incomeByMember,
  incomeBySource,
  incomeSteadiness,
  salaryHistory,
  whereIncomeGoes,
  yearOnYear,
} from './income';
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
        kind: 'incomeMix';
        salaryShare: number;
        salary: number;
        other: number;
        months: number;
        topOther: string | null;
      }
    | { kind: 'salaryRaise'; month: string; from: number; to: number; change: number }
    | {
        kind: 'incomeYoY';
        change: number;
        thisYear: number;
        lastYear: number;
        from: string;
        to: string;
      }
    | { kind: 'topEarner'; member: string; share: number; total: number; members: number }
    | {
        kind: 'incomeSteadiness';
        verdict: 'steady' | 'fairly steady' | 'varies a lot';
        spread: number;
        best: number;
        worst: number;
        worstMonth: string;
        months: number;
      }
    | {
        kind: 'per100';
        spending: number;
        emis: number;
        invested: number;
        left: number;
        income: number;
      }
    | {
        kind: 'goalEta';
        goalId: string;
        name: string;
        measure: 'netWorth' | 'investments';
        current: number;
        target: number;
        /** Month it's reached at the current pace, or null if it never is. */
        reachedBy: string | null;
        months: number | null;
        income: number;
        expenses: number;
        /** Savings contributions a month on average, as on the dashboard. */
        invested: number;
        /** Left after spending each month, beyond what's invested. */
        leftover: number;
        /** When it's reached if the leftover were invested too, or null. */
        fasterBy: string | null;
        principal: number;
        expectedReturn: number;
        basedOn: number;
        /** The first month with income or spending recorded. */
        since: string;
      }
    | { kind: 'cushion'; balance: number; monthly: number; months: number; asOf: string }
    | {
        kind: 'subscriptions';
        count: number;
        yearly: number;
        monthly: number;
        biggest: string;
        biggestYearly: number;
      }
    | { kind: 'staleValues'; count: number; oldest: string; names: string[] }
    | {
        kind: 'savingsRange';
        best: { month: string; rate: number };
        worst: { month: string; rate: number };
        months: number;
      }
    | {
        kind: 'memberSpend';
        month: string;
        total: number;
        rows: { member: string; amount: number }[];
      }
    | {
        kind: 'ppfRoom';
        room: number;
        contributed: number;
        accounts: number;
        monthsLeft: number;
        perMonth: number;
      }
    | { kind: 'streak'; months: number; since: string; threshold: number; latest: number }
    | { kind: 'debtFree'; date: string; months: number; loans: number; remaining: number }
    | { kind: 'dailyPace'; perDay: number; before: number; change: number; days: number }
    | { kind: 'noSpendDays'; month: string; days: number; ofDays: number }
    | {
        kind: 'leftoverToRetirement';
        perMonth: number;
        months: number;
        value: number;
        retireDate: string;
        growth: number;
      }
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

const STREAK_RATE = 0.3;
const STALE_DAYS = 45;
const PPF_LIMIT = 1_50_000;
const PACE_WINDOW = 30;
const PACE_CHANGE = 0.1;
const NO_SPEND_MIN = 4;
const LEFTOVER_GROWTH = 10;

/** How many months of usual spending the latest bank balance would cover. */
function cushion(data: TrackerData, today: string): Insight | null {
  const latest = [...data.monthlyBalances]
    .filter((row) => row.month <= today.slice(0, 7))
    .sort((a, b) => b.month.localeCompare(a.month))[0];
  const monthly = monthlyAverages(data, today)?.expenses ?? 0;
  if (!latest || latest.startBalance <= 0 || monthly <= 0) return null;
  const months = latest.startBalance / monthly;
  const tone: InsightTone = months < 1 ? 'watch' : months > 12 ? 'neutral' : 'good';
  return {
    id: `cushion-${latest.month}`,
    kind: 'cushion',
    tone,
    score: months < 1 ? 58 : months > 12 ? 44 : 28,
    balance: latest.startBalance,
    monthly: roundMoney(monthly),
    months,
    asOf: latest.month,
  };
}

/** Regular payments set up as schedules, other than EMIs, over a whole year. */
function subscriptions(data: TrackerData, today: string): Insight | null {
  const month = today.slice(0, 7);
  const rows = data.recurringRules.flatMap((rule) => {
    if (rule.kind !== 'expense' || rule.paused || rule.archived) return [];
    if (rule.startMonth > month || (rule.endMonth && rule.endMonth < month)) return [];
    const amount = amountAt(rule, month) ?? 0;
    return [
      {
        name: rule.name,
        yearly: rule.isAnnual ? amount : amount * 12,
        monthly: rule.isAnnual ? 0 : amount,
      },
    ];
  });
  if (rows.length < 2) return null;
  const biggest = [...rows].sort((a, b) => b.yearly - a.yearly)[0];
  if (!biggest) return null;
  return {
    id: `subscriptions-${month}`,
    kind: 'subscriptions',
    tone: 'neutral',
    score: 26,
    count: rows.length,
    yearly: roundMoney(rows.reduce((total, row) => total + row.yearly, 0)),
    monthly: roundMoney(rows.reduce((total, row) => total + row.monthly, 0)),
    biggest: biggest.name,
    biggestYearly: roundMoney(biggest.yearly),
  };
}

/** Market investments whose value hasn't been updated for a while. */
function staleValues(data: TrackerData, today: string): Insight | null {
  const cutoff = addDays(today, -STALE_DAYS);
  const stale = data.holdings
    .filter((holding) => holding.date <= cutoff && isMarket(holding, data.settings[0]))
    .map((holding) => ({
      name: holding.name,
      date: latestValuation(holding.id, data.valuations, today)?.date ?? holding.date,
    }))
    .filter(({ date }) => date < cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
  const oldest = stale[0];
  if (!oldest) return null;
  return {
    id: `stale-${today.slice(0, 7)}`,
    kind: 'staleValues',
    tone: 'watch',
    score: 46,
    count: stale.length,
    oldest: oldest.date,
    names: stale.slice(0, 3).map((row) => row.name),
  };
}

const complete = (data: TrackerData, today: string) => {
  const current = today.slice(0, 7);
  const since = trackingStart(data);
  return [...monthTotals(data)]
    .filter(([month, totals]) => month < current && (!since || month >= since) && totals.income > 0)
    .sort(([a], [b]) => a.localeCompare(b));
};

/** This financial year's best and worst months for keeping income. */
function savingsRange(data: TrackerData, today: string): Insight | null {
  const fy = financialYearStart(today);
  const months = complete(data, today)
    .filter(([month]) => financialYearStart(month) === fy)
    .map(([month, totals]) => ({ month, rate: savingsRate(totals) ?? 0 }));
  if (months.length < 3) return null;
  const ordered = [...months].sort((a, b) => b.rate - a.rate);
  const best = ordered[0];
  const worst = ordered.at(-1);
  if (!best || !worst || best.rate - worst.rate < 0.05) return null;
  return {
    id: `savingsRange-${fy}-${months.length}`,
    kind: 'savingsRange',
    tone: 'neutral',
    score: 22,
    best,
    worst,
    months: months.length,
  };
}

/** Last month's spending by family member, where expenses name one. */
function memberSpend(data: TrackerData, month: string): Insight | null {
  const rows = data.expenses.filter((row) => within(row.date, month));
  if (!rows.some((row) => row.member)) return null;
  const byMember = new Map<string, number>();
  for (const row of rows) {
    const who = row.member || 'Household';
    byMember.set(who, (byMember.get(who) ?? 0) + row.amount);
  }
  if (byMember.size < 2) return null;
  return {
    id: `members-${month}`,
    kind: 'memberSpend',
    tone: 'neutral',
    score: 20,
    month,
    total: roundMoney(sum(rows)),
    rows: [...byMember]
      .map(([member, amount]) => ({ member, amount: roundMoney(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4),
  };
}

/** PPF room left this financial year, ₹1.5 lakh an account, more pressing near March. */
function ppfRoom(data: TrackerData, today: string): Insight | null {
  const ppf = data.holdings.filter((holding) => holding.kind === 'ppf');
  if (ppf.length === 0) return null;
  const { start, end } = financialYearRange(financialYearStart(today));
  let room = 0;
  let contributed = 0;
  for (const holding of ppf) {
    const paid = sum(
      data.contributions.filter(
        (row) =>
          !row.skipped && row.holdingId === holding.id && row.date >= start && row.date <= end,
      ),
    );
    contributed += paid;
    room += Math.max(0, PPF_LIMIT - paid);
  }
  if (room < 1_000) return null;
  const monthsLeft = Math.max(1, monthsUntil(today, end) + 1);
  return {
    id: `ppf-${start}`,
    kind: 'ppfRoom',
    tone: 'neutral',
    score: monthsLeft <= 3 ? 56 : 24,
    room: roundMoney(room),
    contributed: roundMoney(contributed),
    accounts: ppf.length,
    monthsLeft,
    perMonth: roundMoney(room / monthsLeft),
  };
}

/** Complete months in a row keeping at least 30% of income, back from last month. */
function streak(data: TrackerData, today: string): Insight | null {
  const months = complete(data, today).reverse();
  let count = 0;
  for (const [, totals] of months) {
    if ((savingsRate(totals) ?? 0) < STREAK_RATE) break;
    count += 1;
  }
  const since = months[count - 1]?.[0];
  const latest = months[0]?.[1];
  if (count < 3 || !since || !latest) return null;
  return {
    id: `streak-${count}`,
    kind: 'streak',
    tone: 'good',
    score: 38,
    months: count,
    since,
    threshold: STREAK_RATE,
    latest: savingsRate(latest) ?? 0,
  };
}

/** When the last loan is paid off at today's EMIs. */
function debtFree(data: TrackerData, today: string): Insight | null {
  const open = summarizeLoans(data, today).filter((loan) => (loan.ledger?.remaining ?? 0) > 0);
  if (open.length === 0) return null;
  let months = 0;
  for (const { ledger } of open) {
    if (!ledger) return null;
    const count = estimateSchedule(ledger.remaining, ledger.emi, ledger.rate).count;
    if (count === null) return null;
    months = Math.max(months, count);
  }
  return {
    id: `debtFree-${today.slice(0, 7)}`,
    kind: 'debtFree',
    tone: 'good',
    score: 24,
    date: addMonths(`${today.slice(0, 7)}-01`, months),
    months,
    loans: open.length,
    remaining: roundMoney(open.reduce((total, loan) => total + (loan.ledger?.remaining ?? 0), 0)),
  };
}

/** Everyday spending a day over the last 30 days, against the 30 before. */
function dailyPace(data: TrackerData, today: string): Insight | null {
  const since = trackingStart(data);
  const start = addDays(today, -PACE_WINDOW * 2 + 1);
  if (!since || `${since}-01` > start) return null;
  const middle = addDays(today, -PACE_WINDOW);
  const recent = data.expenses.filter(
    (row) => everyday(row) && row.date > middle && row.date <= today,
  );
  const before = data.expenses.filter(
    (row) => everyday(row) && row.date >= start && row.date <= middle,
  );
  const perDay = sum(recent) / PACE_WINDOW;
  const earlier = sum(before) / PACE_WINDOW;
  if (perDay <= 0 || earlier <= 0) return null;
  const change = perDay / earlier - 1;
  if (Math.abs(change) < PACE_CHANGE) return null;
  return {
    id: `pace-${today}`,
    kind: 'dailyPace',
    tone: change > 0 ? 'watch' : 'good',
    score: change > 0 ? 42 : 36,
    perDay: roundMoney(perDay),
    before: roundMoney(earlier),
    change,
    days: PACE_WINDOW,
  };
}

/** Days last month with no everyday spending, once that month was being recorded. */
function noSpendDays(data: TrackerData, month: string): Insight | null {
  const rows = data.expenses.filter((row) => within(row.date, month) && everyday(row));
  if (rows.length < 10) return null;
  const spent = new Set(rows.map((row) => row.date));
  const ofDays = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  const days = ofDays - spent.size;
  if (days < NO_SPEND_MIN) return null;
  return {
    id: `noSpend-${month}`,
    kind: 'noSpendDays',
    tone: 'good',
    score: 14,
    month,
    days,
    ofDays,
  };
}

/** What the money left in the bank each month would grow to by retirement, invested. */
function leftoverToRetirement(data: TrackerData, today: string): Insight | null {
  const retireDate = data.settings[0]?.retirement?.retireDate;
  if (!retireDate || retireDate <= today) return null;
  const goes = whereIncomeGoes(data, financialYearStart(today), today);
  if (goes.months < 2) return null;
  const perMonth = goes.left / goes.months;
  if (perMonth < 1_000) return null;
  const months = monthsUntil(today, retireDate);
  const rate = Math.pow(1 + LEFTOVER_GROWTH / 100, 1 / 12) - 1;
  const value = perMonth * ((Math.pow(1 + rate, months) - 1) / rate);
  return {
    id: `leftover-${today.slice(0, 7)}`,
    kind: 'leftoverToRetirement',
    tone: 'neutral',
    score: 31,
    perMonth: roundMoney(perMonth),
    months,
    value: roundMoney(value),
    retireDate,
    growth: LEFTOVER_GROWTH,
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
    .filter(
      ({ goal, plan }) =>
        goal.targetDate !== undefined &&
        plan.status === 'behind' &&
        plan.extraMonthly !== null &&
        plan.needed > 0,
    )
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
    date: behind.goal.targetDate ?? today,
  };
}

/** When a portfolio target is reached at today's pace: saving each month, plus growth. */
function goalEta(data: TrackerData, today: string): Insight | null {
  const goal = data.goals.find((row) => row.kind === 'portfolio');
  if (!goal) return null;
  const plan = goalPlan(goal, data, today);
  const funds = portfolioInputs(goal, data, today);
  if (plan.status === 'reached' || !funds.averages) return null;
  return {
    id: `goalEta-${goal.id}`,
    kind: 'goalEta',
    tone: plan.reachedBy ? 'good' : 'watch',
    score: 76,
    goalId: goal.id,
    name: goal.name,
    measure: goal.measure ?? 'netWorth',
    current: plan.saved,
    target: goal.target,
    reachedBy: plan.reachedBy,
    months: plan.reachedBy ? monthsUntil(today, `${plan.reachedBy}-01`) : null,
    income: funds.averages.income,
    expenses: funds.averages.expenses,
    invested: funds.monthly,
    leftover: funds.uninvested,
    fasterBy:
      funds.uninvested > 0
        ? planGoal(
            { ...goalInputs(goal, data, today), monthly: funds.monthly + funds.uninvested },
            today,
          ).reachedBy
        : null,
    principal: funds.principal,
    expectedReturn: plan.expectedReturn,
    basedOn: funds.averages.months,
    since: funds.since ?? funds.averages.since,
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

const salarySources = (data: TrackerData) => data.settings[0]?.salarySources;

/** How much of income is salary, and what else brings money in. */
function incomeMix(data: TrackerData, today: string): Insight | null {
  const found = incomeBySource(data, financialYearStart(today), today, salarySources(data));
  if (found.months < 2 || found.total <= 0 || found.other.total <= 0) return null;
  return {
    id: 'incomeMix',
    kind: 'incomeMix',
    tone: 'neutral',
    score: 52,
    salaryShare: found.salaryShare,
    salary: found.salary.monthly,
    other: found.other.monthly,
    months: found.months,
    topOther: found.sources.find((row) => !row.salary)?.source ?? null,
  };
}

/** A raise in the last six months. */
function salaryRaise(data: TrackerData, today: string): Insight | null {
  const raise = salaryHistory(data, today, salarySources(data)).raises.at(-1);
  if (!raise) return null;
  let cutoff = today.slice(0, 7);
  for (let step = 0; step < 6; step++) cutoff = previousMonth(cutoff);
  if (raise.month < cutoff) return null;
  return {
    id: `salaryRaise-${raise.month}`,
    kind: 'salaryRaise',
    tone: 'good',
    score: 80,
    ...raise,
  };
}

/** This year's income against the same months last year, when it moved by 3% or more. */
function incomeYoY(data: TrackerData, today: string): Insight | null {
  const found = yearOnYear(data, financialYearStart(today), today);
  if (found.change === null || Math.abs(found.change) < 0.03 || !found.from || !found.to) {
    return null;
  }
  return {
    id: 'incomeYoY',
    kind: 'incomeYoY',
    tone: found.change > 0 ? 'good' : 'watch',
    score: 64,
    change: found.change,
    thisYear: found.thisYear,
    lastYear: found.lastYear,
    from: found.from,
    to: found.to,
  };
}

/** With two or more earners, who brings in most. */
function topEarner(data: TrackerData, today: string): Insight | null {
  const members = incomeByMember(data, financialYearStart(today), today, salarySources(data));
  const top = members[0];
  if (members.length < 2 || !top || !top.member) return null;
  return {
    id: 'topEarner',
    kind: 'topEarner',
    tone: 'neutral',
    score: 38,
    member: top.member,
    share: top.share,
    total: top.total,
    members: members.length,
  };
}

/** Income that swings from month to month makes planning harder. */
function steadiness(data: TrackerData, today: string): Insight | null {
  const found = incomeSteadiness(data, today);
  if (!found || !found.best || !found.worst) return null;
  return {
    id: 'incomeSteadiness',
    kind: 'incomeSteadiness',
    tone: found.verdict === 'varies a lot' ? 'watch' : 'neutral',
    score: found.verdict === 'varies a lot' ? 66 : 30,
    verdict: found.verdict,
    spread: found.spread,
    best: found.best.amount,
    worst: found.worst.amount,
    worstMonth: found.worst.month,
    months: found.months,
  };
}

/** Where each ₹100 earned this year went. */
function per100(data: TrackerData, today: string): Insight | null {
  const found = whereIncomeGoes(data, financialYearStart(today), today);
  if (found.months < 2 || found.income <= 0) return null;
  return {
    id: 'per100',
    kind: 'per100',
    tone: found.per100.left > 25 ? 'watch' : 'neutral',
    score: found.per100.left > 25 ? 58 : 44,
    spending: found.per100.spending,
    emis: found.per100.emis,
    invested: found.per100.invested,
    left: found.per100.left,
    income: found.income,
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
    goalEta(data, today),
    incomeMix(data, today),
    salaryRaise(data, today),
    incomeYoY(data, today),
    topEarner(data, today),
    steadiness(data, today),
    per100(data, today),
    ...monthSoFar(data, today),
    cushion(data, today),
    subscriptions(data, today),
    staleValues(data, today),
    savingsRange(data, today),
    memberSpend(data, lastMonth),
    ppfRoom(data, today),
    streak(data, today),
    debtFree(data, today),
    dailyPace(data, today),
    noSpendDays(data, lastMonth),
    leftoverToRetirement(data, today),
  ]
    .filter((insight): insight is Insight => insight !== null)
    .sort((a, b) => b.score - a.score);
}

/** How many insights each day brings. */
export const DAILY_INSIGHTS = 10;

/** A number from 0 to 1 that's always the same for the same text, so a day's mix holds. */
function dayHash(text: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash + 0.5) / 2 ** 32;
}

/**
 * Today's insights: anything that needs acting on first, then a draw from the rest that
 * favours the more useful ones but gives every one its turn. The same all day, on every
 * device, and different tomorrow.
 */
export function dailyInsights(all: Insight[], today: string, count = DAILY_INSIGHTS) {
  const urgent = all.filter((insight) => insight.tone === 'watch' && insight.score >= 60);
  const first = urgent.slice(0, count);
  const drawn = all
    .filter((insight) => !first.includes(insight))
    // Weighted sampling: the smallest keys win, and a higher score makes a smaller key likelier.
    .map((insight) => ({
      insight,
      key: -Math.log(dayHash(`${today}|${insight.id}`)) / (insight.score + 10),
    }))
    .sort((a, b) => a.key - b.key)
    .slice(0, count - first.length)
    .map(({ insight }) => insight)
    .sort((a, b) => b.score - a.score);
  return [...first, ...drawn];
}
