import type { TrackerData } from '../data/repository';
import type { Budget, BudgetLine } from '../schema/records';
import { isAnyHouseExpense, isEmi } from './analytics';
import {
  daysInMonth,
  financialYearRange,
  financialYearStart,
  nextMonth,
  previousMonth,
  roundMoney,
} from './calendar';
import { summarizeLoans } from './summary';

/**
 * A financial year's spending plan, and how the year is going against it. Only the plan and
 * the income planned for the year are stored; spending is always worked out from expenses,
 * with unrecorded spending left out, as it has no category to match.
 */

export const budgetId = (fy: number) => `fy-${fy}`;

/** The year's months in order, April to March, as YYYY-MM. */
export function fyMonths(fy: number) {
  const months: string[] = [];
  for (
    let month = financialYearRange(fy).start.slice(0, 7);
    months.length < 12;
    month = nextMonth(month)
  ) {
    months.push(month);
  }
  return months;
}

/** What a line costs over the year. */
export const lineYearly = (line: BudgetLine) =>
  line.every === 'month' ? line.amount * 12 : line.amount * Math.max(1, line.months.length);

/** What each month of the year needs, April first. */
export function monthPlan(budget: Budget) {
  const plan = Array.from({ length: 12 }, () => 0);
  for (const line of budget.lines) {
    if (line.every === 'month') {
      for (let index = 0; index < 12; index++) plan[index] = (plan[index] ?? 0) + line.amount;
      continue;
    }
    for (const month of line.months) {
      // April is the year's first month.
      const index = (month + 8) % 12;
      plan[index] = (plan[index] ?? 0) + line.amount;
    }
  }
  return plan.map(roundMoney);
}

export const budgetTotal = (budget: Budget) =>
  roundMoney(budget.lines.reduce((sum, line) => sum + lineYearly(line), 0));

interface Starter {
  name: string;
  group: BudgetLine['group'];
  every: BudgetLine['every'];
  months: number[];
  /** Categories that likely hold its spending, first match wins. */
  categories: string[];
}

const STARTERS: Starter[] = [
  { name: 'Rent', group: 'home', every: 'month', months: [], categories: ['House Rent', 'Rent'] },
  { name: 'Groceries', group: 'home', every: 'month', months: [], categories: ['Groceries'] },
  {
    name: 'Internet',
    group: 'home',
    every: 'month',
    months: [],
    categories: ['Internet', 'Utilities', 'Bills'],
  },
  {
    name: 'Term insurance',
    group: 'insurance',
    every: 'months',
    months: [6],
    categories: ['Insurance'],
  },
  {
    name: 'Health insurance',
    group: 'insurance',
    every: 'months',
    months: [8],
    categories: ['Insurance'],
  },
  {
    name: 'Car insurance',
    group: 'insurance',
    every: 'months',
    months: [12],
    categories: ['Insurance'],
  },
  {
    name: 'Bike insurance',
    group: 'insurance',
    every: 'months',
    months: [5],
    categories: ['Insurance'],
  },
  {
    name: 'Health management',
    group: 'health',
    every: 'month',
    months: [],
    categories: ['Healthcare', 'Health'],
  },
  { name: 'Gym', group: 'health', every: 'month', months: [], categories: ['Gym', 'Fitness'] },
  {
    name: 'Car service',
    group: 'vehicles',
    every: 'months',
    months: [1],
    categories: ['Car', 'Maintenance', 'Transport'],
  },
  {
    name: 'Bike service',
    group: 'vehicles',
    every: 'months',
    months: [7],
    categories: ['Bike', 'Maintenance', 'Transport'],
  },
  {
    name: 'Vacation',
    group: 'lifestyle',
    every: 'once',
    months: [12],
    categories: ['Vacation', 'Travel'],
  },
];
const SCHOOL = ['Education', 'School fees', 'School'];

/** Spending a month by category, over the twelve complete months before today. */
function usualByCategory(data: TrackerData, today: string) {
  const last = previousMonth(today.slice(0, 7));
  let first = last;
  for (let step = 1; step < 12; step++) first = previousMonth(first);
  const rows = data.expenses.filter((row) => {
    const month = row.date.slice(0, 7);
    return month >= first && month <= last && !isEmi(row) && !isAnyHouseExpense(row);
  });
  const months = new Set(rows.map((row) => row.date.slice(0, 7))).size;
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount);
  return {
    perMonth: (category: string) => (months > 0 ? (totals.get(category) ?? 0) / months : 0),
    categories: [...totals.keys()],
  };
}

