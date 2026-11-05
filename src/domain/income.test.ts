import { describe, expect, test } from 'vitest';
import { emptyTrackerData, type TrackerData } from '../data/repository';
import type { Expense, Income } from '../schema/records';
import {
  countedMonths,
  incomeByMember,
  incomeBySource,
  incomeSteadiness,
  isSalarySource,
  salaryHistory,
  savingsRateByMonth,
  sourceRegularity,
  whereIncomeGoes,
  yearOnYear,
} from './income';
import { insights } from './insights';

const TODAY = '2026-11-05';
const FY = 2026;

let next = 0;
const income = (month: string, source: string, amount: number, member = 'A'): Income => ({
  id: `i${++next}`,
  date: `${month}-01`,
  member,
  source,
  amount,
});
const spend = (month: string, amount: number, category = 'Groceries'): Expense => ({
  id: `e${++next}`,
  date: `${month}-03`,
  category,
  subcategory: '',
  amount,
  isAnnual: false,
});
const records = (extra: Partial<TrackerData>): TrackerData => ({ ...emptyTrackerData(), ...extra });

/** Months from April 2026 to October 2026, the complete ones this financial year. */
const FY_MONTHS = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];

describe('salary or not', () => {
  test('by name, unless sources are chosen', () => {
    expect(isSalarySource('Salary')).toBe(true);
    expect(isSalarySource('Monthly pay')).toBe(true);
    expect(isSalarySource('Consulting')).toBe(false);
    expect(isSalarySource('Consulting', ['Consulting'])).toBe(true);
    expect(isSalarySource('Salary', ['Consulting'])).toBe(false);
  });
});

describe('which months count', () => {
  test('this financial year to the last complete month, from when tracking began', () => {
    const data = records({ income: [income('2026-06', 'Salary', 1)] });
    expect(countedMonths(data, FY, TODAY)).toEqual(FY_MONTHS.slice(2));
    const earlier = records({ income: [income('2025-01', 'Salary', 1)] });
    expect(countedMonths(earlier, FY, TODAY)).toEqual(FY_MONTHS);
  });
});

describe('income by source', () => {
  const data = records({
    income: [
      ...FY_MONTHS.map((month) => income(month, 'Salary', 1_00_000)),
      income('2026-05', 'Consulting', 70_000),
      income('2026-09', 'Consulting', 70_000),
      // The running month isn't counted.
      income('2026-11', 'Salary', 9_99_999),
    ],
  });

  test('averages each source over the counted months, salary and other apart', () => {
    const result = incomeBySource(data, FY, TODAY);
    expect(result.months).toBe(7);
    expect(result.total).toBe(8_40_000);
    expect(result.monthly).toBe(1_20_000);
    expect(result.salary).toEqual({ total: 7_00_000, monthly: 1_00_000 });
    expect(result.other).toEqual({ total: 1_40_000, monthly: 20_000 });
    expect(result.salaryShare).toBeCloseTo(7 / 8.4);
    expect(result.sources[1]).toMatchObject({ source: 'Consulting', months: 2, salary: false });
  });

  test('how regularly a source comes', () => {
    expect(sourceRegularity(data, 'Consulting', TODAY)).toEqual({ came: 2, of: 7 });
  });
});

describe('salary history', () => {
  test('finds a raise that holds, not a one-off', () => {
    const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07'];
    const amounts = [1_00_000, 1_00_000, 1_20_000, 1_00_000, 1_08_000, 1_08_000, 1_08_000];
    const data = records({
      income: months.map((month, index) => income(month, 'Salary', amounts[index] ?? 0)),
    });
    const { raises } = salaryHistory(data, '2026-08-05');
    // March's ₹1.2 lakh dropped back the next month, so it was a one-off.
    expect(raises).toEqual([
      { month: '2026-05', from: 1_00_000, to: 1_08_000, change: expect.closeTo(0.08) },
    ]);
  });

  test('starts at the first salary, not at older records of other kinds', () => {
    const data = records({
      income: [income('2026-08', 'Salary', 1_00_000), income('2026-09', 'Salary', 1_00_000)],
      expenses: [spend('2025-01', 500)],
    });
    expect(salaryHistory(data, TODAY).points.map((point) => point.month)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
    ]);
  });

  test('yearly growth over more than a year', () => {
    const months: string[] = [];
    for (let year = 2025; year <= 2026; year++) {
      for (let month = 1; month <= 12; month++)
        months.push(`${year}-${String(month).padStart(2, '0')}`);
    }
    const data = records({
      income: months
        .filter((month) => month < '2026-11')
        .map((month) => income(month, 'Salary', month < '2026-01' ? 1_00_000 : 1_10_000)),
    });
    const { yearlyGrowth } = salaryHistory(data, TODAY);
    expect(yearlyGrowth).toBeGreaterThan(0.05);
    expect(yearlyGrowth).toBeLessThan(0.1);
  });
});

