import type { Expense, Loan, LoanChange } from '../schema/records';
import {
  fromDayNumber,
  isValidDate,
  monthlyAnniversary,
  roundMoney,
  toDayNumber,
} from './calendar';

export type LoanPayment = Pick<
  Expense,
  | 'id'
  | 'date'
  | 'amount'
  | 'notes'
  | 'repaymentType'
  | 'partPaymentAction'
  | 'interestOverride'
  | 'interestPaid'
>;

export interface PaymentSplit {
  id: string;
  principalPaid: number;
  interestPaid: number;
}

export interface LoanHistoryEntry {
  id: string;
  balance: number;
  rate: number;
  emi: number;
  beforeBalance: number;
  beforeRate: number;
  beforeEmi: number;
  oldTerm?: number | null;
  newTerm?: number | null;
  repaymentChoice?: LoanChange['repaymentChoice'];
}

export interface InterestCapitalization {
  date: string;
  amount: number;
}

export interface LoanLedger {
  remaining: number;
  interestPaid: number;
  accruedInterest: number;
  rate: number;
  emi: number;
  payments: PaymentSplit[];
  history: LoanHistoryEntry[];
  totalPrincipal: number;
  interestCapitalizations: InterestCapitalization[];
  quoteAmount?: number;
}

export interface LoanFailure {
  error: string;
}

export const isLoanFailure = (result: object): result is LoanFailure => 'error' in result;

interface RepaymentSchedule {
  /** Whole instalments left. Null when the EMI does not cover the interest. */
  count: number | null;
  months: number;
  final: number;
}

type TimelineEvent =
  | { kind: 'change'; date: string; id: string; priority: number; change: LoanChange }
  | { kind: 'payment'; date: string; id: string; priority: number; payment: LoanPayment };

/** Same-day order: terms change first, then part payments, then EMIs. */
function timeline(changes: LoanChange[], payments: LoanPayment[]) {
  const events: TimelineEvent[] = [
    ...changes.map((change): TimelineEvent => ({
      kind: 'change',
      date: change.date,
      id: change.id,
      priority: 0,
      change,
    })),
    ...payments.map((payment): TimelineEvent => ({
      kind: 'payment',
      date: payment.date,
      id: payment.id,
      priority: payment.repaymentType === 'part-payment' ? 1 : 2,
      payment,
    })),
  ];
  return events.sort(
    (a, b) => a.date.localeCompare(b.date) || a.priority - b.priority || a.id.localeCompare(b.id),
  );
}

export function estimateSchedule(
  balance: number,
  emi: number,
  annualRate: number,
): RepaymentSchedule {
  const rate = annualRate / 1200;
  if (balance <= 0) return { count: 0, months: 0, final: 0 };
  if (emi <= 0 || emi <= balance * rate) return { count: null, months: 0, final: 0 };
  const months =
    rate === 0 ? balance / emi : -Math.log1p((-balance * rate) / emi) / Math.log1p(rate);
  const count = Math.max(1, Math.ceil(months - 1e-9));
  const before =
    rate === 0
      ? balance - emi * (count - 1)
      : balance * Math.pow(1 + rate, count - 1) -
        (emi * Math.expm1((count - 1) * Math.log1p(rate))) / rate;
  return { count, months, final: Math.min(emi, Math.max(0, before * (1 + rate))) };
}

/** A trivially small final instalment does not count as a month of tenure. */
function remainingTerm(schedule: RepaymentSchedule, emi: number) {
  const { count, final } = schedule;
  return count !== null && count > 1 && final < emi * 0.01 ? count - 1 : count;
}

function emiFor(balance: number, annualRate: number, months: number, roundUp = false) {
  const rate = annualRate / 1200;
  const exact =
    rate === 0 ? balance / months : (balance * rate) / -Math.expm1(-months * Math.log1p(rate));
  return roundUp ? Math.ceil(exact - 1e-9) : Math.round(exact);
}

export function estimateExtraFirstEmiInterest(loan: Loan) {
  if (loan.dailyInterestBasis || !loan.firstEmiDate) return 0;
  const anniversary = monthlyAnniversary(loan.date);
  if (loan.firstEmiDate <= anniversary) return 0;
  const days = toDayNumber(loan.firstEmiDate) - toDayNumber(anniversary);
  return roundMoney((loan.principal * loan.openingRate * days) / 36500);
}

