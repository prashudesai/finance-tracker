import { roundMoney } from './calendar';

/**
 * A retirement plan, year by year: the fund grows with contributions until retirement, then
 * pays the household's expenses, which rise with inflation, while what's left keeps growing.
 * Pure figures in, figures out, so the screen can redraw it on every change.
 */
export interface RetirementInputs {
  /** The fund today, which already holds everything put in up to now. */
  fund: number;
  /** What the household spends a month today. */
  monthlyExpense: number;
  /** Added each month until retirement. */
  monthlyContribution: number;
  /** Yearly rise in the monthly contribution, as a percentage. */
  stepUp: number;
  age: number;
  retireAge: number;
  /** The plan runs to the end of this age. */
  untilAge: number;
  /** Yearly, as percentages. */
  inflation: number;
  growthBefore: number;
  growthAfter: number;
  /** Months from now to the retirement date. Left out, whole years from age to retireAge. */
  monthsToRetire?: number;
  /** Months the plan runs from now. Left out, to the end of untilAge. */
  months?: number;
  /**
   * Months from now to the first stretch boundary, such as the next April for financial
   * years. Later stretches are twelve months. Left out, twelve.
   */
  firstStretch?: number;
}

/** A stretch of the plan: a year, or less at the start, around retiring, or at the end. */
export interface RetirementYear {
  /** Months from now to the start of this stretch. */
  start: number;
  months: number;
  /** Whole years of age at its start. */
  age: number;
  retired: boolean;
  fundStart: number;
  added: number;
  growth: number;
  withdrawn: number;
  fundEnd: number;
  /** What the household spends in it, whether or not the fund pays. */
  expenses: number;
  /** Expenses the fund couldn't pay, once it ran out. */
  unpaid: number;
}

export interface RetirementPlan {
  years: RetirementYear[];
  /** Months from now to retiring. */
  monthsToRetire: number;
  fundAtRetirement: number;
  /** The monthly expense at retirement, after inflation. */
  monthlyAtRetirement: number;
  /** The age in which the fund runs out, or null if it lasts the whole plan. */
  runsOutAt: number | null;
  /** Months from now to the first month the fund can't pay, or null. */
  runsOutMonth: number | null;
  /** What's left at the end of the plan. */
  leftOver: number;
}

const monthlyRate = (yearly: number) => Math.pow(1 + yearly / 100, 1 / 12) - 1;

/**
 * Steps month by month from today, in stretches cut at each year boundary (financial years,
 * when `firstStretch` is the months to the next April) and at the retirement month, so
 * retirement always starts a stretch of its own. Prices and contributions step up once a
 * year, counted from today.
 */
export function planRetirement(inputs: RetirementInputs): RetirementPlan {
  const { age, inflation, stepUp } = inputs;
  const retireAt = Math.max(0, inputs.monthsToRetire ?? (inputs.retireAge - age) * 12);
  const total = Math.max(retireAt, inputs.months ?? (inputs.untilAge - age + 1) * 12);
  const before = monthlyRate(inputs.growthBefore);
  const after = monthlyRate(inputs.growthAfter);
  // Cut at each year boundary, at the retirement month, and at the end.
  const first = inputs.firstStretch ?? 12;
  const cuts = new Set([0, retireAt, total]);
  for (let at = first; at < total; at += 12) cuts.add(at);
  const sorted = [...cuts].filter((at) => at <= total).sort((a, b) => a - b);
  const stretches: [number, number][] = sorted
    .slice(0, -1)
    .map((at, index): [number, number] => [at, sorted[index + 1] ?? total])
    .filter(([from, to]) => to > from);
  let fund = inputs.fund;
  let fundAtRetirement = retireAt === 0 ? fund : 0;
  let runsOutMonth: number | null = null;
  const years: RetirementYear[] = [];
  for (const [from, to] of stretches) {
    const retired = from >= retireAt;
    if (from === retireAt) fundAtRetirement = fund;
    const fundStart = fund;
    let added = 0;
    let growth = 0;
    let withdrawn = 0;
    let expenses = 0;
    let unpaid = 0;
    for (let month = from; month < to; month++) {
      const year = Math.floor(month / 12);
      const expense = inputs.monthlyExpense * Math.pow(1 + inflation / 100, year);
      expenses += expense;
      const gained = fund * (retired ? after : before);
      growth += gained;
      fund += gained;
      if (retired) {
        const paid = Math.min(fund, expense);
        withdrawn += paid;
        unpaid += expense - paid;
        fund -= paid;
        if (expense - paid > 0 && runsOutMonth === null) runsOutMonth = month;
      } else {
        const contribution = inputs.monthlyContribution * Math.pow(1 + stepUp / 100, year);
        added += contribution;
        fund += contribution;
      }
    }
    years.push({
      start: from,
      months: to - from,
      age: age + Math.floor(from / 12),
      retired,
      fundStart: roundMoney(fundStart),
      added: roundMoney(added),
      growth: roundMoney(growth),
      withdrawn: roundMoney(withdrawn),
      fundEnd: roundMoney(fund),
      expenses: roundMoney(expenses),
      unpaid: roundMoney(unpaid),
    });
  }
  return {
    years,
    monthsToRetire: retireAt,
    fundAtRetirement: roundMoney(fundAtRetirement),
    monthlyAtRetirement: roundMoney(
      inputs.monthlyExpense * Math.pow(1 + inflation / 100, retireAt / 12),
    ),
    runsOutAt: runsOutMonth === null ? null : age + Math.floor(runsOutMonth / 12),
    runsOutMonth,
    leftOver: roundMoney(fund),
  };
}

