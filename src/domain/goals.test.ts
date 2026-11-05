import { describe, expect, test } from 'vitest';
import { emptyTrackerData, type TrackerData } from '../data/repository';
import type { Goal, Holding } from '../schema/records';
import {
  assignedShares,
  defaultReturn,
  emergencyTarget,
  futureCost,
  goalPlan,
  milestoneOf,
  monthlyAverages,
  passedMilestones,
  monthlyNeeded,
  monthsUntil,
  overAssigned,
  planGoal,
  projectSavings,
  retirementFunding,
  retirementTarget,
  unassignedValue,
} from './goals';
import { insights } from './insights';

const holding = (id: string, value: number, extra: Partial<Holding> = {}): Holding => ({
  id,
  kind: 'investment',
  type: 'Mutual Funds',
  name: id,
  member: 'A',
  date: '2024-01-01',
  openingInvested: value,
  openingValue: value,
  monthly: 0,
  autoContribute: false,
  ...extra,
});

const goal = (extra: Partial<Goal> = {}): Goal => ({
  id: 'g',
  kind: 'education',
  name: 'College',
  target: 10_00_000,
  targetDate: '2036-11-01',
  member: '',
  inflation: 10,
  funding: [],
  ...extra,
});

const data = (extra: Partial<TrackerData> = {}): TrackerData => ({
  ...emptyTrackerData(),
  ...extra,
});

describe('goal maths', () => {
  test('counts whole months to the target date', () => {
    expect(monthsUntil('2026-11-05', '2036-11-01')).toBe(120);
    expect(monthsUntil('2026-11-05', '2026-03-01')).toBe(0);
  });

  test('grows the target by inflation', () => {
    // ₹10 lakh at 10% for 10 years is about ₹25.94 lakh.
    expect(futureCost(10_00_000, 10, 120)).toBeCloseTo(25_93_742.46, 0);
    expect(futureCost(10_00_000, 0, 120)).toBe(10_00_000);
  });

  test('projects a lump sum and a monthly amount', () => {
    expect(projectSavings(1_000, 100, 0, 12)).toBe(2_200);
    // 12% a year, compounded monthly, doubles a lump sum in about six years.
    expect(projectSavings(1_00_000, 0, 12, 72)).toBeCloseTo(1_97_382.26, 0);
  });

  test('the monthly amount needed lands on the target', () => {
    const monthly = monthlyNeeded(50_000, 5_00_000, 9, 60) ?? 0;
    expect(projectSavings(50_000, monthly, 9, 60)).toBeCloseTo(5_00_000, 2);
    expect(monthlyNeeded(0, 1_000, 9, 0)).toBeNull();
    expect(monthlyNeeded(10_00_000, 1_000, 9, 12)).toBe(0);
  });

  test('picks a safer return for nearer goals', () => {
    expect(defaultReturn('car', 24)).toBe(7);
    expect(defaultReturn('house', 60)).toBe(9);
    expect(defaultReturn('education', 120)).toBe(11);
    expect(defaultReturn('emergency', 120)).toBe(6);
  });
});

describe('where a goal stands', () => {
  const base = { saved: 2_00_000, monthly: 10_000, expectedReturn: 10, target: 10_00_000 };

  test('on track when the plan reaches the inflated target', () => {
    const plan = planGoal({ ...base, inflation: 6, months: 120 }, '2026-11-05');
    expect(plan.status).toBe('onTrack');
    expect(plan.extraMonthly).toBe(0);
    expect(plan.reachedBy && plan.reachedBy <= '2036-11').toBe(true);
  });

  test('behind says how much more each month reaches it', () => {
    const plan = planGoal({ ...base, monthly: 0, inflation: 10, months: 120 }, '2026-11-05');
    expect(plan.status).toBe('behind');
    const extra = plan.extraMonthly ?? 0;
    expect(projectSavings(base.saved, extra, 10, 120)).toBeCloseTo(plan.needed, -1);
  });

  test('close when within a tenth of the target', () => {
    const needed = futureCost(10_00_000, 6, 60);
    const monthly = (monthlyNeeded(2_00_000, needed * 0.95, 10, 60) ?? 0) + 0;
    const plan = planGoal({ ...base, monthly, inflation: 6, months: 60 }, '2026-11-05');
    expect(plan.status).toBe('close');
  });

  test('reached once the savings cover what will be needed', () => {
    const plan = planGoal({ ...base, saved: 30_00_000, inflation: 6, months: 24 }, '2026-11-05');
    expect(plan.status).toBe('reached');
    expect(plan.progress).toBeGreaterThan(1);
    expect(milestoneOf(plan.progress)).toBe(100);
  });

  test('only a goal seen before, passing a higher milestone, is celebrated', () => {
    const before = new Map([
      ['a', 25],
      ['b', 50],
    ]);
    const now = new Map([
      ['a', 50],
      ['b', 50],
      ['new', 100],
    ]);
    expect(passedMilestones(before, now)).toEqual([{ id: 'a', step: 50 }]);
  });

  test('milestones step by quarters', () => {
    expect(milestoneOf(0.2)).toBe(0);
    expect(milestoneOf(0.25)).toBe(25);
    expect(milestoneOf(0.74)).toBe(50);
  });
});

