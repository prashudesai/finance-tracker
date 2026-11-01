import type { TrackerData } from '../data/repository';
import { EMI_CATEGORY, PMS_TYPE, type Holding, type TrackerSettings } from '../schema/records';
import {
  financialYearRange,
  financialYearStart,
  lastDayOfMonth,
  previousMonth,
  toDayNumber,
} from './calendar';
import { monthClose, monthTotals } from './cashflow';
import {
  holdingContributions,
  holdingPosition,
  latestValuation,
  type HoldingPosition,
} from './holdings';
import { isLoanFailure } from './loan';
import { summarizeLoans, totalOutstanding } from './summary';
import { rebuildLoan } from './loan';
import { loanPayments } from './recurring';

export const isPms = (holding: Holding) => holding.type === PMS_TYPE;

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

const inMonth = (date: string, month: string) => date.startsWith(month);
const inRange = (date: string, start: string, end: string) => date >= start && date <= end;
const sumAmount = (rows: { amount: number }[]) => rows.reduce((sum, row) => sum + row.amount, 0);

function activeContributions(data: TrackerData) {
  return data.contributions.filter((row) => !row.skipped);
}

function contributionsOf(data: TrackerData, match: (holding: Holding) => boolean) {
  const ids = new Set(data.holdings.filter(match).map((holding) => holding.id));
  return activeContributions(data).filter((row) => ids.has(row.holdingId));
}

/** Money moved to PMS in a month, which leaves the household balance. */
export const pmsTransfers = (data: TrackerData, month: string) =>
  sumAmount(contributionsOf(data, isPms).filter((row) => inMonth(row.date, month)));

export const closeMonth = (data: TrackerData, month: string) =>
  monthClose(data, month, pmsTransfers(data, month));

const isRetirement = (holding: Holding) => holding.kind === 'nps' || holding.kind === 'ppf';

export interface BalanceHistoryRow {
  month: string;
  opening: number;
  income: number;
  expenses: number;
  pms: number;
  /** NPS and PPF are tracked separately, so they don't change the surplus. */
  retirement: number;
  surplus: number;
  houseExpense: number | null;
}

/** Completed months of a financial year that have a recorded balance, newest first. */
export function balanceHistory(data: TrackerData, fy: number, today: string): BalanceHistoryRow[] {
  const { start, end } = financialYearRange(fy);
  const current = today.slice(0, 7);
  return data.monthlyBalances
    .filter(({ month }) => month < current && inRange(`${month}-01`, start, end))
    .map(({ month, startBalance }) => {
      const close = closeMonth(data, month);
      return {
        month,
        opening: startBalance,
        income: close.income,
        expenses: close.expenses,
        pms: pmsTransfers(data, month),
        retirement: sumAmount(
          contributionsOf(data, isRetirement).filter((row) => inMonth(row.date, month)),
        ),
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
    savings: sumAmount(contributions.filter((row) => inMonth(row.date, month))),
    averageIncome: average(data.income),
    averageExpenses: average(data.expenses),
    averageSavings: average(contributions),
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

export const monthSignature = (data: TrackerData, month: string) =>
  JSON.stringify(closeMonth(data, month));

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

export interface AttentionItem {
  label: string;
  path: string;
}

const needs = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? ' needs' : 's need'}`;

/** Things that need a look, shown as the dashboard's attention bar. */
export function attentionItems(
  data: TrackerData,
  today: string,
  pendingRecurring: number,
  syncedOn: string | null = null,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const current = today.slice(0, 7);
  const recorded = new Set(data.monthlyBalances.map((row) => row.month));
  const first = [...recorded].sort()[0];
  const months = [...monthTotals(data).keys()].filter(
    (month) => month <= current && (!first || month >= first),
  );
  const incomplete = [...new Set([...months, ...recorded])]
    .filter((month) => month <= current)
    .filter((month) => {
      const close = closeMonth(data, month);
      if (month === current) return close.opening === null;
      return !close.complete || !monthReviewStatus(data, month).reviewed;
    });
  if (incomplete.length > 0) {
    items.push({
      label: `${needs(incomplete.length, 'household month')} balance review`,
      path: '/cash-flow',
    });
  }
  const backup = backupStatus(data, today, syncedOn);
  if (backup.due) items.push({ label: backup.label, path: '/settings' });
  const unverified = unverifiedHoldings(data).length;
  if (unverified > 0) {
    items.push({ label: `${needs(unverified, 'valuation')} confirmation`, path: '/investments' });
  }
  const unchecked = uncheckedContributions(data, current).length;
  if (unchecked > 0 && today === lastDayOfMonth(current)) {
    items.push({
      label: `${unchecked} automatic ${unchecked === 1 ? 'entry needs' : 'entries need'} a statement check`,
      path: '/cash-flow',
    });
  }
  if (pendingRecurring > 0) {
    items.push({
      label: `${pendingRecurring} recurring item${pendingRecurring === 1 ? '' : 's'} due`,
      path: '/cash-flow',
    });
  }
  return items;
}

export const isEmi = (row: { category: string }) => row.category === EMI_CATEGORY;

export const assumptionKeys = (settings: TrackerSettings) => Object.keys(settings.returns);