export function validateLoan(loan: Loan) {
  if (loan.firstEmiDate !== undefined) {
    if (loan.firstEmiDate <= loan.date) {
      throw new Error('First EMI date must be after the loan start date.');
    }
    if (loan.emiDueDay !== undefined) {
      const [year = 0, month = 0] = loan.firstEmiDate.split('-').map(Number);
      const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (Number(loan.firstEmiDate.slice(-2)) !== Math.min(loan.emiDueDay, last)) {
        throw new Error(
          'First EMI date must match the monthly EMI day (clamped in shorter months).',
        );
      }
    }
  }
  if ((loan.firstEmiExtraInterest ?? 0) > 0 && !loan.firstEmiDate) {
    throw new Error('Enter the first EMI date when extra interest is added.');
  }
  const ids = new Set<string>();
  const termDates = new Set<string>();
  for (const change of loan.changes) {
    if (ids.has(change.id)) throw new Error('Invalid or duplicate loan change.');
    ids.add(change.id);
    if (!isValidDate(change.date) || change.date < loan.date) {
      throw new Error('A loan change date cannot precede the loan start date.');
    }
    const { type, amount, rate, emi, repaymentChoice } = change;
    if (type === 'topup' && (amount === undefined || amount <= 0)) {
      throw new Error('Top-up amount must be greater than zero.');
    }
    if (type === 'rate' && (rate === undefined || rate < 0)) {
      throw new Error('Enter a valid new interest rate.');
    }
    if (
      type === 'emi' &&
      (rate !== undefined ||
        amount !== undefined ||
        repaymentChoice !== 'manual' ||
        emi === undefined ||
        emi <= 0)
    ) {
      throw new Error(
        'A revised EMI must contain a positive regular EMI without changing rate or principal.',
      );
    }
    if (type === 'rate' && amount !== undefined)
      throw new Error('Rate changes cannot add principal.');
    if ((repaymentChoice === 'tenure' || repaymentChoice === 'emi') && emi !== undefined) {
      throw new Error('Automatic repayment choices cannot contain a manual EMI.');
    }
    if (repaymentChoice === 'manual' && (emi === undefined || emi <= 0)) {
      throw new Error('Enter the bank-confirmed EMI.');
    }
    if (rate !== undefined || emi !== undefined || repaymentChoice !== undefined) {
      if (termDates.has(change.date)) {
        throw new Error(
          'Only one rate/EMI change is allowed on the same date. Combine the revised terms in one entry.',
        );
      }
      termDates.add(change.date);
    }
  }
}

export const totalPrincipal = (loan: Loan) =>
  loan.changes.reduce(
    (sum, change) => (change.type === 'topup' ? sum + (change.amount ?? 0) : sum),
    loan.principal,
  );

const openingBalance = (loan: Loan) => loan.principal - (loan.principalPaidBeforeTracking ?? 0);

/** Interest accrues daily and is added to the balance at each month end. */
function rebuildDaily(
  loan: Loan,
  payments: LoanPayment[],
  asOf: string,
  quoteId: string | undefined,
): LoanLedger {
  let balance = openingBalance(loan);
  let rate = loan.openingRate;
  let emi = loan.openingEmi;
  let accrued = 0;
  let totalInterest = loan.interestPaidBeforeTracking ?? 0;
  let quoteAmount: number | undefined;
  const splits: PaymentSplit[] = [];
  const history: LoanHistoryEntry[] = [];
  const capitalizations: InterestCapitalization[] = [];
  const events = timeline(
    loan.changes.filter((change) => change.date <= asOf),
    payments.filter((payment) => payment.date <= asOf),
  );
  let next = 0;

  for (let day = toDayNumber(loan.date); day <= toDayNumber(asOf); day++) {
    const date = fromDayNumber(day);
    for (let event = events[next]; event?.date === date; event = events[++next]) {
      if (event.kind === 'change') {
        const { change } = event;
        const before = { beforeBalance: balance, beforeRate: rate, beforeEmi: emi };
        if (change.type === 'topup') balance += change.amount ?? 0;
        if (change.rate !== undefined) rate = change.rate;
        if (change.repaymentChoice === 'manual') emi = change.emi ?? emi;
        history.push({ id: change.id, balance, rate, emi, ...before });
        continue;
      }
      const { payment } = event;
      const amount = quoteId === payment.id ? roundMoney(Math.min(emi, balance)) : payment.amount;
      if (!Number.isFinite(amount) || amount <= 0 || amount > balance + 0.01) {
        throw new Error('Invalid payment for daily-balance loan.');
      }
      if (
        payment.repaymentType !== 'part-payment' &&
        loan.firstEmiDate &&
        date < loan.firstEmiDate
      ) {
        throw new Error('Monthly EMI cannot precede first EMI date.');
      }
      balance = Math.max(0, balance - amount);
      splits.push({ id: payment.id, principalPaid: roundMoney(amount), interestPaid: 0 });
      if (quoteId === payment.id) quoteAmount = roundMoney(amount);
    }
    accrued += (balance * rate) / 36500;
    const isMonthEnd = fromDayNumber(day + 1).endsWith('-01');
    if (isMonthEnd && accrued) {
      const credit = roundMoney(accrued);
      balance = roundMoney(balance + credit);
      totalInterest = roundMoney(totalInterest + credit);
      capitalizations.push({ date, amount: credit });
      accrued = 0;
    }
  }

  return {
    remaining: roundMoney(balance),
    interestPaid: roundMoney(totalInterest),
    accruedInterest: roundMoney(accrued),
    rate,
    emi,
    payments: splits,
    history,
    totalPrincipal: totalPrincipal(loan),
    interestCapitalizations: capitalizations,
    ...(quoteAmount === undefined ? {} : { quoteAmount }),
  };
}

