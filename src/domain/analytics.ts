import type { TrackerData } from '../data/repository';
import {
  defaultSettings,
  EMI_CATEGORY,
  PMS_TYPE,
  type Expense,
  type Holding,
  type TrackerSettings,
} from '../schema/records';
import {
  financialYearRange,
  financialYearStart,
  addDays,
  lastDayOfMonth,
  previousMonth,
  roundMoney,
  toDayNumber,
} from './calendar';
import { balancesByMonth, closeFrom, monthClose, monthTotals, type MonthClose } from './cashflow';
import {
  holdingValue,
  growthType,
  holdingContributions,
  holdingPosition,
  latestValuation,
  type HoldingPosition,
} from './holdings';
import { isLoanFailure } from './loan';
import { summarizeLoans, totalOutstanding } from './summary';
import { rebuildLoan } from './loan';
import { emiReminders, missedEmis } from './reminders';
import { loanPayments } from './recurring';

export const isPms = (holding: Holding) => holding.type === PMS_TYPE;

/** Market-linked: funds, shares and NPS, as opposed to deposits and PF. */
export const isMarket = (holding: Holding, settings: TrackerSettings | undefined) =>
  holding.kind === 'nps' ||
  (holding.kind === 'investment' &&
    growthType(holding.type, settings ?? defaultSettings()) === 'market');

export interface PositionRow {
  holding: Holding;
  position: HoldingPosition;
}

export const holdingRows = (data: TrackerData, asOf: string): PositionRow[] =>
  data.holdings.map((holding) => ({ holding, position: holdingPosition(holding, data, asOf) }));

export interface CategoryRow {
  name: string;
  current: number;
  invested: number;
  gain: number;
  absolute: number | null;
  share: number;
  count: number;
  rows: PositionRow[];
}

const CATEGORY_NAMES: Record<Holding['kind'], string | null> = {
  investment: null,
  pf: 'PF',
  ppf: 'PPF',
  nps: 'NPS',
};

export const categoryOf = (holding: Holding) => CATEGORY_NAMES[holding.kind] ?? holding.type;

/**
 * A holding's name with its kind in front, for lists of single accounts: PF, PPF and NPS
 * accounts are often named by an account number alone, such as "PF · 100281757735".
 */
export function holdingLabel(holding: Holding) {
  const category = CATEGORY_NAMES[holding.kind];
  if (!category || holding.name.toLowerCase().includes(category.toLowerCase())) return holding.name;
  return `${category} · ${holding.name}`;
}

/**
 * Holdings for choosing or comparing: each investment on its own, and all PF, all PPF and
 * all NPS accounts as one row each, so account numbers don't fill the list.
 */
export function holdingGroups(holdings: Holding[]) {
  const groups = new Map<string, { key: string; label: string; holdings: Holding[] }>();
  for (const holding of holdings) {
    const category = CATEGORY_NAMES[holding.kind];
    const key = category ?? holding.id;
    const group = groups.get(key) ?? { key, label: category ?? holding.name, holdings: [] };
    group.holdings.push(holding);
    groups.set(key, group);
  }
  return [...groups.values()];
}

/** Holdings grouped by category, largest first. */
export function portfolioCategories(rows: PositionRow[]): CategoryRow[] {
  const groups = new Map<string, PositionRow[]>();
  for (const row of rows) {
    const name = categoryOf(row.holding);
    groups.set(name, [...(groups.get(name) ?? []), row]);
  }
  const total = rows.reduce((sum, row) => sum + row.position.current, 0);
  return [...groups]
    .map(([name, items]) => {
      const current = items.reduce((sum, row) => sum + row.position.current, 0);
      const invested = items.reduce((sum, row) => sum + row.position.invested, 0);
      return {
        name,
        current,
        invested,
        gain: current - invested,
        absolute: invested > 0 ? (current - invested) / invested : null,
        share: total > 0 ? current / total : 0,
        count: items.length,
        rows: items,
      };
    })
    .sort((a, b) => b.current - a.current);
}

export function netWorth(data: TrackerData, today: string) {
  const assets = holdingRows(data, today).reduce((sum, row) => sum + row.position.current, 0);
  const debts = totalOutstanding(summarizeLoans(data, today));
  const total = assets + debts;
  return {
    assets,
    debts,
    netWorth: assets - debts,
    assetShare: total > 0 ? assets / total : 0,
  };
}