describe('funding from holdings', () => {
  const fund = holding('fund', 4_00_000, { monthly: 20_000 });
  const ppf = holding('ppf', 3_00_000, { kind: 'ppf', type: 'PPF', monthly: 5_000 });

  test('takes the funded share of value and monthly amount', () => {
    const plan = goalPlan(
      goal({ funding: [{ holdingId: 'fund', share: 0.5 }] }),
      data({ holdings: [fund] }),
      '2026-11-05',
    );
    expect(plan.saved).toBe(2_00_000);
    expect(plan.monthly).toBe(10_000);
    expect(plan.expectedReturn).toBe(11);
  });

  test('a removed holding counts as nothing, rather than failing', () => {
    const plan = goalPlan(
      goal({ funding: [{ holdingId: 'gone', share: 1 }] }),
      data(),
      '2026-11-05',
    );
    expect(plan.saved).toBe(0);
  });

  test('tracks shares across goals, and what is left over', () => {
    const goals = [
      goal({ id: 'a', funding: [{ holdingId: 'fund', share: 0.6 }] }),
      goal({ id: 'b', funding: [{ holdingId: 'fund', share: 0.6 }] }),
    ];
    expect(assignedShares(goals).get('fund')).toBeCloseTo(1.2);
    expect(assignedShares(goals, 'a').get('fund')).toBeCloseTo(0.6);
    expect(overAssigned(goals)).toEqual(['fund']);
    const records = data({ holdings: [fund, ppf], goals: [goals[0] as Goal] });
    expect(unassignedValue(records, '2026-11-05')).toBe(1_60_000 + 3_00_000);
  });

  test('retirement offers what is left of each retirement account', () => {
    const records = data({
      holdings: [fund, ppf],
      goals: [goal({ id: 'a', funding: [{ holdingId: 'ppf', share: 0.25 }] })],
    });
    expect(retirementFunding(records)).toEqual([{ holdingId: 'ppf', share: 0.75 }]);
  });
});

describe('suggested targets', () => {
  test('emergency fund is six months of recent spending', () => {
    const expense = (date: string, amount: number) => ({
      id: date,
      date,
      category: 'Groceries',
      subcategory: '',
      amount,
      isAnnual: false,
    });
    const result = emergencyTarget(
      {
        expenses: [
          expense('2026-10-03', 40_000),
          expense('2026-09-03', 60_000),
          expense('2026-11-02', 99_999),
        ],
      },
      '2026-11-05',
    );
    expect(result).toEqual({ average: 50_000, months: 2, target: 3_00_000 });
    expect(emergencyTarget({ expenses: [] }, '2026-11-05')).toBeNull();
  });

  test('retirement covers 25 years of spending in today’s rupees', () => {
    // Growth equal to inflation leaves no real return: 25 years × 12 months × ₹50,000.
    expect(retirementTarget(50_000, { growth: 6, inflation: 6 })).toBe(1_50_00_000);
    const withReturn = retirementTarget(50_000);
    expect(withReturn).toBeLessThan(1_50_00_000);
    expect(withReturn).toBeGreaterThan(1_30_00_000);
  });
});

describe('goal insights', () => {
  test('the goal furthest behind says how much more a month puts it back on track', () => {
    const records = data({
      holdings: [holding('fund', 1_00_000)],
      goals: [goal({ funding: [{ holdingId: 'fund', share: 1 }] })],
    });
    const found = insights(records, '2026-11-05').find((row) => row.kind === 'goalBehind');
    expect(found).toMatchObject({ goalId: 'g', tone: 'watch' });
    expect(found && 'extra' in found && found.extra).toBeGreaterThan(0);
  });

  test('a funded goal is celebrated', () => {
    const records = data({
      holdings: [holding('fund', 40_00_000)],
      goals: [goal({ funding: [{ holdingId: 'fund', share: 1 }] })],
    });
    const kinds = insights(records, '2026-11-05').map((row) => row.kind);
    expect(kinds).toContain('goalReached');
    expect(kinds).not.toContain('goalBehind');
  });
});