/** A kid's school fees line, paid in April, July and December to start with. */
export const kidLine = (index: number, category: string): BudgetLine => ({
  id: `kid-${index}`,
  name: `Kid ${index} · school fees`,
  group: 'kids',
  amount: 0,
  every: 'months',
  months: [4, 7, 12],
  category,
});

/**
 * A first plan for a year: the usual lines, each matched to one of the family's categories
 * and filled in from what was spent there over the last twelve months, where only one line
 * draws on that category and so its share is known.
 */
export function starterBudget(
  fy: number,
  data: TrackerData,
  today: string,
  known: string[],
): Budget {
  const usual = usualByCategory(data, today);
  const available = [...new Set([...usual.categories, ...known])];
  const match = (names: string[]) =>
    names.find((name) => available.some((have) => have.toLowerCase() === name.toLowerCase())) ?? '';
  const matched = STARTERS.map((starter) => ({ starter, category: match(starter.categories) }));
  const shared = (category: string) =>
    matched.filter((row) => row.category === category).length > 1;
  const round = (value: number) => Math.round(value / 100) * 100;
  const lines = matched.map(({ starter, category }, index): BudgetLine => {
    const perMonth = category && !shared(category) ? usual.perMonth(category) : 0;
    const yearly = perMonth * 12;
    return {
      id: `line-${index}`,
      name: starter.name,
      group: starter.group,
      every: starter.every,
      months: starter.months,
      category,
      amount:
        starter.every === 'month'
          ? round(perMonth)
          : round(yearly / Math.max(1, starter.months.length)),
    };
  });
  return {
    id: budgetId(fy),
    fy,
    kids: 0,
    lines: lines.map((line) => ({ ...line, category: line.category || '' })),
    income: 0,
  };
}

/** Sets the number of kids, adding or removing their school fees lines. */
export function withKids(budget: Budget, kids: number, known: string[]): Budget {
  const category =
    SCHOOL.find((name) => known.some((have) => have.toLowerCase() === name.toLowerCase())) ?? '';
  const others = budget.lines.filter((line) => !line.id.startsWith('kid-'));
  const kidLines = Array.from(
    { length: kids },
    (_, index) =>
      budget.lines.find((line) => line.id === `kid-${index + 1}`) ?? kidLine(index + 1, category),
  );
  const at = others.findIndex((line) => line.group !== 'home' && line.group !== 'insurance');
  const ordered =
    at === -1
      ? [...others, ...kidLines]
      : [...others.slice(0, at), ...kidLines, ...others.slice(at)];
  return { ...budget, kids, lines: ordered };
}

export interface LineStatus {
  line: BudgetLine;
  yearly: number;
  /** Due by today: past months in full, and this month's monthly lines in part. */
  due: number;
  /** Spent in its category so far this year, shared with any other line on that category. */
  spent: number | null;
  /** Spending ahead of pace by this much, or 0. */
  over: number;
  /** For lines paid in chosen months: how many of the payments due so far look paid. */
  paid: { done: number; of: number } | null;
}

export interface BudgetProgress {
  total: number;
  setAside: number;
  months: { month: string; planned: number; heavy: boolean }[];
  spent: number;
  due: number;
  /** Spending in categories no line covers. */
  outside: number;
  lines: LineStatus[];
  /** The income planned for the year, as entered. */
  income: number;
  emis: number;
  /** What planned income leaves after the plan and EMIs, to invest, or null with no income planned. */
  left: number | null;
  /** Payments due this month or next, not yet paid. */
  upcoming: { line: BudgetLine; month: string; amount: number }[];
}

/** How far through a month today is, from 0 to 1. */
const monthShare = (today: string) => {
  const day = Number(today.slice(8, 10));
  return day / daysInMonth(Number(today.slice(0, 4)), Number(today.slice(5, 7)));
};