export interface NetWorthPoint {
  month: string;
  assets: number;
  debts: number;
  netWorth: number;
  /** A market holding had no value update this month, so its figure is carried forward. */
  estimated: boolean;
}

const HISTORY_MONTHS = 60;

/** Worked out from records each time, so correcting the past corrects the whole chart. */
export function netWorthHistory(
  data: TrackerData,
  today: string,
  limit = HISTORY_MONTHS,
): NetWorthPoint[] {
  const starts = [...data.holdings, ...data.loans].map((row) => row.date.slice(0, 7)).sort();
  const current = today.slice(0, 7);
  const first = starts[0];
  if (!first || first > current) return [];
  const months = [current];
  while (months.length < limit && (months[0] ?? current) > first) {
    months.unshift(previousMonth(months[0] ?? current));
  }
  // Only loan payments matter here, so every month needn't scan all spending.
  const payments = data.expenses.filter((row) => row.loanId);
  return months.map((month) => {
    const date = month === current ? today : lastDayOfMonth(month);
    // Accounts count from their start date, and only what had happened by then applies.
    const holdings = data.holdings.filter((row) => row.date <= date);
    const loans = data.loans
      .filter((row) => row.date <= date)
      .map((row) => ({ ...row, changes: row.changes.filter((item) => item.date <= date) }));
    const expenses = payments.filter((row) => row.date <= date);
    const assets = holdings.reduce((sum, row) => sum + holdingValue(row, data, date), 0);
    const debts = totalOutstanding(summarizeLoans({ loans, expenses }, date));
    const value = assets - debts;
    const estimated = holdings
      .filter((row) => isMarket(row, data.settings[0]))
      .some((row) => latestValuation(row.id, data.valuations, date)?.date.slice(0, 7) !== month);
    return { month, assets, debts, netWorth: value, estimated };
  });
}

const inMonth = (date: string, month: string) => date.startsWith(month);
const inRange = (date: string, start: string, end: string) => date >= start && date <= end;
const sumAmount = (rows: { amount: number }[]) => rows.reduce((sum, row) => sum + row.amount, 0);

function activeContributions(data: TrackerData) {
  return data.contributions.filter((row) => !row.skipped);
}

/**
 * What was invested each month out of income received, keyed by YYYY-MM: savings
 * contributions, skipped ones left out, and PF and NPS too, as those come out of salary
 * before it reaches the bank. Only from when tracking began: contributions entered for
 * earlier months, with no income or spending beside them, weren't paid from tracked income.
 */
export function investedFromIncome(data: TrackerData) {
  const fromSalary = new Set(
    data.holdings.filter((row) => row.kind === 'pf' || row.kind === 'nps').map((row) => row.id),
  );
  const since = trackingStart(data);
  const totals = new Map<string, number>();
  if (since === null) return totals;
  for (const row of activeContributions(data)) {
    if (fromSalary.has(row.holdingId)) continue;
    const month = row.date.slice(0, 7);
    if (month < since) continue;
    totals.set(month, roundMoney((totals.get(month) ?? 0) + row.amount));
  }
  return totals;
}

function contributionsOf(data: TrackerData, match: (holding: Holding) => boolean) {
  const ids = new Set(data.holdings.filter(match).map((holding) => holding.id));
  return activeContributions(data).filter((row) => ids.has(row.holdingId));
}

/** Money moved to PMS in a month, which leaves the household balance. */
export const pmsTransfers = (data: TrackerData, month: string) =>
  sumAmount(contributionsOf(data, isPms).filter((row) => inMonth(row.date, month)));

export const HOUSE_EXPENSE = 'Unrecorded house expense';
const HOUSE_EXPENSE_ID = 'house-expense-';
const SAVED_HOUSE_EXPENSE_ID = 'unrecorded-';

/** A house expense worked out from the bank balances, which can't be edited on its own. */
export const isHouseExpense = (row: Pick<Expense, 'id'>) => row.id.startsWith(HOUSE_EXPENSE_ID);

