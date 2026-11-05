import { roundMoney } from './calendar';

/**
 * A retirement plan, year by year: the fund grows with contributions until retirement, then
 * pays the household's expenses, which rise with inflation, while what's left keeps growing.
 * Pure figures in, figures out, so the screen can redraw it on every change.
 */
export interface RetirementInputs {
  /** The fund today. */
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
}

export interface RetirementYear {
  age: number;
  retired: boolean;
  fundStart: number;
  added: number;
  growth: number;
  withdrawn: number;
  fundEnd: number;
  /** What the household spends that year, whether or not the fund pays it. */
  expenses: number;
  /** Expenses the fund couldn't pay, once it ran out. */
  unpaid: number;
}

export interface RetirementPlan {
  years: RetirementYear[];
  fundAtRetirement: number;
  /** The monthly expense at retirement, after inflation. */
  monthlyAtRetirement: number;
  /** The age in which the fund runs out, or null if it lasts the whole plan. */
  runsOutAt: number | null;
  /** What's left at the end of the plan. */
  leftOver: number;
}

const monthlyRate = (yearly: number) => Math.pow(1 + yearly / 100, 1 / 12) - 1;

/** Steps month by month and sums each year, so growth, contributions and withdrawals interleave. */
export function planRetirement(inputs: RetirementInputs): RetirementPlan {
  const { age, retireAge, untilAge, inflation, stepUp } = inputs;
  const before = monthlyRate(inputs.growthBefore);
  const after = monthlyRate(inputs.growthAfter);
  let fund = inputs.fund;
  let fundAtRetirement = age >= retireAge ? fund : 0;
  let runsOutAt: number | null = null;
  const years: RetirementYear[] = [];
  for (let year = 0; age + year <= untilAge; year++) {
    const current = age + year;
    const retired = current >= retireAge;
    if (retired && current === retireAge) fundAtRetirement = fund;
    const monthlyExpense = inputs.monthlyExpense * Math.pow(1 + inflation / 100, year);
    const contribution = retired
      ? 0
      : inputs.monthlyContribution * Math.pow(1 + stepUp / 100, year);
    const fundStart = fund;
    let added = 0;
    let growth = 0;
    let withdrawn = 0;
    let unpaid = 0;
    for (let month = 0; month < 12; month++) {
      const gained = fund * (retired ? after : before);
      growth += gained;
      fund += gained;
      if (retired) {
        const paid = Math.min(fund, monthlyExpense);
        withdrawn += paid;
        unpaid += monthlyExpense - paid;
        fund -= paid;
      } else {
        added += contribution;
        fund += contribution;
      }
    }
    if (retired && unpaid > 0 && runsOutAt === null) runsOutAt = current;
    years.push({
      age: current,
      retired,
      fundStart: roundMoney(fundStart),
      added: roundMoney(added),
      growth: roundMoney(growth),
      withdrawn: roundMoney(withdrawn),
      fundEnd: roundMoney(fund),
      expenses: roundMoney(monthlyExpense * 12),
      unpaid: roundMoney(unpaid),
    });
  }
  return {
    years,
    fundAtRetirement: roundMoney(fundAtRetirement),
    monthlyAtRetirement: roundMoney(
      inputs.monthlyExpense * Math.pow(1 + inflation / 100, Math.max(0, retireAge - age)),
    ),
    runsOutAt,
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
  const working = inputs.retireAge > inputs.age;
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
    if (lasts({ ...inputs, retireAge: candidate })) {
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
  const lastsWith = (fund: number) =>
    planRetirement({
      ...realistic,
      fund,
      age: inputs.retireAge,
      monthlyExpense: reached.monthlyAtRetirement,
      monthlyContribution: 0,
    }).runsOutAt === null;
  // Rounded up to the rupee, so the fund named always lasts.
  const needed = Math.ceil(lowest(lastsWith, 0, reached.monthlyAtRetirement * 12 * 200) ?? 0);
  const working = inputs.retireAge > inputs.age;
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