describe('year on year', () => {
  test('compares the same months of last year, by source', () => {
    const data = records({
      income: [
        ...FY_MONTHS.map((month) => income(month, 'Salary', 1_10_000)),
        ...FY_MONTHS.map((month) => income(`2025${month.slice(4)}`, 'Salary', 1_00_000)),
        // Last year's later months aren't compared.
        income('2026-02', 'Salary', 5_00_000),
      ],
    });
    const result = yearOnYear(data, FY, TODAY);
    expect(result.thisYear).toBe(7_70_000);
    expect(result.lastYear).toBe(7_00_000);
    expect(result.change).toBeCloseTo(0.1);
  });
});

describe('who earns what', () => {
  test('splits salary and other income per member', () => {
    const data = records({
      income: [income('2026-10', 'Salary', 1_00_000, 'A'), income('2026-10', 'Rent', 25_000, 'B')],
    });
    expect(incomeByMember(data, FY, TODAY)).toEqual([
      { member: 'A', total: 1_00_000, salary: 1_00_000, other: 0, share: 0.8 },
      { member: 'B', total: 25_000, salary: 0, other: 25_000, share: 0.2 },
    ]);
  });
});

describe('steadiness', () => {
  test('a flat income is steady, and the best and worst months are named', () => {
    const data = records({ income: FY_MONTHS.map((month) => income(month, 'Salary', 1_00_000)) });
    expect(incomeSteadiness(data, TODAY)).toMatchObject({ verdict: 'steady', below: 0, months: 7 });
    const lumpy = records({
      income: FY_MONTHS.map((month, index) =>
        income(month, 'Salary', index % 2 ? 40_000 : 1_60_000),
      ),
    });
    const result = incomeSteadiness(lumpy, TODAY);
    expect(result).toMatchObject({ verdict: 'varies a lot', worst: { amount: 40_000 } });
  });
});

describe('where income goes', () => {
  test('splits each ₹100 into spending, EMIs, investing and what is left', () => {
    const data = records({
      income: [income('2026-10', 'Salary', 1_00_000)],
      expenses: [spend('2026-10', 45_000), spend('2026-10', 16_000, 'EMI Payment')],
      contributions: [
        { id: 'c', holdingId: 'h', date: '2026-10-05', amount: 18_000, automatic: false },
      ],
    });
    const result = whereIncomeGoes(data, FY, TODAY);
    expect(result.per100.spending).toBeCloseTo(45);
    expect(result.per100.emis).toBeCloseTo(16);
    expect(result.per100.invested).toBeCloseTo(18);
    expect(result.per100.left).toBeCloseTo(21);
  });
});

describe('savings rate', () => {
  test('share kept each month, and the average', () => {
    const data = records({
      income: [income('2026-09', 'Salary', 1_00_000), income('2026-10', 'Salary', 1_00_000)],
      expenses: [spend('2026-09', 60_000), spend('2026-10', 80_000)],
    });
    const result = savingsRateByMonth(data, TODAY);
    expect(result.rows.map((row) => row.rate)).toEqual([0.4, expect.closeTo(0.2)]);
    expect(result.average).toBeCloseTo(0.3);
  });
});

describe('income insights', () => {
  test('a recent raise, the income mix and where each ₹100 goes', () => {
    const months = ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'];
    const data = records({
      income: [
        ...months.map((month) => income(month, 'Salary', month < '2026-08' ? 1_00_000 : 1_10_000)),
        ...months.map((month) => income(month, 'Rent', 20_000)),
      ],
      expenses: months.map((month) => spend(month, 50_000)),
    });
    const found = insights(data, TODAY);
    expect(found.find((row) => row.kind === 'salaryRaise')).toMatchObject({
      month: '2026-08',
      from: 1_00_000,
      to: 1_10_000,
    });
    expect(found.find((row) => row.kind === 'incomeMix')).toMatchObject({ other: 20_000 });
    const per = found.find((row) => row.kind === 'per100');
    expect(per && 'left' in per && Math.round(per.left)).toBe(60);
  });

  test('an old raise is left out', () => {
    const data = records({
      income: ['2025-01', '2025-02', '2025-03', '2026-10'].map((month, index) =>
        income(month, 'Salary', index === 0 ? 1_00_000 : 1_10_000),
      ),
    });
    expect(insights(data, TODAY).some((row) => row.kind === 'salaryRaise')).toBe(false);
  });
});
