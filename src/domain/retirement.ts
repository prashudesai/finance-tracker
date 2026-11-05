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
  /**
   * The fund split by investment, each with its own behaviour after retiring. Left out, the
   * whole fund grows at `growthAfter` and pays expenses by selling.
   */
  parts?: RetirementPart[];
}

/** One investment, or group of them, in the fund. */
export interface RetirementPart {
  name: string;
  /** Its value today. */
  value: number;
  /** Its share of the monthly contribution until retiring, from 0 to 1. */
  share: number;
  /** After retiring, as yearly percentages of its value. */
  growth: number;
  payout: number;
  /**
   * A fixed payout a month in place of the percentage, such as rent or an annuity. Paid in
   * full while what it held at retirement is kept, and in part once some is sold.
   */
  payoutMonthly?: number;
  /** Whether it can be sold to pay expenses once the rest is spent. */
  sellable: boolean;
  /** At retirement, a share moved into an income investment paying `payout` a year. */
  move?: { share: number; payout: number };
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
  /** Income the investments paid out, spent first. */
  payouts: number;
  /** Taken out of the fund by selling. */
  withdrawn: number;
  fundEnd: number;
  /** What the household spends in it, whether or not the fund pays. */
  expenses: number;
  /** Expenses the fund couldn't pay, once it ran out. */
  unpaid: number;
}

/** One month of the plan, for charting by age. */
export interface RetirementMonth {
  /** The fund at the month's end. */
  fund: number;
  /** What the household spends in it. */
  expense: number;
  /** Growth and payouts the fund made in it. */
  earned: number;
}

export interface RetirementPlan {
  years: RetirementYear[];
  /** Every month from now, in order. */
  monthly: RetirementMonth[];
  /** Months from now to retiring. */
  monthsToRetire: number;
  fundAtRetirement: number;
  /** The monthly expense at retirement, after inflation. */
  monthlyAtRetirement: number;
  /** Payouts in the first month of retirement. */
  payoutAtRetirement: number;
  /** The fund just after retiring, moves made, by part, to scale for other fund sizes. */
  partsAtRetirement: RetirementPart[];
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
  return simulate(inputs, 'full');
}

/**
 * The plan itself. Searches that try many plans ask only what they need: whether the money
 * lasts, stopping at the first month it falls short, or the fund at retirement, stopping
 * there; neither keeps the year-by-year or month-by-month figures.
 */