/** The entry a month review saves its house expense under, one per month. */
export const savedHouseExpenseId = (month: string) => `${SAVED_HOUSE_EXPENSE_ID}${month}`;

const isSavedHouseExpense = (row: Pick<Expense, 'id'>) => row.id.startsWith(SAVED_HOUSE_EXPENSE_ID);

/** A house expense, worked out or saved at review: the gap at month end, not spending. */
const isAnyHouseExpense = (row: Pick<Expense, 'id'>) =>
  isHouseExpense(row) || isSavedHouseExpense(row);

/**
 * Records for closing a month. A house expense, worked out or saved at review, is the gap
 * itself, not spending that explains it, so it's left out: the gap, the available balance and
 * the review's signature are the same before and after it's saved.
 */
const forClosing = (data: TrackerData): TrackerData =>
  data.expenses.some(isAnyHouseExpense)
    ? { ...data, expenses: data.expenses.filter((row) => !isAnyHouseExpense(row)) }
    : data;

/**
 * A month's close: what the bank balance should be after income, recorded expenses and
 * everything invested from income, PMS included. What's missing at the closing balance is
 * house expense, spending that was never recorded.
 */
export const closeMonth = (data: TrackerData, month: string) => {
  const records = forClosing(data);
  return monthClose(records, month, investedFromIncome(records).get(month) ?? 0);
};

/** Each month's figures from one pass over the records, for work across many months. */
export function monthCloser(data: TrackerData): (month: string) => MonthClose {
  const records = forClosing(data);
  const totals = monthTotals(records);
  const balances = balancesByMonth(records);
  const invested = investedFromIncome(records);
  return (month) => closeFrom(totals, balances, month, invested.get(month) ?? 0);
}

/**
 * What a month review saves: the month's house expense as an entry on its last day, or
 * null when the bank held as much as expected, or more, or the month isn't closed.
 */
export function houseExpenseToSave(data: TrackerData, month: string): Expense | null {
  const { unrecorded } = closeMonth(data, month);
  if (unrecorded === null || roundMoney(unrecorded) <= 0) return null;
  return {
    id: savedHouseExpenseId(month),
    date: lastDayOfMonth(month),
    category: HOUSE_EXPENSE,
    subcategory: '',
    amount: roundMoney(unrecorded),
    isAnnual: false,
    notes: 'Confirmed at month review, from the bank balances',
  };
}

/**
 * Each closed month's house expense as an expense on its last day, worked out from the
 * household's balances each time, so a forgotten expense added later takes it down again.
 * A closing balance above what was expected adds nothing, and a month whose house expense
 * was saved at review counts the saved entry instead.
 */
export function houseExpenses(household: TrackerData): Expense[] {
  const closeOf = monthCloser(household);
  const saved = new Set(household.expenses.filter(isSavedHouseExpense).map((row) => row.id));
  return household.monthlyBalances.flatMap(({ month }) => {
    if (saved.has(savedHouseExpenseId(month))) return [];
    const { unrecorded } = closeOf(month);
    if (unrecorded === null || roundMoney(unrecorded) <= 0) return [];
    return [
      {
        id: `${HOUSE_EXPENSE_ID}${month}`,
        date: lastDayOfMonth(month),
        category: HOUSE_EXPENSE,
        subcategory: 'Not recorded, from bank balances',
        amount: roundMoney(unrecorded),
        isAnnual: false,
      },
    ];
  });
}

/** Records for working out spending: recorded expenses and each month's house expense. */
export function withHouseExpenses(view: TrackerData, household: TrackerData): TrackerData {
  const derived = houseExpenses(household);
  return derived.length === 0 ? view : { ...view, expenses: [...view.expenses, ...derived] };
}

export interface BalanceHistoryRow {
  month: string;
  opening: number;
  income: number;
  expenses: number;
  /** Invested from income, PMS included, which leaves the bank. */
  invested: number;
  surplus: number;
  houseExpense: number | null;
}

