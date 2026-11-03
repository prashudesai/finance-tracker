import {
  EMI_CATEGORY,
  type Expense,
  type Income,
  type Loan,
  type RecurringOccurrence,
  type RecurringRule,
} from '../schema/records';
import { dayInMonth, isValidMonth, nextMonth, roundMoney, toDayNumber } from './calendar';
import { isLoanFailure, quotePayment, rebuildLoan } from './loan';

const MAX_MONTHS_PER_RULE = 3600;
const MIN_DAYS_BEFORE_FIRST_EMI = 30;

export interface RecurringData {
  rules: RecurringRule[];
  occurrences: RecurringOccurrence[];
  income: Income[];
  expenses: Expense[];
  loans: Loan[];
}

export interface PendingOccurrence {
  ruleId: string;
  month: string;
  date: string;
  amount: number | undefined;
  missed: boolean;
  /** An existing record this occurrence would be matched to. */
  existing: string | null;
}

export interface OccurrenceRequest {
  ruleId: string;
  month: string;
  skip?: boolean;
  amount?: number;
}

const occurrenceKey = (ruleId: string, month: string) => `${ruleId}|${month}`;

export const loanPayments = (expenses: Expense[], loanId: string) =>
  expenses.filter((row) => row.category === EMI_CATEGORY && row.loanId === loanId);

export function amountAt(rule: RecurringRule, month: string) {
  if (rule.kind === 'emi') return undefined;
  let { amount } = rule;
  for (const change of rule.amountChanges) if (change.month <= month) amount = change.amount;
  return amount;
}

interface MatchIndex {
  byMonth: Map<string, (Income | Expense)[]>;
  claimedBy: Map<string, Set<string>>;
}

function buildMatchIndex({ occurrences, income, expenses }: RecurringData): MatchIndex {
  const byMonth = new Map<string, (Income | Expense)[]>();
  const claimedBy = new Map<string, Set<string>>();
  for (const occurrence of occurrences) {
    if (!occurrence.recordId) continue;
    const claims = claimedBy.get(occurrence.recordId) ?? new Set();
    claimedBy.set(occurrence.recordId, claims.add(occurrence.ruleId));
  }
  const add = (kind: string, rows: (Income | Expense)[]) => {
    for (const row of rows) {
      const key = `${kind}|${row.date.slice(0, 7)}`;
      const list = byMonth.get(key);
      if (list) list.push(row);
      else byMonth.set(key, [row]);
    }
  };
  add('income', income);
  add('expense', expenses);
  return { byMonth, claimedBy };
}

function ruleMatchesRow(rule: RecurringRule, row: Income | Expense, month: string) {
  if (rule.kind === 'income') {
    return 'source' in row && row.member === rule.member && row.source === rule.source;
  }
  if (!('category' in row)) return false;
  if (rule.kind === 'emi') {
    return (
      row.category === EMI_CATEGORY &&
      row.loanId === rule.loanId &&
      row.repaymentType !== 'part-payment'
    );
  }
  return (
    row.category === rule.category &&
    row.subcategory === rule.subcategory &&
    Math.abs(row.amount - (amountAt(rule, month) ?? 0)) < 0.011
  );
}

function findMatch(rule: RecurringRule, month: string, index: MatchIndex) {
  const kind = rule.kind === 'income' ? 'income' : 'expense';
  return (index.byMonth.get(`${kind}|${month}`) ?? []).find(
    (row) =>
      !row.recurringRuleId &&
      ruleMatchesRow(rule, row, month) &&
      ![...(index.claimedBy.get(row.id) ?? [])].some((ruleId) => ruleId !== rule.id),
  );
}

