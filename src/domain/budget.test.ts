import { describe, expect, test } from 'vitest';
import { emptyTrackerData, type TrackerData } from '../data/repository';
import {
  budgetLineSchema,
  EMI_CATEGORY,
  type Budget,
  type BudgetLine,
  type Expense,
} from '../schema/records';
import {
  budgetActuals,
  lineGroups,
  budgetProgress,
  budgetTotal,
  fyMonths,
  monthPlan,
  nextYearBudget,
  starterBudget,
  withKids,
} from './budget';

const TODAY = '2026-11-15';
const line = (overrides: Partial<BudgetLine>): BudgetLine => ({
  id: 'l',
  name: 'Line',
  group: 'home',
  amount: 0,
  every: 'month',
  months: [],
  categories: [],
  ...overrides,
});
const budget = (lines: BudgetLine[]): Budget => ({
  id: 'fy-2026',
  fy: 2026,
  kids: 0,
  lines,
  income: 0,
});
let next = 0;
const spend = (date: string, amount: number, category: string): Expense => ({
  id: `e${++next}`,
  date,
  category,
  subcategory: '',
  isAnnual: false,
  amount,
});
const data = (expenses: Expense[], extra: Partial<TrackerData> = {}): TrackerData => ({
  ...emptyTrackerData(),
  expenses,
  ...extra,
});

describe('a yearly budget', () => {
  const rent = line({ id: 'rent', name: 'Rent', amount: 30_000, categories: ['House Rent'] });
  const fees = line({
    id: 'fees',
    name: 'School',
    group: 'kids',
    amount: 50_000,
    every: 'months',
    months: [4, 7, 12],
    categories: ['Education'],
  });
  const car = line({
    id: 'car',
    name: 'Car insurance',
    group: 'insurance',
    amount: 18_000,
    every: 'months',
    months: [12],
    categories: ['Insurance'],
  });
  const plan = budget([rent, fees, car]);

  test('totals the year, and spreads it over April to March', () => {
    expect(fyMonths(2026)[0]).toBe('2026-04');
    expect(fyMonths(2026)[11]).toBe('2027-03');
    expect(budgetTotal(plan)).toBe(30_000 * 12 + 50_000 * 3 + 18_000);
    const months = monthPlan(plan);
    // April has rent and fees; December has rent, fees and car insurance.
    expect(months[0]).toBe(80_000);
    expect(months[8]).toBe(98_000);
    expect(months[1]).toBe(30_000);
  });

  test('heavy months, and what to set aside each month', () => {
    const progress = budgetProgress(plan, data([]), TODAY);
    expect(progress.setAside).toBe(Math.round(((30_000 * 12 + 150_000 + 18_000) / 12) * 100) / 100);
    expect(progress.months.filter((month) => month.heavy).map((month) => month.month)).toEqual([
      '2026-04',
      '2026-07',
      '2026-12',
    ]);
  });

  test('plan against actual, and payments made in their months', () => {
    const rows = [
      ...['04', '05', '06', '07', '08', '09', '10'].map((m) =>
        spend(`2026-${m}-02`, 30_000, 'House Rent'),
      ),
      spend('2026-11-02', 45_000, 'House Rent'),
      spend('2026-04-05', 50_000, 'Education'),
      spend('2026-07-05', 50_000, 'Education'),
      spend('2026-10-01', 2_000, 'Dining out'),
    ];
    const progress = budgetProgress(plan, data(rows), TODAY);
    const byId = (id: string) => progress.lines.find((row) => row.line.id === id);
    // Rent: ₹2.55 lakh spent against ₹2.25 lakh due by mid-November, so ahead of pace.
    expect(byId('rent')?.over).toBeGreaterThan(0);
    expect(byId('fees')?.paid).toEqual({ done: 2, of: 2 });
    expect(byId('fees')?.over).toBe(0);
    expect(progress.outside).toBe(2_000);
    // Car insurance falls due in December, next month, and isn't paid yet.
    // School fees and car insurance both fall due in December, next month, and aren't paid yet.
    expect(progress.upcoming.map((row) => [row.line.id, row.month, row.amount])).toEqual([
      ['fees', '2026-12', 50_000],
      ['car', '2026-12', 18_000],
    ]);
  });

  test('what planned income leaves after the plan and EMIs', () => {
    // Recorded income doesn't count: only the income planned for the year.
    const income = [
      { id: 'i', date: '2026-04-01', member: 'A', source: 'Salary', amount: 1_00_000 },
    ];
    expect(budgetProgress(plan, data([], { income }), TODAY).left).toBeNull();
    const planned = budgetProgress({ ...plan, income: 18_00_000 }, data([], { income }), TODAY);
    expect(planned.income).toBe(18_00_000);
    expect(planned.left).toBe(18_00_000 - budgetTotal(plan));
  });
});