function simulate(inputs: RetirementInputs, need: 'full' | 'lasts' | 'fund'): RetirementPlan {
  const full = need === 'full';
  const { age, inflation, stepUp } = inputs;
  const retireAt = Math.max(0, inputs.monthsToRetire ?? (inputs.retireAge - age) * 12);
  const total = Math.max(retireAt, inputs.months ?? (inputs.untilAge - age + 1) * 12);
  const before = monthlyRate(inputs.growthBefore);
  // A rate is worked out once per growth figure, not once per investment per month.
  const rates = new Map<number, number>();
  const rateOf = (yearly: number) => {
    let rate = rates.get(yearly);
    if (rate === undefined) {
      rate = monthlyRate(yearly);
      rates.set(yearly, rate);
    }
    return rate;
  };
  // Each part keeps its own value; the simple plan is one part that grows and sells.
  let parts: RetirementPart[] = (
    inputs.parts ?? [
      {
        name: 'Fund',
        value: inputs.fund,
        share: 1,
        growth: inputs.growthAfter,
        payout: 0,
        sellable: true,
      },
    ]
  ).map((part) => ({ ...part }));
  const values = () => parts.reduce((sum, part) => sum + part.value, 0);
  let partsAtRetirement: RetirementPart[] = [];
  let payoutAtRetirement = 0;
  const heldAtRetirement = new Map<RetirementPart, number>();
  /** A month's payout: the fixed amount, less any part sold, or the percentage of its value. */
  const payoutOf = (part: RetirementPart) => {
    if (part.payoutMonthly === undefined) return (part.value * part.payout) / 100 / 12;
    const held = heldAtRetirement.get(part) ?? 0;
    return part.payoutMonthly * (held > 0 ? Math.min(1, part.value / held) : 1);
  };
  const paysNothing = (part: RetirementPart) =>
    part.payout === 0 && (part.payoutMonthly ?? 0) === 0;
  /** Moves money into income investments, once, as retirement starts. */
  const retire = () => {
    const moved: RetirementPart[] = [];
    for (const part of parts) {
      if (!part.move) continue;
      const amount = part.value * part.move.share;
      part.value -= amount;
      moved.push({
        name: `${part.name} → income`,
        value: amount,
        share: 0,
        growth: 0,
        payout: part.move.payout,
        sellable: true,
      });
    }
    for (const part of parts) delete part.move;
    parts = [...parts, ...moved];
    for (const part of parts) heldAtRetirement.set(part, part.value);
    partsAtRetirement = parts.map((part) => ({ ...part, value: roundMoney(part.value) }));
  };
  /** Takes `amount` from the parts that `from` allows, in proportion to their value. */
  const draw = (amount: number, from: (part: RetirementPart) => boolean) => {
    if (amount <= 0) return 0;
    let available = 0;
    for (const part of parts) if (part.value > 0 && from(part)) available += part.value;
    const taken = Math.min(amount, available);
    if (taken > 0) {
      for (const part of parts) {
        if (part.value > 0 && from(part)) part.value -= (taken * part.value) / available;
      }
    }
    return taken;
  };
  // Cut at each year boundary, at the retirement month, and at the end.
  const first = inputs.firstStretch ?? 12;
  const cuts = new Set([0, retireAt, total]);
  for (let at = first; at < total; at += 12) cuts.add(at);
  const sorted = [...cuts].filter((at) => at <= total).sort((a, b) => a - b);
  const stretches: [number, number][] = sorted
    .slice(0, -1)
    .map((at, index): [number, number] => [at, sorted[index + 1] ?? total])
    .filter(([from, to]) => to > from);
  let fundAtRetirement = retireAt === 0 ? values() : 0;
  let runsOutMonth: number | null = null;
  const years: RetirementYear[] = [];
  const monthly: RetirementMonth[] = [];
  const result = (): RetirementPlan => ({
    years,
    monthsToRetire: retireAt,
    fundAtRetirement: roundMoney(fundAtRetirement),
    monthlyAtRetirement: roundMoney(
      inputs.monthlyExpense * Math.pow(1 + inflation / 100, retireAt / 12),
    ),
    payoutAtRetirement: roundMoney(payoutAtRetirement),
    partsAtRetirement,
    monthly,
    runsOutAt: runsOutMonth === null ? null : age + Math.floor(runsOutMonth / 12),
    runsOutMonth,
    leftOver: roundMoney(values()),
  });
  if (retireAt === 0) {
    if (need === 'fund') return result();
    retire();
  }
  for (const [from, to] of stretches) {
    const retired = from >= retireAt;
    if (from === retireAt && retireAt > 0) {
      fundAtRetirement = values();
      if (need === 'fund') return result();
      retire();
    }
    const fundStart = values();
    let added = 0;
    let growth = 0;
    let payouts = 0;
    let withdrawn = 0;
    let expenses = 0;
    let unpaid = 0;
    for (let month = from; month < to; month++) {
      const year = Math.floor(month / 12);
      const expense = inputs.monthlyExpense * Math.pow(1 + inflation / 100, year);
      expenses += expense;
      const grownBefore = growth;
      const paidBefore = payouts;
      if (retired) {
        let income = 0;
        for (const part of parts) {
          const gained = part.value * rateOf(part.growth);
          growth += gained;
          part.value += gained;
          income += payoutOf(part);
        }
        if (month === retireAt) payoutAtRetirement = income;
        payouts += income;
        if (income >= expense) {
          // What payouts leave over is reinvested in what grows, or held as it is.
          const growing = parts.filter((part) => part.growth > 0);
          const into = growing.length > 0 ? growing : parts;
          const weight = into.reduce((sum, part) => sum + part.value, 0);
          for (const part of into) {
            part.value += (income - expense) * (weight > 0 ? part.value / weight : 1 / into.length);
          }
        } else {
          // Sell what pays nothing first, then what also grows, and what only pays last.
          const short = expense - income;
          let paid = draw(short, (part) => part.sellable && paysNothing(part));
          paid += draw(short - paid, (part) => part.sellable && part.growth > 0);
          paid += draw(short - paid, (part) => part.sellable);
          withdrawn += paid;
          unpaid += short - paid;
          if (short - paid > 0.005 && runsOutMonth === null) {
            runsOutMonth = month;
            if (need === 'lasts') return result();
          }
        }
      } else {
        const contribution = inputs.monthlyContribution * Math.pow(1 + stepUp / 100, year);
        added += contribution;
        for (const part of parts) {
          const gained = part.value * before;
          growth += gained;
          part.value += gained + contribution * part.share;
        }
      }
      if (full) {
        monthly.push({
          fund: values(),
          expense,
          earned: growth - grownBefore + payouts - paidBefore,
        });
      }
    }
    if (!full) continue;
    const fund = values();
    years.push({
      start: from,
      months: to - from,
      age: age + Math.floor(from / 12),
      retired,
      fundStart: roundMoney(fundStart),
      added: roundMoney(added),
      growth: roundMoney(growth),
      payouts: roundMoney(payouts),
      withdrawn: roundMoney(withdrawn),
      fundEnd: roundMoney(fund),
      expenses: roundMoney(expenses),
      unpaid: roundMoney(unpaid),
    });
  }
  return result();
}

