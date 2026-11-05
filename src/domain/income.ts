import type { TrackerData } from '../data/repository';
import type { Income } from '../schema/records';
import { isEmi, trackingStart } from './analytics';
import { financialYearRange, nextMonth, previousMonth, roundMoney } from './calendar';

/**
 * Where income comes from, worked out from income records alone. "Salary" is any source
 * chosen as salary, or by default any whose name mentions salary or pay. Months are YYYY-MM.
 */

const SALARY_NAME = /salary|pay/i;

export const isSalarySource = (source: string, chosen?: string[]) =>
  chosen && chosen.length > 0 ? chosen.includes(source) : SALARY_NAME.test(source);

const sum = (rows: { amount: number }[]) => rows.reduce((total, row) => total + row.amount, 0);
const monthOf = (row: { date: string }) => row.date.slice(0, 7);

/** Every month from `from` to `to`, both included. */
function monthsBetween(from: string, to: string) {
  const months: string[] = [];
  for (let month = from; month <= to; month = nextMonth(month)) months.push(month);
  return months;
}

/**
 * The financial year's months that count: from its start, or from when tracking began, to
 * the last complete month. A running month would make every average look low.
 */
export function countedMonths(
  data: Pick<TrackerData, 'income' | 'expenses'>,
  fy: number,
  today: string,
) {
  const { start, end } = financialYearRange(fy);
  const since = trackingStart(data);
  const from = since && since > start.slice(0, 7) ? since : start.slice(0, 7);
  const lastComplete = previousMonth(today.slice(0, 7));
  const to = lastComplete < end.slice(0, 7) ? lastComplete : end.slice(0, 7);
  return from <= to ? monthsBetween(from, to) : [];
}

export interface SourceRow {
  source: string;
  salary: boolean;
  total: number;
  /** Per counted month, so a source that comes some months only averages lower. */
  monthly: number;
  /** How many counted months it came in. */
  months: number;
  share: number;
}