describe('portfolio target', () => {
  const income = (date: string, amount: number) => ({
    id: `i${date}`,
    date,
    member: 'A',
    source: 'Salary',
    amount,
  });
  const spend = (date: string, amount: number) => ({
    id: `e${date}`,
    date,
    category: 'Groceries',
    subcategory: '',
    amount,
    isAnnual: false,
  });

  test('averages recent complete months, skipping empty ones and the running month', () => {
    const records = {
      income: [
        income('2026-10-01', 2_00_000),
        income('2026-08-01', 1_80_000),
        income('2026-11-01', 9),
      ],
      expenses: [spend('2026-10-05', 1_00_000), spend('2026-08-05', 80_000)],
    };
    expect(monthlyAverages(records, '2026-11-05')).toEqual({
      income: 1_90_000,
      expenses: 90_000,
      surplus: 1_00_000,
      invested: 0,
      months: 2,
      since: '2026-08',
    });
    expect(monthlyAverages({ income: [], expenses: [] }, '2026-11-05')).toBeNull();
  });

  test('without a date, it says when the target is reached', () => {
    // ₹27 lakh, saving ₹1 lakh a month with no growth, reaches ₹50 lakh in 23 months.
    const plan = planGoal(
      {
        saved: 27_00_000,
        monthly: 1_00_000,
        expectedReturn: 0,
        target: 50_00_000,
        inflation: 0,
        months: null,
      },
      '2026-11-05',
    );
    expect(plan.reachedBy).toBe('2028-10');
    expect(plan.status).toBe('onTrack');
    const never = planGoal(
      {
        saved: 27_00_000,
        monthly: 0,
        expectedReturn: 0,
        target: 50_00_000,
        inflation: 0,
        months: null,
      },
      '2026-11-05',
    );
    expect(never).toMatchObject({ reachedBy: null, status: 'behind' });
  });

  test('net worth counts loans, which shrink as they are repaid', () => {
    const plan = planGoal(
      {
        saved: 40_00_000,
        monthly: 0,
        expectedReturn: 0,
        target: 35_00_000,
        inflation: 0,
        months: null,
        debts: 10_00_000,
        principal: 1_00_000,
      },
      '2026-11-05',
    );
    expect(plan.saved).toBe(30_00_000);
    // ₹5 lakh more needed, closed at ₹1 lakh of principal a month.
    expect(plan.reachedBy).toBe('2027-04');
  });

  test('invested is contributions less withdrawals, and a skipped one does not count', () => {
    const contribution = (id: string, date: string, amount: number, skipped = false) => ({
      id,
      holdingId: 'fund',
      date,
      amount,
      automatic: true,
      ...(skipped ? { skipped } : {}),
    });
    const averages = monthlyAverages(
      {
        income: [income('2026-10-01', 1_00_000), income('2026-09-01', 1_00_000)],
        expenses: [],
        contributions: [
          contribution('a', '2026-10-05', 40_000),
          contribution('b', '2026-09-05', 30_000),
          contribution('c', '2026-09-06', 99_000, true),
        ],
        withdrawals: [{ id: 'w', holdingId: 'fund', date: '2026-09-20', amount: 10_000 }],
      },
      '2026-11-05',
    );
    expect(averages).toMatchObject({ invested: 30_000, months: 2 });
  });

  test('only counts from when tracking began, so earlier investments do not inflate it', () => {
    const averages = monthlyAverages(
      {
        // Started using the app in September.
        income: [income('2026-09-01', 1_00_000), income('2026-10-01', 1_00_000)],
        expenses: [],
        contributions: [
          // Entered for the months before, when setting up.
          { id: 'old1', holdingId: 'fund', date: '2026-06-05', amount: 5_00_000, automatic: false },
          { id: 'old2', holdingId: 'fund', date: '2026-08-05', amount: 5_00_000, automatic: false },
          { id: 'new1', holdingId: 'fund', date: '2026-09-05', amount: 20_000, automatic: true },
          { id: 'new2', holdingId: 'fund', date: '2026-10-05', amount: 20_000, automatic: true },
        ],
      },
      '2026-11-05',
    );
    expect(averages).toMatchObject({ invested: 20_000, months: 2, since: '2026-09' });
  });

  test('grows by what is invested each month, not by what stays in the bank', () => {
    const months = Array.from(
      { length: 6 },
      (_, index) => `2026-${String(index + 5).padStart(2, '0')}`,
    );
    const records = data({
      holdings: [holding('fund', 27_00_000)],
      income: months.map((month) => income(`${month}-01`, 1_50_000)),
      expenses: months.map((month) => spend(`${month}-02`, 50_000)),
      contributions: months.map((month) => ({
        id: `c${month}`,
        holdingId: 'fund',
        date: `${month}-05`,
        amount: 40_000,
        automatic: true,
      })),
    });
    const target = goal({
      kind: 'portfolio',
      target: 50_00_000,
      inflation: 0,
      targetDate: undefined,
    });
    const plan = goalPlan(target, records, '2026-11-05');
    // The six contributions are part of the fund's value now.
    expect(plan.saved).toBe(29_40_000);
    // ₹1 lakh is left after spending, but only ₹40,000 of it is invested.
    expect(plan.monthly).toBe(40_000);
    expect(plan.expectedReturn).toBe(8);
    const found = insights({ ...records, goals: [target] }, '2026-11-05').find(
      (row) => row.kind === 'goalEta',
    );
    expect(found).toMatchObject({
      reachedBy: plan.reachedBy,
      invested: 40_000,
      leftover: 60_000,
      basedOn: 6,
    });
    // Investing the leftover too gets there sooner.
    expect(
      found &&
        'fasterBy' in found &&
        found.fasterBy &&
        plan.reachedBy &&
        found.fasterBy < plan.reachedBy,
    ).toBe(true);
  });
});
