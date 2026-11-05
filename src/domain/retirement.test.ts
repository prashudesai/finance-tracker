import { describe, expect, test } from 'vitest';
import { ageOn } from './calendar';
import {
  planRetirement,
  REALISTIC,
  retirementFixes,
  retirementNeed,
  type RetirementInputs,
} from './retirement';

const base: RetirementInputs = {
  fund: 10_00_000,
  monthlyExpense: 50_000,
  monthlyContribution: 0,
  stepUp: 0,
  age: 40,
  retireAge: 60,
  untilAge: 85,
  inflation: 0,
  growthBefore: 0,
  growthAfter: 0,
};

describe('retirement plan', () => {
  test('without growth or inflation, contributions pile up and withdrawals run it down', () => {
    // ₹10 lakh plus ₹20,000 a month for 20 years is ₹58 lakh at 60.
    const plan = planRetirement({ ...base, monthlyContribution: 20_000 });
    expect(plan.fundAtRetirement).toBe(58_00_000);
    // ₹6 lakh a year lasts 9 years and 8 months: it runs out in the year aged 69.
    expect(plan.runsOutAt).toBe(69);
    const at69 = plan.years.find((row) => row.age === 69);
    expect(at69?.withdrawn).toBe(4_00_000);
    expect(at69?.unpaid).toBe(2_00_000);
    expect(plan.leftOver).toBe(0);
    expect(plan.years).toHaveLength(46);
  });

  test('expenses rise with inflation, before and after retiring', () => {
    const plan = planRetirement({ ...base, inflation: 6 });
    // ₹50,000 a month today is about ₹1,60,357 after 20 years at 6%.
    expect(plan.monthlyAtRetirement).toBeCloseTo(1_60_356.77, 0);
    expect(plan.years[1]?.expenses).toBe(6_36_000);
    // Before retiring, the fund doesn't pay expenses.
    expect(plan.years[0]?.withdrawn).toBe(0);
  });

  test('growth compounds monthly at the yearly rate', () => {
    const plan = planRetirement({ ...base, growthBefore: 10, retireAge: 41 });
    expect(plan.years[0]?.fundEnd).toBeCloseTo(11_00_000, 0);
    expect(plan.fundAtRetirement).toBeCloseTo(11_00_000, 0);
  });

  test('after retiring, the fund grows at the after-retirement rate', () => {
    const plan = planRetirement({
      ...base,
      monthlyExpense: 0,
      age: 60,
      untilAge: 60,
      growthBefore: 20,
      growthAfter: 5,
    });
    expect(plan.leftOver).toBeCloseTo(10_50_000, 0);
  });

  test('contributions step up each year, and stop at retirement', () => {
    const plan = planRetirement({
      ...base,
      monthlyContribution: 10_000,
      stepUp: 10,
      retireAge: 42,
    });
    expect(plan.years[0]?.added).toBe(1_20_000);
    expect(plan.years[1]?.added).toBe(1_32_000);
    expect(plan.years[2]?.added).toBe(0);
  });

  test('a fund that lasts says what is left', () => {
    const plan = planRetirement({ ...base, fund: 2_00_00_000 });
    expect(plan.runsOutAt).toBeNull();
    // 26 years of ₹6 lakh from ₹2 crore.
    expect(plan.leftOver).toBe(2_00_00_000 - 26 * 6_00_000);
    expect(retirementFixes({ ...base, fund: 2_00_00_000 })).toBeNull();
  });
});

describe('ways to make it last', () => {
  const short = { ...base, monthlyContribution: 20_000 };

  test('each fix, applied alone, makes the money last the whole plan', () => {
    const fixes = retirementFixes(short);
    expect(fixes).not.toBeNull();
    const { extraMonthly, retireAt, affordableMonthly } = fixes ?? {};
    expect(
      planRetirement({ ...short, monthlyContribution: 20_000 + (extraMonthly ?? 0) }).runsOutAt,
    ).toBeNull();
    expect(
      planRetirement({ ...short, monthlyContribution: 20_000 + (extraMonthly ?? 0) - 1_000 })
        .runsOutAt,
    ).not.toBeNull();
    expect(retireAt).not.toBeNull();
    expect(planRetirement({ ...short, retireAge: retireAt ?? 0 }).runsOutAt).toBeNull();
    expect(planRetirement({ ...short, retireAge: (retireAt ?? 0) - 1 }).runsOutAt).not.toBeNull();
    expect(
      planRetirement({ ...short, monthlyExpense: affordableMonthly ?? 0 }).runsOutAt,
    ).toBeNull();
    expect(
      planRetirement({ ...short, monthlyExpense: (affordableMonthly ?? 0) + 1_000 }).runsOutAt,
    ).not.toBeNull();
  });

  test('once retired, the only fixes are spending less', () => {
    const fixes = retirementFixes({ ...base, age: 65, retireAge: 60 });
    expect(fixes?.extraMonthly).toBeNull();
    expect(fixes?.affordableMonthly).toBeGreaterThan(0);
  });
});

describe('what retirement needs, at realistic rates', () => {
  test('the needed fund exactly lasts the plan, and the monthly investing reaches it', () => {
    const inputs = {
      ...base,
      monthlyContribution: 20_000,
      stepUp: 5,
      inflation: 2,
      growthBefore: 15,
    };
    const need = retirementNeed(inputs);
    // It ignores the rates typed in, and uses 6%, 10% and 7%.
    const realistic = { ...inputs, ...REALISTIC };
    expect(need.onCourse).toBe(planRetirement(realistic).fundAtRetirement);
    const after = (fund: number) =>
      planRetirement({
        ...realistic,
        fund,
        age: 60,
        monthlyExpense: need.monthlyAtRetirement,
        monthlyContribution: 0,
      }).runsOutAt;
    expect(after(need.needed)).toBeNull();
    expect(after(need.needed * 0.99)).not.toBeNull();
    const monthly = need.monthlyInvesting ?? 0;
    expect(
      planRetirement({ ...realistic, monthlyContribution: monthly }).fundAtRetirement,
    ).toBeGreaterThanOrEqual(need.needed);
    expect(
      planRetirement({ ...realistic, monthlyContribution: monthly - 500 }).fundAtRetirement,
    ).toBeLessThan(need.needed);
    expect(need.gap).toBe(Math.max(0, Math.round((need.needed - need.onCourse) * 100) / 100));
  });

  test('25 years at 10% growth and 6% inflation needs about 17 years of spending', () => {
    const need = retirementNeed({ ...base, age: 60 });
    expect(need.yearsOfSpending).toBeGreaterThan(15.5);
    expect(need.yearsOfSpending).toBeLessThan(18);
    // Already retired: nothing more to invest.
    expect(need.monthlyInvesting).toBeNull();
  });
});

describe('ages from dates', () => {
  test('a birthday not yet reached this year leaves the age a year lower', () => {
    expect(ageOn('1991-06-15', '2026-11-05')).toBe(35);
    expect(ageOn('1991-12-15', '2026-11-05')).toBe(34);
    expect(ageOn('1991-11-05', '2026-11-05')).toBe(35);
  });
});