/** Completed months of a financial year that have a recorded balance, newest first. */
export function balanceHistory(data: TrackerData, fy: number, today: string): BalanceHistoryRow[] {
  const { start, end } = financialYearRange(fy);
  const current = today.slice(0, 7);
  const closeOf = monthCloser(data);
  const invested = investedFromIncome(data);
  return data.monthlyBalances
    .filter(({ month }) => month < current && inRange(`${month}-01`, start, end))
    .map(({ month, startBalance }) => {
      const close = closeOf(month);
      return {
        month,
        opening: startBalance,
        income: close.income,
        expenses: close.expenses,
        invested: invested.get(month) ?? 0,
        surplus: close.available,
        houseExpense: close.unrecorded,
      };
    })
    .sort((a, b) => b.month.localeCompare(a.month));
}

/** The current financial year, and any earlier one with a recorded balance. */
export function balanceYears(data: TrackerData, today: string) {
  const current = financialYearStart(today);
  const years = data.monthlyBalances.map(({ month }) => financialYearStart(month));
  return [...new Set([current, ...years])].filter((year) => year <= current).sort((a, b) => b - a);
}

/** Principal repaid across loans within a period, from each loan's replayed history. */
function principalRepaid(data: TrackerData, today: string, match: (date: string) => boolean) {
  let total = 0;
  for (const loan of data.loans) {
    const payments = loanPayments(data.expenses, loan.id);
    const ledger = rebuildLoan(loan, payments, { asOf: today });
    if (isLoanFailure(ledger)) continue;
    const dates = new Map(payments.map((row) => [row.id, row.date]));
    for (const split of ledger.payments) {
      if (match(dates.get(split.id) ?? '')) total += split.principalPaid;
    }
  }
  return total;
}

/** The first month with income or spending recorded: when someone started tracking. */
export function trackingStart(data: Pick<TrackerData, 'income' | 'expenses'>) {
  return [...data.income, ...data.expenses].map((row) => row.date.slice(0, 7)).sort()[0] ?? null;
}

/**
 * Savings contributions per month: this financial year's contributions over the months that
 * have any, counting only from when tracking began, so contributions entered for earlier
 * months don't inflate it. Withdrawals aren't taken off: this is what was put in.
 */
export function averageContributions(data: TrackerData, month: string) {
  const { start, end } = financialYearRange(financialYearStart(month));
  const since = trackingStart(data);
  const from = since && `${since}-01` > start ? `${since}-01` : start;
  const rows = activeContributions(data).filter((row) => inRange(row.date, from, end));
  const months = new Set(rows.map((row) => row.date.slice(0, 7))).size;
  return months > 0 ? sumAmount(rows) / months : 0;
}

export function monthlyOverview(data: TrackerData, month: string, today: string) {
  const fy = financialYearStart(month);
  const { start, end } = financialYearRange(fy);
  const close = closeMonth(data, month);
  const savings = (rows: { date: string; amount: number }[], from: string, to: string) =>
    sumAmount(rows.filter((row) => inRange(row.date, from, to)));
  const contributions = activeContributions(data);
  const previous = previousMonth(month);
  const distinctMonths = (rows: { date: string }[]) =>
    new Set(rows.filter((row) => inRange(row.date, start, end)).map((row) => row.date.slice(0, 7)))
      .size;
  const average = (rows: { date: string; amount: number }[]) => {
    const months = distinctMonths(rows);
    return months > 0 ? savings(rows, start, end) / months : 0;
  };
  const totals = monthTotals(data);
  const prior = totals.get(previous);
  const current = totals.get(month);
  return {
    close,
    /**
     * Everything spent in the month, a saved house expense included. The close leaves that
     * entry out, as it is the gap at month end rather than spending that explains it.
     */
    spent: roundMoney(current?.expenses ?? 0),
    savings: sumAmount(contributions.filter((row) => inMonth(row.date, month))),
    averageIncome: average(data.income),
    averageExpenses: average(data.expenses),
    averageSavings: averageContributions(data, month),
    previous,
    spendingChange: current && prior ? current.expenses - prior.expenses : null,
    principalRepaid: principalRepaid(data, today, (date) => inMonth(date, month)),
  };
}