describe('a first plan, and next year', () => {
  test('starter lines are filled in from the last twelve months where the category is theirs alone', () => {
    const rows = ['2026-05', '2026-06', '2026-07', '2026-08'].flatMap((month) => [
      spend(`${month}-02`, 30_000, 'House Rent'),
      spend(`${month}-10`, 1_000, 'Insurance'),
    ]);
    const plan = starterBudget(2026, data(rows), TODAY, ['House Rent', 'Insurance', 'Education']);
    const rent = plan.lines.find((row) => row.name === 'Rent');
    expect(rent).toMatchObject({ categories: ['House Rent'], amount: 30_000, every: 'month' });
    // Four insurance lines share one category, so none can be filled in from it.
    expect(plan.lines.find((row) => row.name === 'Term insurance')).toMatchObject({
      categories: ['Insurance'],
      amount: 0,
    });
  });

  test('kids add and remove their school fees lines', () => {
    const plan = withKids(budget([line({ id: 'rent' }), line({ id: 'gym', group: 'health' })]), 2, [
      'Education',
    ]);
    expect(plan.lines.map((row) => row.id)).toEqual(['rent', 'kid-1', 'kid-2', 'gym']);
    expect(plan.lines[1]).toMatchObject({ name: 'Kid 1 · school fees', categories: ['Education'] });
    expect(withKids(plan, 1, []).lines.map((row) => row.id)).toEqual(['rent', 'kid-1', 'gym']);
  });

  test('next year rises by the rates chosen, school fees on their own', () => {
    const plan = budget([
      line({ amount: 10_000 }),
      line({ id: 'kid-1', group: 'kids', amount: 50_000 }),
    ]);
    const later = nextYearBudget(plan, 6, 10);
    expect(later).toMatchObject({ id: 'fy-2027', fy: 2027 });
    expect(later.lines.map((row) => row.amount)).toEqual([10_600, 55_000]);
  });
});

describe('budget against what was spent', () => {
  const plan = budget([
    line({ id: 'rent', name: 'Rent', amount: 30_000, categories: ['House Rent'] }),
    line({ id: 'food', name: 'Groceries', amount: 10_000, categories: ['Groceries'] }),
    line({ id: 'snacks', name: 'Snacks', amount: 2_000, categories: ['Groceries'] }),
    line({ id: 'gift', name: 'Gifts', amount: 5_000, every: 'once', months: [10] }),
  ]);
  const expenses = [
    spend('2026-04-05', 30_000, 'House Rent'),
    spend('2026-05-05', 30_000, 'House Rent'),
    spend('2026-04-10', 15_000, 'Groceries'),
    spend('2026-05-10', 8_000, 'groceries'),
    spend('2026-05-12', 4_000, 'Dining'),
    spend('2026-05-20', 9_000, EMI_CATEGORY),
  ];

  test('a finished year compares the whole plan, by category, most over first', () => {
    const actuals = budgetActuals(plan, data(expenses), '2027-06-01');
    expect(actuals.running).toBe(false);
    expect(actuals.planned).toBe(budgetTotal(plan));
    const [groceries, rent] = actuals.categories;
    // Two lines share Groceries, so they're judged together, whatever the case.
    expect(groceries).toMatchObject({
      label: 'Groceries',
      lines: ['Groceries', 'Snacks'],
      planned: 1_44_000,
      spent: 23_000,
      difference: 23_000 - 1_44_000,
    });
    expect(rent).toMatchObject({ label: 'House Rent', planned: 3_60_000, spent: 60_000 });
    // EMIs aren't spending against a budget.
    expect(actuals.unplanned).toEqual([{ category: 'Dining', spent: 4_000 }]);
    expect(actuals.untracked).toEqual([{ name: 'Gifts', yearly: 5_000 }]);
    expect(actuals.months[1]).toEqual({
      month: '2026-05',
      planned: 42_000,
      spent: 38_000,
      outside: 4_000,
    });
  });

  test('a running year compares against the plan so far, with months ahead left empty', () => {
    const actuals = budgetActuals(plan, data(expenses), '2026-05-31');
    expect(actuals.running).toBe(true);
    // April and all of May for the monthly lines.
    expect(actuals.planned).toBe(2 * 42_000);
    expect(actuals.months[2]?.spent).toBeNull();
    expect(actuals.categories[0]?.label).toBe('House Rent');
  });
});

describe('a line counting several categories', () => {
  const food = line({
    id: 'food',
    name: 'Groceries',
    amount: 15_000,
    categories: ['Grocery', 'Milk', 'Fruits'],
  });
  const treats = line({ id: 'treats', name: 'Treats', amount: 2_000, categories: ['fruits'] });
  const rent = line({ id: 'rent', name: 'Rent', amount: 30_000, categories: ['House Rent'] });

  test('spending in any of its categories counts against it', () => {
    const expenses = [
      spend('2026-04-03', 9_000, 'Grocery'),
      spend('2026-04-05', 3_000, 'Milk'),
      spend('2026-04-09', 2_000, 'Fruits'),
      spend('2026-04-12', 1_000, 'Dining'),
    ];
    const actuals = budgetActuals(budget([food]), data(expenses), '2027-04-01');
    expect(actuals.categories[0]).toMatchObject({ label: 'Grocery, Milk, Fruits', spent: 14_000 });
    expect(actuals.unplanned).toEqual([{ category: 'Dining', spent: 1_000 }]);
    expect(actuals.months[0]).toMatchObject({ spent: 14_000, outside: 1_000 });
  });

  test('lines sharing any category are judged together, others apart', () => {
    const groups = lineGroups([food, rent, treats]);
    expect(groups.map((group) => group.lines.map((row) => row.id))).toEqual([
      ['food', 'treats'],
      ['rent'],
    ]);
    expect(groups[0]?.categories).toEqual(['Grocery', 'Milk', 'Fruits']);
  });

  test('a line saved with one category reads back as a list of one', () => {
    const saved = { ...food, categories: undefined, category: 'Groceries' };
    expect(budgetLineSchema.parse(saved).categories).toEqual(['Groceries']);
    expect(budgetLineSchema.parse({ ...saved, category: '' }).categories).toEqual([]);
  });
});