export function budgetProgress(budget: Budget, data: TrackerData, today: string): BudgetProgress {
  const months = fyMonths(budget.fy);
  const current = today.slice(0, 7);
  const plan = monthPlan(budget);
  const total = budgetTotal(budget);
  const setAside = roundMoney(total / 12);
  const share = monthShare(today);
  const inYear = (date: string) =>
    date.slice(0, 7) >= (months[0] ?? '') &&
    date <= today &&
    date.slice(0, 7) <= (months[11] ?? '');
  const spending = data.expenses.filter(
    (row) => inYear(row.date) && !isEmi(row) && !isAnyHouseExpense(row),
  );
  const byCategory = new Map<string, number>();
  for (const row of spending)
    byCategory.set(
      row.category.toLowerCase(),
      (byCategory.get(row.category.toLowerCase()) ?? 0) + row.amount,
    );
  const covered = new Set(budget.lines.map((line) => line.category.toLowerCase()).filter(Boolean));
  const spentIn = (category: string, month?: string) =>
    spending
      .filter(
        (row) =>
          row.category.toLowerCase() === category.toLowerCase() &&
          (!month || row.date.startsWith(month)),
      )
      .reduce((sum, row) => sum + row.amount, 0);

  const lineDue = (line: BudgetLine) => {
    let due = 0;
    months.forEach((month, index) => {
      if (month > current) return;
      const calendarMonth = ((index + 3) % 12) + 1;
      const amount =
        line.every === 'month'
          ? line.amount
          : line.months.includes(calendarMonth)
            ? line.amount
            : 0;
      due += month === current && line.every === 'month' ? amount * share : amount;
    });
    return due;
  };

  // A category's spending is shared by its lines, so pace is judged per category.
  const categoryDue = new Map<string, number>();
  for (const line of budget.lines) {
    if (!line.category) continue;
    const key = line.category.toLowerCase();
    categoryDue.set(key, (categoryDue.get(key) ?? 0) + lineDue(line));
  }

  const lines = budget.lines.map((line): LineStatus => {
    const key = line.category.toLowerCase();
    const spent = line.category ? roundMoney(byCategory.get(key) ?? 0) : null;
    const dueAll = categoryDue.get(key) ?? 0;
    const ahead = spent === null ? 0 : spent - dueAll;
    let paid: LineStatus['paid'] = null;
    if (line.every !== 'month' && line.category) {
      const dueMonths = months.filter(
        (month, index) => month <= current && line.months.includes(((index + 3) % 12) + 1),
      );
      const done = dueMonths.filter(
        (month) => spentIn(line.category, month) >= line.amount * 0.9,
      ).length;
      paid = { done, of: dueMonths.length };
    }
    return {
      line,
      yearly: roundMoney(lineYearly(line)),
      due: roundMoney(lineDue(line)),
      spent,
      over: ahead > Math.max(1_000, dueAll * 0.05) ? roundMoney(ahead) : 0,
      paid,
    };
  });

  const coveredSpent = [...byCategory]
    .filter(([key]) => covered.has(key))
    .reduce((sum, [, amount]) => sum + amount, 0);
  const outside = [...byCategory]
    .filter(([key]) => !covered.has(key))
    .reduce((sum, [, amount]) => sum + amount, 0);
  const due = lines.reduce((sum, row) => sum + row.due, 0);

  const monthsLeft = months.filter((month) => month > current).length;
  const monthlyEmi = summarizeLoans(data, today)
    .filter((loan) => (loan.ledger?.remaining ?? 0) > 0)
    .reduce((sum, loan) => sum + (loan.ledger?.emi ?? 0), 0);
  const emisPaid = data.expenses
    .filter((row) => inYear(row.date) && isEmi(row))
    .reduce((sum, row) => sum + row.amount, 0);
  const emis = emisPaid + monthlyEmi * monthsLeft;

  const next = nextMonth(current);
  const upcoming = budget.lines.flatMap((line) => {
    if (line.every === 'month' || !line.category) return [];
    return [current, next].flatMap((month) => {
      const calendarMonth = Number(month.slice(5, 7));
      if (!months.includes(month) || !line.months.includes(calendarMonth)) return [];
      if (spentIn(line.category, month) >= line.amount * 0.9 || line.amount <= 0) return [];
      return [{ line, month, amount: line.amount }];
    });
  });

  return {
    total,
    setAside,
    months: months.map((month, index) => ({
      month,
      planned: plan[index] ?? 0,
      heavy: (plan[index] ?? 0) > setAside * 1.05,
    })),
    spent: roundMoney(coveredSpent),
    due: roundMoney(due),
    outside: roundMoney(outside),
    lines,
    income: budget.income,
    emis: roundMoney(emis),
    left: budget.income > 0 ? roundMoney(budget.income - total - emis) : null,
    upcoming,
  };
}

/** Next year's plan from this one, each amount up by `rise` percent, school fees by `kidsRise`. */
export function nextYearBudget(budget: Budget, rise: number, kidsRise: number): Budget {
  const up = (amount: number, percent: number) =>
    Math.round((amount * (1 + percent / 100)) / 100) * 100;
  return {
    ...budget,
    id: budgetId(budget.fy + 1),
    fy: budget.fy + 1,
    lines: budget.lines.map((line) => ({
      ...line,
      amount: up(line.amount, line.group === 'kids' ? kidsRise : rise),
    })),
  };
}

/** This financial year's payments due this month or next and not yet paid, for reminders. */
export function budgetReminders(data: TrackerData, today: string) {
  const budget = data.budgets.find((row) => row.fy === financialYearStart(today));
  return budget ? budgetProgress(budget, data, today).upcoming : [];
}
