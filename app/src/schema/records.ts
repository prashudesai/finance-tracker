import { z } from 'zod';
import { isValidDate, isValidMonth } from '../domain/calendar';

const id = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);
const date = z.string().refine(isValidDate, 'Enter a valid date.');
const month = z.string().refine(isValidMonth, 'Enter a valid month.');
const number = z.number({ error: 'Enter a number.' }).finite();
const money = number.nonnegative('Enter zero or more.').max(1e12, 'That amount is too large.');
const positiveMoney = number
  .positive('Enter an amount above zero.')
  .max(1e12, 'That amount is too large.');
const name = z
  .string()
  .trim()
  .min(1, 'This field is required.')
  .max(100, 'Use 100 characters or fewer.');
const notes = z.string().max(500);

export const EMI_CATEGORY = 'EMI Payment';

export const loanChangeSchema = z.object({
  id,
  type: z.enum(['rate', 'topup', 'emi']),
  date,
  amount: positiveMoney.optional(),
  rate: number.nonnegative('Enter zero or more.').optional(),
  emi: money.optional(),
  repaymentChoice: z.enum(['tenure', 'emi', 'manual']).optional(),
  notes: notes.optional(),
});
export type LoanChange = z.infer<typeof loanChangeSchema>;

/**
 * Opening terms and dated changes only. Balance, current rate, current EMI and
 * interest paid are always derived by the ledger, so they cannot drift.
 */
export const loanSchema = z.object({
  id,
  type: name,
  member: name,
  date,
  principal: money,
  openingRate: number.nonnegative('Enter zero or more.'),
  openingEmi: money,
  principalPaidBeforeTracking: money.optional(),
  interestPaidBeforeTracking: money.optional(),
  firstEmiDate: date.optional(),
  emiDueDay: z.number().int().min(1).max(31).optional(),
  firstEmiExtraInterest: money.optional(),
  firstEmiInterestMethod: z.enum(['monthly', 'short-actual365']).optional(),
  dailyInterestBasis: z.boolean().optional(),
  changes: z.array(loanChangeSchema).max(500),
});
export type Loan = z.infer<typeof loanSchema>;

export const incomeSchema = z.object({
  id,
  date,
  member: name,
  source: name,
  amount: positiveMoney,
  notes: notes.optional(),
  recurringRuleId: id.optional(),
  recurringMonth: month.optional(),
});
export type Income = z.infer<typeof incomeSchema>;

export const expenseSchema = z.object({
  id,
  date,
  category: name,
  subcategory: z.string().max(100).default(''),
  amount: positiveMoney,
  isAnnual: z.boolean().default(false),
  notes: notes.optional(),
  loanId: id.optional(),
  repaymentType: z.enum(['emi', 'part-payment']).optional(),
  partPaymentAction: z.enum(['keep', 'reduce']).optional(),
  /** Bank statement correction: use `interestPaid` instead of the calculated interest. */
  interestOverride: z.boolean().optional(),
  interestPaid: money.optional(),
  recurringRuleId: id.optional(),
  recurringMonth: month.optional(),
});
export type Expense = z.infer<typeof expenseSchema>;

const amountChangeSchema = z.object({ month, amount: positiveMoney });

const recurringBase = {
  id,
  name,
  day: z.number().int().min(0).max(31),
  startMonth: month,
  endMonth: month.optional(),
  paused: z.boolean(),
  pausedFrom: month.optional(),
  archived: z.boolean().optional(),
};

export const recurringRuleSchema = z.discriminatedUnion('kind', [
  z.object({
    ...recurringBase,
    kind: z.literal('income'),
    member: name,
    source: name,
    amount: positiveMoney,
    amountChanges: z.array(amountChangeSchema).max(1000),
  }),
  z.object({
    ...recurringBase,
    kind: z.literal('expense'),
    category: name.refine((value) => value !== EMI_CATEGORY),
    subcategory: z.string().max(100),
    isAnnual: z.boolean(),
    amount: positiveMoney,
    amountChanges: z.array(amountChangeSchema).max(1000),
  }),
  z.object({ ...recurringBase, kind: z.literal('emi'), loanId: id }),
]);
export type RecurringRule = z.infer<typeof recurringRuleSchema>;

export const recurringOccurrenceSchema = z.object({
  ruleId: id,
  month,
  status: z.enum(['posted', 'matched', 'skipped']),
  recordId: id.optional(),
});
export type RecurringOccurrence = z.infer<typeof recurringOccurrenceSchema>;

export const monthlyBalanceSchema = z.object({
  month,
  startBalance: z.number().finite(),
});
export type MonthlyBalance = z.infer<typeof monthlyBalanceSchema>;