/** Income by source over the financial year's counted months. */
export function incomeBySource(data: TrackerData, fy: number, today: string, chosen?: string[]) {
  const months = countedMonths(data, fy, today);
  const counted = new Set(months);
  const rows = data.income.filter((row) => counted.has(monthOf(row)));
  const total = sum(rows);
  const bySource = new Map<string, Income[]>();
  for (const row of rows) bySource.set(row.source, [...(bySource.get(row.source) ?? []), row]);
  const sources: SourceRow[] = [...bySource]
    .map(([source, items]) => {
      const amount = sum(items);
      return {
        source,
        salary: isSalarySource(source, chosen),
        total: roundMoney(amount),
        monthly: roundMoney(months.length > 0 ? amount / months.length : 0),
        months: new Set(items.map(monthOf)).size,
        share: total > 0 ? amount / total : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
  const salary = sources.filter((row) => row.salary).reduce((all, row) => all + row.total, 0);
  const per = (amount: number) => roundMoney(months.length > 0 ? amount / months.length : 0);
  return {
    months: months.length,
    from: months[0] ?? null,
    to: months.at(-1) ?? null,
    total: roundMoney(total),
    monthly: per(total),
    salary: { total: roundMoney(salary), monthly: per(salary) },
    other: { total: roundMoney(total - salary), monthly: per(total - salary) },
    salaryShare: total > 0 ? salary / total : 0,
    sources,
  };
}

export interface Raise {
  month: string;
  from: number;
  to: number;
  change: number;
}

/**
 * Salary each month since tracking began, up to `span` complete months, and the raises in
 * it: a rise of at least 2% that holds the next month too, so a one-off extra isn't a raise.
 */
export function salaryHistory(data: TrackerData, today: string, chosen?: string[], span = 24) {
  const since = trackingStart(data);
  const last = previousMonth(today.slice(0, 7));
  let from = last;
  for (let step = 1; step < span; step++) from = previousMonth(from);
  if (since && since > from) from = since;
  const salary = data.income.filter((row) => isSalarySource(row.source, chosen));
  // From the first salary, so months before the first payslip don't read as ₹0.
  const firstPaid = salary.map(monthOf).sort()[0];
  if (firstPaid && firstPaid > from) from = firstPaid;
  const points = (from <= last ? monthsBetween(from, last) : []).map((month) => ({
    month,
    amount: roundMoney(sum(salary.filter((row) => monthOf(row) === month))),
  }));
  const raises: Raise[] = [];
  for (let index = 1; index < points.length - 1; index++) {
    const before = points[index - 1]?.amount ?? 0;
    const now = points[index]?.amount ?? 0;
    const after = points[index + 1]?.amount ?? 0;
    if (before > 0 && now >= before * 1.02 && after >= now * 0.99) {
      raises.push({
        month: points[index]?.month ?? '',
        from: before,
        to: now,
        change: now / before - 1,
      });
    }
  }
  // Yearly growth from the first three paid months to the last three, over a year or more.
  const paid = points.filter((point) => point.amount > 0);
  const average = (rows: typeof paid) => sum(rows) / Math.max(rows.length, 1);
  const first = paid.slice(0, 3);
  const latest = paid.slice(-3);
  const gap = paid.length - 3;
  const yearlyGrowth =
    paid.length >= 15 && average(first) > 0
      ? Math.pow(average(latest) / average(first), 12 / gap) - 1
      : null;
  return { points, raises, yearlyGrowth };
}

/** How many of the last `span` complete months a source came in. */
export function sourceRegularity(data: TrackerData, source: string, today: string, span = 12) {
  let month = today.slice(0, 7);
  const months: string[] = [];
  for (let step = 0; step < span; step++) {
    month = previousMonth(month);
    months.push(month);
  }
  const since = trackingStart(data);
  const tracked = since ? months.filter((key) => key >= since) : months;
  const came = new Set(data.income.filter((row) => row.source === source).map(monthOf));
  return { came: tracked.filter((key) => came.has(key)).length, of: tracked.length };
}

/**
 * This financial year against the same months of the last one, by source, so a year that's
 * only half over isn't compared with a whole one.
 */
export function yearOnYear(data: TrackerData, fy: number, today: string) {
  const months = countedMonths(data, fy, today);
  const lastYear = months.map((month) => `${Number(month.slice(0, 4)) - 1}${month.slice(4)}`);
  const inMonths = (keys: string[]) => {
    const set = new Set(keys);
    return data.income.filter((row) => set.has(monthOf(row)));
  };
  const now = inMonths(months);
  const before = inMonths(lastYear);
  const sources = [...new Set([...now, ...before].map((row) => row.source))];
  const rows = sources
    .map((source) => {
      const thisYear = sum(now.filter((row) => row.source === source));
      const previous = sum(before.filter((row) => row.source === source));
      return {
        source,
        thisYear: roundMoney(thisYear),
        lastYear: roundMoney(previous),
        change: previous > 0 ? thisYear / previous - 1 : null,
      };
    })
    .sort((a, b) => b.thisYear - a.thisYear);
  const totalNow = sum(now);
  const totalBefore = sum(before);
  return {
    months: months.length,
    from: months[0] ?? null,
    to: months.at(-1) ?? null,
    rows,
    thisYear: roundMoney(totalNow),
    lastYear: roundMoney(totalBefore),
    change: totalBefore > 0 ? totalNow / totalBefore - 1 : null,
  };
}

/** Each family member's income over the year's counted months, salary and other apart. */
export function incomeByMember(data: TrackerData, fy: number, today: string, chosen?: string[]) {
  const counted = new Set(countedMonths(data, fy, today));
  const rows = data.income.filter((row) => counted.has(monthOf(row)));
  const total = sum(rows);
  return [...new Set(rows.map((row) => row.member))]
    .map((member) => {
      const mine = rows.filter((row) => row.member === member);
      const salary = sum(mine.filter((row) => isSalarySource(row.source, chosen)));
      const all = sum(mine);
      return {
        member,
        total: roundMoney(all),
        salary: roundMoney(salary),
        other: roundMoney(all - salary),
        share: total > 0 ? all / total : 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** How even income is over the last `span` complete months since tracking began. */
export function incomeSteadiness(data: TrackerData, today: string, span = 12) {
  let month = today.slice(0, 7);
  const since = trackingStart(data);
  if (!since) return null;
  const totals: { month: string; amount: number }[] = [];
  for (let step = 0; step < span; step++) {
    month = previousMonth(month);
    if (since && month < since) break;
    const key = month;
    totals.push({ month: key, amount: sum(data.income.filter((row) => monthOf(row) === key)) });
  }
  if (totals.length < 3) return null;
  if (sum(totals) <= 0) return null;
  const average = sum(totals) / totals.length;
  const spread =
    Math.sqrt(
      sum(totals.map(({ amount }) => ({ amount: (amount - average) ** 2 }))) / totals.length,
    ) / (average || 1);
  const ordered = [...totals].sort((a, b) => b.amount - a.amount);
  return {
    months: totals.length,
    average: roundMoney(average),
    best: ordered[0] ?? null,
    worst: ordered.at(-1) ?? null,
    below: totals.filter(({ amount }) => amount < average * 0.95).length,
    /** Typical distance from the average, as a share of it. */
    spread,
    verdict: spread < 0.1 ? 'steady' : spread < 0.25 ? 'fairly steady' : 'varies a lot',
  } as const;
}

/**
 * Where each ₹100 earned went over the year's counted months: spending, EMIs, savings
 * contributions, and what was left, which stays in the bank.
 */
export function whereIncomeGoes(data: TrackerData, fy: number, today: string) {
  const months = countedMonths(data, fy, today);
  const counted = new Set(months);
  const income = sum(data.income.filter((row) => counted.has(monthOf(row))));
  const expenses = data.expenses.filter((row) => counted.has(monthOf(row)));
  const emis = sum(expenses.filter(isEmi));
  const spending = sum(expenses) - emis;
  const invested = sum(
    data.contributions.filter((row) => !row.skipped && counted.has(monthOf(row))),
  );
  const left = income - spending - emis - invested;
  const per100 = (amount: number) => (income > 0 ? (amount / income) * 100 : 0);
  return {
    months: months.length,
    income: roundMoney(income),
    spending: roundMoney(spending),
    emis: roundMoney(emis),
    invested: roundMoney(invested),
    left: roundMoney(left),
    per100: {
      spending: per100(spending),
      emis: per100(emis),
      invested: per100(invested),
      left: per100(left),
    },
  };
}

/** Share of income kept each complete month, income less all spending, since tracking began. */
export function savingsRateByMonth(data: TrackerData, today: string, span = 12) {
  let month = today.slice(0, 7);
  const since = trackingStart(data);
  const rows: { month: string; rate: number | null; income: number; expenses: number }[] = [];
  for (let step = 0; step < span; step++) {
    month = previousMonth(month);
    if (since && month < since) break;
    const key = month;
    const income = sum(data.income.filter((row) => monthOf(row) === key));
    const expenses = sum(data.expenses.filter((row) => monthOf(row) === key));
    rows.unshift({
      month: key,
      income: roundMoney(income),
      expenses: roundMoney(expenses),
      rate: income > 0 ? (income - expenses) / income : null,
    });
  }
  const rated = rows.filter((row) => row.rate !== null);
  return {
    rows,
    average:
      rated.length > 0 ? rated.reduce((all, row) => all + (row.rate ?? 0), 0) / rated.length : null,
  };
}