function rebuildMonthly(
  loan: Loan,
  payments: LoanPayment[],
  quoteId: string | undefined,
): LoanLedger {
  let balance = openingBalance(loan);
  let rate = loan.openingRate;
  let emi = loan.openingEmi;
  if (!Number.isFinite(balance) || balance < 0)
    throw new Error('Invalid loan opening balance or rate.');

  let totalInterest = loan.interestPaidBeforeTracking ?? 0;
  let lastDate = loan.date;
  let cycleOpening = balance;
  let adjustments: { date: string; delta: number }[] = [];
  let firstMonthly = true;
  let quoteAmount: number | undefined;
  const splits: PaymentSplit[] = [];
  const history: LoanHistoryEntry[] = [];
  const anniversary = monthlyAnniversary(loan.date);

  /** Principal × days across the cycle, counting mid-cycle top-ups and part payments. */
  const principalDays = (date: string, interval: number) =>
    adjustments.reduce(
      (sum, item) => sum + item.delta * Math.max(0, toDayNumber(date) - toDayNumber(item.date)),
      cycleOpening * interval,
    );

  for (const event of timeline(loan.changes, payments)) {
    if (!isValidDate(event.date) || event.date < loan.date) {
      throw new Error('A repayment or change date cannot precede the loan start date.');
    }

    if (event.kind === 'change') {
      const { change } = event;
      const before = { beforeBalance: balance, beforeRate: rate, beforeEmi: emi };
      const oldSchedule = estimateSchedule(balance, emi, rate);
      const oldTerm = remainingTerm(oldSchedule, emi);
      if (change.type === 'topup') {
        const amount = change.amount ?? 0;
        balance = roundMoney(balance + amount);
        if (!Number.isFinite(balance))
          throw new Error('Top-up exceeds the supported loan balance.');
        adjustments.push({ date: change.date, delta: amount });
      }
      if (change.rate !== undefined) rate = change.rate;
      if (change.repaymentChoice === 'tenure') {
        if (!oldTerm) {
          throw new Error(
            'The existing remaining tenure cannot be estimated. Choose bank-confirmed EMI instead.',
          );
        }
        emi = balance > 0 ? emiFor(balance, rate, oldSchedule.months, true) : 0;
        if (balance > 0 && emi <= (balance * rate) / 1200) {
          emi = Math.floor((balance * rate) / 1200) + 1;
        }
      } else if (change.repaymentChoice !== 'emi' && change.emi !== undefined) {
        emi = Math.round(change.emi);
      }
      if (
        change.repaymentChoice &&
        balance > 0 &&
        (!Number.isFinite(emi) || emi <= (balance * rate) / 1200)
      ) {
        throw new Error(
          'The selected EMI does not cover the revised interest. Keep remaining tenure or enter a higher bank-confirmed EMI.',
        );
      }
      history.push({
        id: change.id,
        balance: roundMoney(balance),
        rate,
        emi,
        ...before,
        oldTerm,
        newTerm: estimateSchedule(balance, emi, rate).count,
        repaymentChoice: change.repaymentChoice,
      });
      continue;
    }

    const { payment } = event;
    let { amount } = payment;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('Every repayment must have a positive amount.');
    }

    if (payment.repaymentType === 'part-payment') {
      if (amount > balance + 0.01) {
        throw new Error('Part payment exceeds the outstanding principal on that date.');
      }
      const term = remainingTerm(estimateSchedule(balance, emi, rate), emi);
      const reduce = payment.partPaymentAction === 'reduce';
      if (reduce && !term)
        throw new Error('Enter an EMI that covers interest before reducing the EMI.');
      const applied = Math.min(amount, balance);
      if (reduce) emi = balance <= applied ? 0 : emiFor(balance - applied, rate, term ?? 0);
      adjustments.push({ date: payment.date, delta: -applied });
      balance = roundMoney(Math.max(0, balance - applied));
      splits.push({ id: payment.id, principalPaid: roundMoney(applied), interestPaid: 0 });
      continue;
    }

    if (loan.firstEmiDate && payment.date < loan.firstEmiDate) {
      throw new Error('Monthly EMI cannot precede the bank-confirmed first EMI date.');
    }
    const extra = firstMonthly ? (loan.firstEmiExtraInterest ?? 0) : 0;
    const interval = Math.max(0, toDayNumber(payment.date) - toDayNumber(lastDate));
    let interest: number;
    if (payment.interestOverride === true) {
      interest = payment.interestPaid ?? Number.NaN;
      if (!Number.isFinite(interest) || interest < 0) {
        throw new Error('Invalid statement interest correction.');
      }
    } else if (
      firstMonthly &&
      loan.firstEmiInterestMethod === 'short-actual365' &&
      payment.date < anniversary
    ) {
      interest = Math.round((Math.max(0, principalDays(payment.date, interval)) * rate) / 36500);
    } else if (adjustments.length > 0 && interval > 0) {
      const averageBalance = Math.max(0, principalDays(payment.date, interval) / interval);
      interest = Math.round((averageBalance * rate) / 1200);
    } else {
      interest = Math.round((balance * rate) / 1200);
    }
    if (payment.interestOverride !== true) interest = roundMoney(interest + extra);
    if (quoteId === payment.id) {
      amount = roundMoney(Math.min(emi + extra, balance + interest));
      quoteAmount = amount;
    }
    firstMonthly = false;

    const principal = amount - interest;
    if (principal <= 0) throw new Error(`Monthly EMI does not cover interest (${interest}).`);
    if (principal > balance + 0.01) {
      throw new Error('EMI principal exceeds the outstanding balance on that date.');
    }
    const applied = Math.min(principal, balance);
    splits.push({
      id: payment.id,
      principalPaid: roundMoney(applied),
      interestPaid: roundMoney(interest),
    });
    balance = roundMoney(Math.max(0, balance - applied));
    totalInterest += interest;
    lastDate = payment.date;
    cycleOpening = balance;
    adjustments = [];
  }

  return {
    remaining: roundMoney(balance),
    interestPaid: roundMoney(totalInterest),
    accruedInterest: 0,
    rate,
    emi,
    payments: splits,
    history,
    totalPrincipal: totalPrincipal(loan),
    interestCapitalizations: [],
    ...(quoteAmount === undefined ? {} : { quoteAmount }),
  };
}