const lasts = (inputs: RetirementInputs) => simulate(inputs, 'lasts').runsOutAt === null;

/**
 * The smallest value in [low, high] for which `ok` holds, assuming it holds from some point
 * up, to within a paisa: every answer is shown rounded to rupees or more.
 */
function lowest(ok: (value: number) => boolean, low: number, high: number) {
  if (!ok(high)) return null;
  for (let step = 0; step < 60 && high - low > 0.01; step++) {
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
 * retiring, 10% assumes a mix of equity and safe debt. Investments set one by one keep
 * their own rates after retiring, since those describe what they are.
 */
export const REALISTIC = { inflation: 6, growthBefore: 10, growthAfter: 10 } as const;

/**
 * What retirement needs, at realistic rates, or yours where they're more cautious: the fund that pays today's spending, rising with
 * inflation, from retirement to the end of the plan; what the current plan reaches; and the
 * monthly investing, rising by the step-up, that gets there.
 */
export function retirementNeed(inputs: RetirementInputs) {
  // Never rosier than the plan itself: the more cautious of the long-run rates and yours.
  const rates = {
    inflation: Math.max(inputs.inflation, REALISTIC.inflation),
    growthBefore: Math.min(inputs.growthBefore, REALISTIC.growthBefore),
    growthAfter: Math.min(inputs.growthAfter, REALISTIC.growthAfter),
  };
  const realistic = { ...inputs, ...rates };
  const reached = planRetirement(realistic);
  const totalMonths = inputs.months ?? (inputs.untilAge - inputs.age + 1) * 12;
  // Investments set one by one keep their mix at retirement, scaled to the fund tried.
  const mix = reached.partsAtRetirement;
  const mixTotal = mix.reduce((sum, part) => sum + part.value, 0);
  const scaled = (fund: number) =>
    inputs.parts && mixTotal > 0
      ? { parts: mix.map((part) => ({ ...part, value: (fund * part.value) / mixTotal })) }
      : {};
  const lastsWith = (fund: number) =>
    simulate(
      {
        ...realistic,
        ...scaled(fund),
        fund,
        age: inputs.retireAge,
        monthsToRetire: 0,
        months: totalMonths - reached.monthsToRetire,
        monthlyExpense: reached.monthlyAtRetirement,
        monthlyContribution: 0,
      },
      'lasts',
    ).runsOutAt === null;
  // Rounded up to the rupee, so the fund named always lasts.
  const needed = Math.ceil(lowest(lastsWith, 0, reached.monthlyAtRetirement * 12 * 200) ?? 0);
  const working = reached.monthsToRetire > 0;
  const monthly = working
    ? lowest(
        (value) =>
          simulate({ ...realistic, monthlyContribution: value }, 'fund').fundAtRetirement >= needed,
        0,
        Math.max(needed, 1),
      )
    : null;
  return {
    /** The rates the check used, so they can be named. */
    rates,
    needed,
    onCourse: reached.fundAtRetirement,
    gap: roundMoney(Math.max(0, needed - reached.fundAtRetirement)),
    monthlyAtRetirement: reached.monthlyAtRetirement,
    /** The fund needed, as years of spending at retirement. */
    yearsOfSpending: needed / (reached.monthlyAtRetirement * 12),
    /**
     * Total to invest each month from now, rising by the step-up, or null once retired. Zero
     * when today's fund gets there on its own.
     */
    monthlyInvesting: monthly === null ? null : monthly < 100 ? 0 : Math.ceil(monthly / 100) * 100,
  };
}