export function pendingOccurrences(data: RecurringData, today: string): PendingOccurrence[] {
  const current = today.slice(0, 7);
  const seen = new Set(data.occurrences.map((row) => occurrenceKey(row.ruleId, row.month)));
  const index = buildMatchIndex(data);
  const loans = new Map(data.loans.map((loan) => [loan.id, loan]));
  const rows: PendingOccurrence[] = [];

  const hasBalance = (loan: Loan) => {
    const ledger = rebuildLoan(loan, loanPayments(data.expenses, loan.id), { asOf: today });
    return !isLoanFailure(ledger) && ledger.remaining > 0;
  };

  for (const rule of data.rules) {
    if (rule.paused) continue;
    const loan = rule.kind === 'emi' ? loans.get(rule.loanId) : undefined;
    if (rule.kind === 'emi' && !(loan && hasBalance(loan))) continue;

    let month = rule.startMonth;
    for (
      let count = 0;
      month <= current && (!rule.endMonth || month <= rule.endMonth) && count < MAX_MONTHS_PER_RULE;
      count++, month = nextMonth(month)
    ) {
      const date = dayInMonth(month, rule.day);
      if (seen.has(occurrenceKey(rule.id, month)) || date > today) continue;
      if (loan) {
        const eligible = loan.firstEmiDate
          ? date >= loan.firstEmiDate
          : toDayNumber(date) - toDayNumber(loan.date) >= MIN_DAYS_BEFORE_FIRST_EMI;
        if (!eligible) continue;
      }
      rows.push({
        ruleId: rule.id,
        month,
        date,
        amount: amountAt(rule, month),
        missed: month < current,
        existing: findMatch(rule, month, index)?.id ?? null,
      });
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.ruleId.localeCompare(b.ruleId));
}

/** Checks links between rules, occurrences and records that per-record schemas cannot see. */
export function validateRecurring(data: RecurringData) {
  const ruleIds = new Set<string>();
  const activeLoans = new Set<string>();
  for (const rule of data.rules) {
    if (ruleIds.has(rule.id)) throw new Error('Invalid recurring item.');
    ruleIds.add(rule.id);
    if (rule.endMonth && rule.endMonth < rule.startMonth) {
      throw new Error('Recurring end month must follow the start month.');
    }
    if (rule.kind !== 'emi') {
      let last = '';
      for (const change of rule.amountChanges) {
        if (!isValidMonth(change.month) || change.month <= last || change.month < rule.startMonth) {
          throw new Error('Invalid recurring amount change.');
        }
        last = change.month;
      }
    } else if (!rule.paused) {
      if (activeLoans.has(rule.loanId)) {
        throw new Error('Only one active recurring EMI is allowed per loan.');
      }
      activeLoans.add(rule.loanId);
    }
  }

  const occurrences = new Map<string, RecurringOccurrence>();
  for (const occurrence of data.occurrences) {
    const key = occurrenceKey(occurrence.ruleId, occurrence.month);
    if (!ruleIds.has(occurrence.ruleId) || occurrences.has(key)) {
      throw new Error('Invalid recurring occurrence.');
    }
    occurrences.set(key, occurrence);
  }

  const recordKeys = new Set<string>();
  for (const row of [...data.income, ...data.expenses]) {
    if (row.recurringRuleId === undefined && row.recurringMonth === undefined) continue;
    const key = occurrenceKey(row.recurringRuleId ?? '', row.recurringMonth ?? '');
    if (
      !ruleIds.has(row.recurringRuleId ?? '') ||
      row.date.slice(0, 7) !== row.recurringMonth ||
      recordKeys.has(key)
    ) {
      throw new Error('Invalid or duplicate recurring record.');
    }
    recordKeys.add(key);
    const occurrence = occurrences.get(key);
    if (occurrence?.status !== 'posted' || occurrence.recordId !== row.id) {
      throw new Error('Recurring record is missing its occurrence history.');
    }
  }
}

/** Posts, matches or skips the requested occurrences. Returns new data; the input is unchanged. */
export function applyOccurrences(
  input: RecurringData,
  requests: OccurrenceRequest[],
  today: string,
) {
  const data = structuredClone(input);
  validateRecurring(data);
  const due = pendingOccurrences(data, today);
  const errors: string[] = [];
  const handled = new Set<string>();
  let changed = 0;

  const ordered = [...requests].sort(
    (a, b) => a.month.localeCompare(b.month) || a.ruleId.localeCompare(b.ruleId),
  );
  for (const request of ordered) {
    const key = occurrenceKey(request.ruleId, request.month);
    if (handled.has(key)) continue;
    handled.add(key);

    const candidate = due.find(
      (row) => row.ruleId === request.ruleId && row.month === request.month,
    );
    const rule = data.rules.find((row) => row.id === request.ruleId);
    if (!candidate || !rule) continue;
    const record = (status: RecurringOccurrence['status'], recordId?: string) => {
      data.occurrences.push({
        ruleId: rule.id,
        month: request.month,
        status,
        ...(recordId === undefined ? {} : { recordId }),
      });
      changed++;
    };

    if (request.skip) {
      record('skipped');
      continue;
    }
    const earlierOpen = due.some(
      (row) =>
        row.ruleId === rule.id &&
        row.month < request.month &&
        !data.occurrences.some((item) => item.ruleId === rule.id && item.month === row.month),
    );
    if (rule.kind === 'emi' && earlierOpen) {
      errors.push(`${rule.name}: review earlier missed payments first.`);
      continue;
    }
    const existing = findMatch(rule, request.month, buildMatchIndex(data));
    if (existing) {
      record('matched', existing.id);
      continue;
    }

    const amount = request.amount ?? amountAt(rule, request.month);
    if (rule.kind !== 'emi' && !(amount && roundMoney(amount) > 0 && amount <= 1e12)) {
      errors.push(`${rule.name}: enter a positive amount.`);
      continue;
    }
    const id = `rec_${rule.id}_${request.month.replace('-', '')}`;
    if ([...data.income, ...data.expenses].some((row) => row.id === id)) {
      errors.push(`${rule.name}: recurring record ID already exists.`);
      continue;
    }
    const meta = {
      id,
      date: candidate.date,
      recurringRuleId: rule.id,
      recurringMonth: request.month,
      notes: `${rule.name} · Monthly recurring`,
    };

    if (rule.kind === 'income') {
      const { member, source } = rule;
      data.income.push({ ...meta, member, source, amount: roundMoney(amount ?? 0) });
    } else if (rule.kind === 'expense') {
      const { category, subcategory, isAnnual } = rule;
      data.expenses.push({
        ...meta,
        category,
        subcategory,
        isAnnual,
        amount: roundMoney(amount ?? 0),
      });
    } else {
      const loan = data.loans.find((row) => row.id === rule.loanId);
      if (!loan) continue;
      const payments = loanPayments(data.expenses, loan.id);
      const quote = quotePayment(loan, payments, candidate.date);
      if (isLoanFailure(quote)) {
        errors.push(`${rule.name}: ${quote.error}`);
        continue;
      }
      if (quote.paidOff) {
        record('skipped');
        continue;
      }
      const row: Expense = {
        ...meta,
        category: EMI_CATEGORY,
        subcategory: '',
        isAnnual: false,
        loanId: loan.id,
        repaymentType: 'emi',
        amount: quote.amount,
      };
      const rebuilt = rebuildLoan(loan, [...payments, row], { asOf: today });
      if (isLoanFailure(rebuilt)) {
        errors.push(`${rule.name}: ${rebuilt.error}`);
        continue;
      }
      data.expenses.push(row);
    }
    record('posted', id);
  }
  validateRecurring(data);
  return { data, changed, errors };
}

/**
 * Ends schedules. Rules with history are kept, paused and archived so their records
 * stay explained; rules with no history are removed.
 */
export function stopSchedules(
  data: RecurringData,
  matches: (rule: RecurringRule) => boolean,
  month: string,
): RecurringData {
  const hasHistory = (rule: RecurringRule) =>
    data.occurrences.some((row) => row.ruleId === rule.id) ||
    [...data.income, ...data.expenses].some((row) => row.recurringRuleId === rule.id);
  const removed = new Set(
    data.rules.filter((rule) => matches(rule) && !hasHistory(rule)).map((rule) => rule.id),
  );
  return {
    ...data,
    rules: data.rules
      .filter((rule) => !removed.has(rule.id))
      .map((rule) =>
        matches(rule)
          ? { ...rule, paused: true, archived: true, pausedFrom: rule.pausedFrom ?? month }
          : rule,
      ),
    occurrences: data.occurrences.filter((row) => !removed.has(row.ruleId)),
  };
}

/**
 * Applies a new amount from `month` on. Earlier months keep the old amount, so past
 * records stay explained.
 */
export function withAmountChange<Rule extends Extract<RecurringRule, { amount: number }>>(
  rule: Rule,
  amount: number,
  month: string,
): Rule {
  if (amountAt(rule, month) === amount) return rule;
  const earlier = rule.amountChanges.filter((change) => change.month < month);
  if (month <= rule.startMonth) return { ...rule, amount, amountChanges: earlier };
  return { ...rule, amountChanges: [...earlier, { month, amount }] };
}

export interface UpcomingCommitment {
  ruleId: string;
  name: string;
  date: string;
  amount: number;
  kind: RecurringRule['kind'];
}

/** Scheduled money in the coming days, soonest first. Nothing here is posted yet. */
export function upcomingCommitments(
  data: RecurringData,
  today: string,
  horizon: string,
): UpcomingCommitment[] {
  const loans = new Map(data.loans.map((loan) => [loan.id, loan]));
  const rows: UpcomingCommitment[] = [];
  for (const rule of data.rules) {
    if (rule.paused) continue;
    let month = rule.startMonth < today.slice(0, 7) ? today.slice(0, 7) : rule.startMonth;
    while (month <= horizon.slice(0, 7) && (!rule.endMonth || month <= rule.endMonth)) {
      const date = dayInMonth(month, rule.day);
      if (date > today && date <= horizon) {
        let amount = amountAt(rule, month);
        if (rule.kind === 'emi') {
          const loan = loans.get(rule.loanId);
          const quote = loan && quotePayment(loan, loanPayments(data.expenses, loan.id), date);
          amount = quote && !isLoanFailure(quote) && !quote.paidOff ? quote.amount : undefined;
        }
        if (amount !== undefined) {
          rows.push({ ruleId: rule.id, name: rule.name, date, amount, kind: rule.kind });
        }
      }
      month = nextMonth(month);
    }
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
}