/** Replays a loan from its opening terms. `asOf` is required for daily-interest loans. */
export function rebuildLoan(
  loan: Loan,
  payments: LoanPayment[],
  options: { asOf?: string; quoteId?: string } = {},
): LoanLedger | LoanFailure {
  try {
    validateLoan(loan);
    if (!loan.dailyInterestBasis) return rebuildMonthly(loan, payments, options.quoteId);
    if (!isValidDate(options.asOf)) {
      throw new Error('A valid as-of date is required for daily-interest calculations.');
    }
    return rebuildDaily(loan, payments, options.asOf, options.quoteId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export type PaymentQuote =
  { paidOff: true; amount: 0 } | { paidOff?: false; amount: number; rate: number; emi: number };

/** The EMI due on `date`, given everything recorded up to that date. */
export function quotePayment(
  loan: Loan,
  payments: LoanPayment[],
  date: string,
): PaymentQuote | LoanFailure {
  const dated = { ...loan, changes: loan.changes.filter((change) => change.date <= date) };
  const prior = payments.filter((payment) => payment.date <= date);
  const before = rebuildLoan(dated, prior, { asOf: date });
  if (isLoanFailure(before)) return before;
  if (before.remaining <= 0) return { paidOff: true, amount: 0 };
  let id = 'recurring_quote';
  while (prior.some((payment) => payment.id === id)) id += '_';
  const quote: LoanPayment = { id, date, amount: 1, repaymentType: 'emi' };
  const result = rebuildLoan(dated, [...prior, quote], { asOf: date, quoteId: id });
  if (isLoanFailure(result)) return result;
  return { amount: result.quoteAmount ?? 0, rate: before.rate, emi: before.emi };
}

export interface StatementRow {
  date: string;
  type: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface DailyStatement {
  rows: StatementRow[];
  remaining: number;
  interestPaid: number;
  accruedInterest: number;
  asOfDate: string;
}

const withNotes = (description: string, notes?: string) =>
  notes ? `${description} · ${notes}` : description;

function describeChange(change: LoanChange) {
  if (change.type === 'topup') {
    return {
      type: 'Loan top-up',
      description: change.notes || 'Additional principal',
      credit: change.amount ?? 0,
    };
  }
  if (change.type === 'rate') {
    return {
      type: 'Rate change',
      description: withNotes(`Annual interest rate changed to ${change.rate}%`, change.notes),
      credit: 0,
    };
  }
  return {
    type: 'EMI revision',
    description: withNotes('Regular EMI changed', change.notes),
    credit: 0,
  };
}

export function dailyStatement(
  loan: Loan,
  payments: LoanPayment[],
  asOf: string,
): DailyStatement | LoanFailure {
  if (!isValidDate(asOf))
    return { error: 'A valid as-of date is required for a daily-interest statement.' };
  const dated = { ...loan, changes: loan.changes.filter((change) => change.date <= asOf) };
  const prior = payments.filter((payment) => payment.date <= asOf);
  const result = rebuildLoan(dated, prior, { asOf });
  if (isLoanFailure(result)) return result;

  type Entry = Omit<StatementRow, 'balance'> & { priority: number; id: string };
  const entries: Entry[] = [
    {
      date: loan.date,
      priority: -1,
      id: 'opening',
      type: 'Disbursement',
      description: 'Original loan amount',
      debit: 0,
      credit: loan.principal,
    },
    ...timeline(dated.changes, prior).map((event): Entry => {
      const { date, priority, id } = event;
      if (event.kind === 'change')
        return { date, priority, id, debit: 0, ...describeChange(event.change) };
      const { payment } = event;
      const isPart = payment.repaymentType === 'part-payment';
      return {
        date,
        priority,
        id,
        type: isPart ? 'Part payment' : 'EMI payment',
        description: withNotes(isPart ? 'Extra principal repayment' : 'Monthly EMI', payment.notes),
        debit: payment.amount,
        credit: 0,
      };
    }),
    ...result.interestCapitalizations.map((item): Entry => ({
      date: item.date,
      priority: 3,
      id: `interest-${item.date}`,
      type: 'Interest capitalization',
      description: 'Month-end interest added',
      debit: 0,
      credit: item.amount,
    })),
  ];
  entries.sort(
    (a, b) => a.date.localeCompare(b.date) || a.priority - b.priority || a.id.localeCompare(b.id),
  );

  let balance = 0;
  const rows = entries.map(({ date, type, description, debit, credit }) => {
    balance = roundMoney(balance + credit - debit);
    return {
      date,
      type,
      description,
      debit: roundMoney(debit),
      credit: roundMoney(credit),
      balance,
    };
  });
  return {
    rows,
    remaining: result.remaining,
    interestPaid: result.interestPaid,
    accruedInterest: result.accruedInterest,
    asOfDate: asOf,
  };
}

/** Outstanding principal immediately after each payment. */
export function paymentBalances(loan: Loan, payments: LoanPayment[], asOf?: string) {
  const result = rebuildLoan(loan, payments, asOf === undefined ? {} : { asOf });
  if (isLoanFailure(result)) return result;
  const splits = new Map(result.payments.map((split) => [split.id, split]));
  const balances = new Map<string, number>();
  let balance = openingBalance(loan);
  for (const event of timeline(loan.changes, payments)) {
    if (event.kind === 'change') {
      if (event.change.type === 'topup') balance = roundMoney(balance + (event.change.amount ?? 0));
      continue;
    }
    const split = splits.get(event.id);
    if (!split) continue;
    balance = roundMoney(Math.max(0, balance - split.principalPaid));
    balances.set(event.id, balance);
  }
  return { balances, remaining: result.remaining };
}