/** PMS gain change needs a valuation on or before each month's end. */
export function pmsGainChange(data: TrackerData, month: string) {
  const pms = data.holdings.filter(isPms);
  if (pms.length === 0) return null;
  const endOf = (key: string) => `${key}-31`;
  const gainAt = (date: string) =>
    pms.reduce((sum, holding) => {
      const { gain } = holdingPosition(holding, data, date);
      return sum + gain;
    }, 0);
  const dated = data.valuations.filter((row) => pms.some((item) => item.id === row.holdingId));
  const hasOpening = dated.some((row) => row.date <= endOf(previousMonth(month)));
  const hasClosing = dated.some((row) => inMonth(row.date, month));
  if (!hasOpening || !hasClosing) return null;
  return gainAt(endOf(month)) - gainAt(endOf(previousMonth(month)));
}

export function financialYearsWithData(data: TrackerData, today: string) {
  const years = new Set([financialYearStart(today)]);
  for (const row of [...data.income, ...data.expenses]) years.add(financialYearStart(row.date));
  return [...years].sort((a, b) => b - a);
}

export function financialSummary(data: TrackerData, fy: number, today: string) {
  const { start, end } = financialYearRange(fy);
  const within = <Row extends { date: string }>(rows: Row[]) =>
    rows.filter((row) => inRange(row.date, start, end));
  const income = sumAmount(within(data.income));
  const expenses = sumAmount(within(data.expenses));
  const contributions = within(activeContributions(data));
  const pms = sumAmount(within(contributionsOf(data, isPms)));
  const npsPpf = sumAmount(
    within(contributionsOf(data, (row) => row.kind === 'nps' || row.kind === 'ppf')),
  );
  const rows = holdingRows(data, today);
  const months = (items: { date: string }[]) =>
    new Set(within(items).map((row) => row.date.slice(0, 7))).size;
  const average = (total: number, count: number) => (count > 0 ? total / count : 0);
  const contributed = sumAmount(contributions);
  return {
    income,
    expenses,
    surplus: income - expenses,
    returns: rows.reduce((sum, row) => sum + row.position.gain, 0),
    retirement: rows
      .filter((row) => row.holding.kind !== 'investment')
      .reduce((sum, row) => sum + row.position.current, 0),
    contributions: contributed,
    pms,
    npsPpf,
    remaining: income - expenses - pms - npsPpf,
    incomeMonths: months(data.income),
    expenseMonths: months(data.expenses),
    contributionMonths: months(contributions),
    averageIncome: average(income, months(data.income)),
    averageExpenses: average(expenses, months(data.expenses)),
    averageContributions: average(contributed, months(contributions)),
    expenseRatio: income > 0 ? expenses / income : null,
  };
}

/** Each recorded month's opening balance within a financial year. */
export function balanceTrend(data: TrackerData, fy: number) {
  const { start, end } = financialYearRange(fy);
  return data.monthlyBalances
    .filter((row) => inRange(`${row.month}-01`, start, end))
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((row) => ({ month: row.month, value: row.startBalance }));
}

export function pmsGainTrend(data: TrackerData) {
  const pms = data.holdings.filter(isPms);
  const dates = [
    ...new Set(
      data.valuations
        .filter((row) => pms.some((item) => item.id === row.holdingId))
        .map((row) => row.date),
    ),
  ].sort();
  return dates.map((date) => ({
    month: date.slice(0, 7),
    value: pms.reduce((sum, holding) => sum + holdingPosition(holding, data, date).gain, 0),
  }));
}

export function debtProgress(data: TrackerData, today: string) {
  const loans = summarizeLoans(data, today);
  const remaining = totalOutstanding(loans);
  const borrowed = loans.reduce((sum, loan) => sum + (loan.ledger?.totalPrincipal ?? 0), 0);
  const paid = Math.max(0, borrowed - remaining);
  return { paid, remaining, paidShare: borrowed > 0 ? paid / borrowed : 0 };
}

export interface MemberPosition {
  member: string;
  invested: number;
  current: number;
  gain: number;
}

export function memberPositions(rows: PositionRow[]): MemberPosition[] {
  const totals = new Map<string, MemberPosition>();
  for (const { holding, position } of rows) {
    const entry = totals.get(holding.member) ?? {
      member: holding.member,
      invested: 0,
      current: 0,
      gain: 0,
    };
    entry.invested += position.invested;
    entry.current += position.current;
    entry.gain += position.gain;
    totals.set(holding.member, entry);
  }
  return [...totals.values()].sort((a, b) => b.current - a.current);
}