const lasts = (inputs: RetirementInputs) => planRetirement(inputs).runsOutAt === null;

/** The smallest value in [low, high] for which `ok` holds, assuming it holds from some point up. */
function lowest(ok: (value: number) => boolean, low: number, high: number) {
  if (!ok(high)) return null;
  for (let step = 0; step < 60; step++) {
    const middle = (low + high) / 2;
    if (ok(middle)) high = middle;
    else low = middle;
  }
  return high;
}

/** Ways to make the money last the whole plan, when it doesn't. */
export function retirementFixes(inputs: RetirementInputs) {
  if (lasts(inputs)) return null;
  const working = (inputs.monthsToRetire ?? (inputs.retireAge - inputs.age) * 12) > 0;
  // Extra each month until retirement, up to ten times today's monthly expense.
  const extra = working
    ? lowest(
        (value) => lasts({ ...inputs, monthlyContribution: inputs.monthlyContribution + value }),
        0,
        inputs.monthlyExpense * 10,
      )
    : null;
  let retireAt: number | null = null;
  for (let candidate = inputs.retireAge + 1; candidate < inputs.untilAge; candidate++) {
    const later = (candidate - inputs.retireAge) * 12;
    const shifted = {
      ...inputs,
      retireAge: candidate,
      ...(inputs.monthsToRetire === undefined
        ? {}
        : { monthsToRetire: inputs.monthsToRetire + later }),
    };
    if (lasts(shifted)) {
      retireAt = candidate;
      break;
    }
  }
  // The most the household could spend a month today, in today's rupees, and still last.
  // The smallest cut in spending that makes it last.
  const cut = lowest(
    (value) => lasts({ ...inputs, monthlyExpense: inputs.monthlyExpense - value }),
    0,
    inputs.monthlyExpense,
  );
  return {
    extraMonthly: extra === null ? null : Math.ceil(extra / 100) * 100,
    retireAt,
    affordableMonthly: cut === null ? null : Math.floor((inputs.monthlyExpense - cut) / 100) * 100,
  };
}

/**
 * Long-run rates for India, used for a sober check whatever rates are typed in. After
 * retiring, 10% assumes a mix of equity and safe debt.
 */
export const REALISTIC = { inflation: 6, growthBefore: 10, growthAfter: 10 } as const;

/**
 * What retirement needs, at realistic rates: the fund that pays today's spending, rising with
 * inflation, from retirement to the end of the plan; what the current plan reaches; and the
 * monthly investing, rising by the step-up, that gets there.
 */
export function retirementNeed(inputs: RetirementInputs) {
  const realistic = { ...inputs, ...REALISTIC };
  const reached = planRetirement(realistic);
  const totalMonths = inputs.months ?? (inputs.untilAge - inputs.age + 1) * 12;
  const lastsWith = (fund: number) =>
    planRetirement({
      ...realistic,
      fund,
      age: inputs.retireAge,
      monthsToRetire: 0,
      months: totalMonths - reached.monthsToRetire,
      monthlyExpense: reached.monthlyAtRetirement,
      monthlyContribution: 0,
    }).runsOutAt === null;
  // Rounded up to the rupee, so the fund named always lasts.
  const needed = Math.ceil(lowest(lastsWith, 0, reached.monthlyAtRetirement * 12 * 200) ?? 0);
  const working = reached.monthsToRetire > 0;
  const monthly = working
    ? lowest(
        (value) =>
          planRetirement({ ...realistic, monthlyContribution: value }).fundAtRetirement >= needed,
        0,
        Math.max(needed, 1),
      )
    : null;
  return {
    needed,
    onCourse: reached.fundAtRetirement,
    gap: roundMoney(Math.max(0, needed - reached.fundAtRetirement)),
    monthlyAtRetirement: reached.monthlyAtRetirement,
    /** The fund needed, as years of spending at retirement. */
    yearsOfSpending: needed / (reached.monthlyAtRetirement * 12),
    /** Total to invest each month from now, rising by the step-up, or null once retired. */
    monthlyInvesting: monthly === null ? null : Math.ceil(monthly / 100) * 100,
  };
}