/** Recorded expenses plus unrecorded house spending, once a month's balances are known. */
export function fullHouseExpense(data: TrackerData, month: string) {
  const close = closeMonth(data, month);
  return close.unrecorded === null ? close.expenses : close.expenses + close.unrecorded;
}

export function memberContributions(data: TrackerData, fy: number) {
  const { start, end } = financialYearRange(fy);
  const totals = new Map<string, number>();
  for (const holding of data.holdings) {
    for (const row of holdingContributions(holding.id, data.contributions)) {
      if (inRange(row.date, start, end)) {
        totals.set(holding.member, (totals.get(holding.member) ?? 0) + row.amount);
      }
    }
  }
  return [...totals].map(([member, amount]) => ({ member, amount }));
}

/**
 * What a review was signed against. Kept on the figures it always used, PMS alone taken
 * out, so months reviewed before investing was counted aren't marked as changed.
 */
export function monthSigner(household: TrackerData): (month: string) => string {
  const data = forClosing(household);
  const totals = monthTotals(data);
  const balances = balancesByMonth(data);
  const transfers = new Map<string, number>();
  for (const row of contributionsOf(data, isPms)) {
    const month = row.date.slice(0, 7);
    transfers.set(month, (transfers.get(month) ?? 0) + row.amount);
  }
  return (month) => JSON.stringify(closeFrom(totals, balances, month, transfers.get(month) ?? 0));
}

export const monthSignature = (data: TrackerData, month: string) => monthSigner(data)(month);

export function monthReviewStatus(data: TrackerData, month: string) {
  const review = data.monthReviews.find((row) => row.month === month);
  if (!review) return { reviewed: false, changed: false, reviewedAt: null };
  const same = review.signature === monthSignature(data, month);
  return { reviewed: same, changed: !same, reviewedAt: review.reviewedAt };
}

/** Holdings whose value nobody has confirmed against a statement yet. */
export const unverifiedHoldings = (data: TrackerData) =>
  data.holdings.filter((holding) => !latestValuation(holding.id, data.valuations));

export function valuationAge(holdingId: string, data: TrackerData, today: string) {
  const valuation = latestValuation(holdingId, data.valuations);
  if (!valuation) return 'Unverified';
  const days = toDayNumber(today) - toDayNumber(valuation.date);
  if (days < 0) return 'Invalid future date';
  return `${valuation.date} · ${days} days ago`;
}

/** Scheduled contributions this month that no one has checked against a statement. */
export function uncheckedContributions(data: TrackerData, month: string) {
  const ids = new Set(data.holdings.map((holding) => holding.id));
  return activeContributions(data).filter(
    (row) => row.automatic && !row.confirmed && ids.has(row.holdingId) && inMonth(row.date, month),
  );
}

/** Cloud sync this recent means the records are already safe. */
const SYNC_COVERS_DAYS = 7;

export function syncedRecently(syncedOn: string | null, today: string) {
  return syncedOn !== null && toDayNumber(today) - toDayNumber(syncedOn) < SYNC_COVERS_DAYS;
}

/** Reminds someone to export when records exist, the last backup is old and sync has lapsed. */
export function backupStatus(data: TrackerData, today: string, syncedOn: string | null = null) {
  const settings = data.settings[0];
  const days = settings?.backupReminderDays ?? 30;
  const last = settings?.lastBackupOn;
  const age = last ? toDayNumber(today) - toDayNumber(last) : null;
  const hasRecords = data.income.length + data.expenses.length + data.holdings.length > 0;
  return {
    due:
      days > 0 && hasRecords && (age === null || age >= days) && !syncedRecently(syncedOn, today),
    label: age === null ? 'No backup exported yet' : `Last backup was ${age} days ago`,
  };
}

/** Tells the destination page which review to open. */
export type AttentionTarget =
  | { review: string }
  | { panel: 'data' | 'family' }
  | { confirm: true }
  | { commitments: true }
  | { open: string };

export interface AttentionItem {
  label: string;
  path: string;
  state: AttentionTarget;
  /** An EMI that can be marked as paid here: due soon, or missed and so not to be hidden. */
  emi?: { loanId: string; date: string; missed: boolean };
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const needs = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? ' needs' : 's need'}`;

/** Things that need a look, shown as the dashboard's attention bar. */
export const isMonthEnd = (today: string) => today === lastDayOfMonth(today.slice(0, 7));

/** Months missing a balance or a review, newest first. */
export function monthsToReview(household: TrackerData, today: string) {
  const current = today.slice(0, 7);
  const closeOf = monthCloser(household);
  const signatureOf = monthSigner(household);
  const reviews = new Map(
    [...household.monthReviews].reverse().map((row) => [row.month, row.signature]),
  );
  const recorded = new Set(household.monthlyBalances.map((row) => row.month));
  const first = [...recorded].sort()[0];
  const months = [...monthTotals(household).keys()].filter(
    (month) => month <= current && (!first || month >= first),
  );
  return [...new Set([...months, ...recorded])]
    .filter((month) => month <= current)
    .filter((month) => {
      const close = closeOf(month);
      // A running month only needs its opening balance until its last day.
      if (month === current && !isMonthEnd(today)) return close.opening === null;
      return !close.complete || reviews.get(month) !== signatureOf(month);
    })
    .sort()
    .reverse();
}

/** `view` is the selected profile's records. Bank balances belong to the whole household. */
export function attentionItems(
  view: TrackerData,
  household: TrackerData,
  today: string,
  pendingRecurring: number,
  syncedOn: string | null = null,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const current = today.slice(0, 7);
  const incomplete = monthsToReview(household, today);
  const [latest] = incomplete;
  if (latest) {
    items.push({
      label: `${needs(incomplete.length, 'household month')} balance review`,
      path: '/cash-flow',
      state: { review: latest },
    });
  }
  for (const { loanId, name, date } of emiReminders(view, today)) {
    items.push({
      label: `${name} EMI due ${date === today ? 'today' : 'tomorrow'}`,
      path: '/cash-flow',
      state: { commitments: true },
      emi: { loanId, date, missed: false },
    });
  }
  for (const { loanId, name, date } of missedEmis(view, today, trackingStart(view))) {
    items.push({
      label: `${name} EMI for ${MONTH_NAMES[Number(date.slice(5, 7)) - 1]} isn't recorded`,
      path: '/cash-flow',
      state: { commitments: true },
      emi: { loanId, date, missed: true },
    });
  }
  if (addDays(today, 1) === lastDayOfMonth(current)) {
    items.push({
      label: 'Month-end review is tomorrow',
      path: '/cash-flow',
      state: { commitments: true },
    });
  }
  // Asked for from the 1st, and stays until this month's value is in.
  const pmsOutOfDate = view.holdings.filter(isPms).some((holding) => {
    if (holding.date.slice(0, 7) >= current) return false;
    const valuation = latestValuation(holding.id, view.valuations, today);
    return valuation?.date.slice(0, 7) !== current;
  });
  if (pmsOutOfDate) {
    items.push({
      label: `Update ${PMS_TYPE} current value`,
      path: '/investments',
      state: { open: PMS_TYPE },
    });
  }
  const backup = backupStatus(household, today, syncedOn);
  if (backup.due) {
    items.push({ label: backup.label, path: '/settings', state: { panel: 'data' } });
  }
  const unverified = unverifiedHoldings(view).length;
  if (unverified > 0) {
    items.push({
      label: `${needs(unverified, 'valuation')} confirmation`,
      path: '/investments',
      state: { confirm: true },
    });
  }
  const unchecked = uncheckedContributions(view, current).length;
  if (unchecked > 0 && today === lastDayOfMonth(current)) {
    items.push({
      label: `${unchecked} automatic ${unchecked === 1 ? 'entry needs' : 'entries need'} a statement check`,
      path: '/cash-flow',
      state: { review: current },
    });
  }
  if (pendingRecurring > 0) {
    items.push({
      label: `${pendingRecurring} recurring item${pendingRecurring === 1 ? '' : 's'} due`,
      path: '/cash-flow',
      state: { commitments: true },
    });
  }
  return items;
}

export const isEmi = (row: { category: string }) => row.category === EMI_CATEGORY;

export const assumptionKeys = (settings: TrackerSettings) => Object.keys(settings.returns);
