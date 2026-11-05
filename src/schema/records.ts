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
const notes = z.string().max(500, 'Use 500 characters or fewer.');

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
  /** Blank means the loan isn't tied to one person. */
  member: z.string().max(100).default(''),
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
  notes: notes.optional(),
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
  /** Blank means the household. */
  member: z.string().max(100).optional(),
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

export const PMS_TYPE = 'Stallion PMS';

/**
 * Opening position only. Invested and current values are always derived from the
 * holding's contributions and valuations, so they cannot drift.
 */
export const holdingSchema = z.object({
  id,
  kind: z.enum(['investment', 'pf', 'ppf', 'nps']),
  /** Category, such as Mutual Funds. Retirement kinds use their own label. */
  type: name,
  name,
  member: name,
  date,
  openingInvested: money,
  openingValue: money,
  /** Annual interest for fixed-return holdings. */
  rate: number.nonnegative('Enter zero or more.').optional(),
  monthly: money.default(0),
  /** PF splits the monthly amount; the EPS share goes to the pension balance. */
  employee: money.optional(),
  employer: money.optional(),
  epsMonthly: money.optional(),
  epsOpening: money.optional(),
  autoContribute: z.boolean().default(false),
  /** First scheduled contribution. Its day anchors later months. */
  autoStart: date.optional(),
  notes: notes.optional(),
  /** PF account number. */
  uan: z.string().max(40).optional(),
  /** NPS scheme, such as Active Choice. */
  scheme: z.string().max(60).optional(),
});
export type Holding = z.infer<typeof holdingSchema>;

export const contributionSchema = z.object({
  id,
  holdingId: id,
  date,
  amount: money,
  epsAmount: money.optional(),
  automatic: z.boolean().default(false),
  /** A removed scheduled contribution, kept so the schedule does not post it again. */
  skipped: z.boolean().optional(),
  /** Checked against a statement. */
  confirmed: z.boolean().optional(),
});
export type Contribution = z.infer<typeof contributionSchema>;

export const valuationSchema = z.object({
  id,
  holdingId: id,
  date,
  value: money,
});
export type Valuation = z.infer<typeof valuationSchema>;

export const GOAL_KINDS = [
  'education',
  'house',
  'retirement',
  'wedding',
  'car',
  'emergency',
  'vacation',
  'custom',
] as const;

/** A share of one holding set aside for a goal, from just above 0 to 1. */
export const goalFundingSchema = z.object({
  holdingId: id,
  share: number.gt(0, 'Enter a share above zero.').max(1, 'Use 100% or less.'),
});

/**
 * Something the family is saving for. Only the plan is stored: progress, the future cost
 * and the monthly amount needed are always worked out from the funding holdings.
 */
export const goalSchema = z.object({
  id,
  kind: z.enum(GOAL_KINDS),
  name,
  /** In today's rupees. Inflation turns it into the amount needed on the date. */
  target: positiveMoney,
  targetDate: date,
  /** Blank means it's for the whole household. */
  member: z.string().max(100).default(''),
  /** Yearly, as a percentage. */
  inflation: number.min(0, 'Enter zero or more.').max(30, 'Use 30% or less.'),
  /** Yearly, as a percentage. Left out, it follows how far away the goal is. */
  expectedReturn: number.min(0, 'Enter zero or more.').max(30, 'Use 30% or less.').optional(),
  funding: z.array(goalFundingSchema).max(50).default([]),
  notes: notes.optional(),
});
export type Goal = z.infer<typeof goalSchema>;
export type GoalKind = Goal['kind'];

/**
 * Money taken out of an investment. Its value afterwards is saved as a valuation on the
 * same date, so the invested amount and booked profit can be worked out by average cost.
 */
export const withdrawalSchema = z.object({
  id,
  holdingId: id,
  date,
  amount: positiveMoney,
  /** The valuation saved with it, removed along with it. */
  valuationId: id.optional(),
});
export type Withdrawal = z.infer<typeof withdrawalSchema>;

/** Annual PF or PPF interest. Each account has at most one per financial year. */
export const interestCreditSchema = z.object({
  id,
  holdingId: id,
  financialYearStartYear: z.number().int().min(1900).max(2200),
  creditedDate: date,
  amount: money,
});
export type InterestCredit = z.infer<typeof interestCreditSchema>;

/** A correction to a PF account's EPS balance. Signed, as it can go either way. */
export const epsUpdateSchema = z.object({
  id,
  holdingId: id,
  date,
  amount: number,
});
export type EpsUpdate = z.infer<typeof epsUpdateSchema>;

export const gratuityAccountSchema = z.object({
  id,
  member: name,
  /** Date of joining. */
  date,
  basicSalary: money,
});
export type GratuityAccount = z.infer<typeof gratuityAccountSchema>;

export const projectionAdjustmentSchema = z.object({
  id,
  category: name,
  date,
  type: z.enum(['add', 'withdraw']),
  amount: positiveMoney,
  notes: notes.optional(),
});
export type ProjectionAdjustment = z.infer<typeof projectionAdjustmentSchema>;

/** One saved change, with enough detail to show it and undo it. */
export const changeRecordSchema = z.object({
  id,
  at: z.string(),
  actor: z.string().max(200),
  summary: z.string().max(200),
  count: z.number().int().nonnegative(),
  entries: z
    .array(
      z.object({
        collection: z.string(),
        docId: z.string(),
        before: z.unknown(),
        after: z.unknown(),
      }),
    )
    .max(50),
  undone: z.boolean().default(false),
});
export type ChangeRecord = z.infer<typeof changeRecordSchema>;

export const SCENARIOS = ['stress', 'base', 'optimistic'] as const;
export type Scenario = (typeof SCENARIOS)[number];

const scenarioRates = z.object({
  stress: z.number().optional(),
  base: z.number().optional(),
  optimistic: z.number().optional(),
});

const textList = z.array(z.string().trim().min(1).max(60)).default([]);

export const TRACKER_SETTINGS_ID = 'tracker';

/** A month someone has reviewed, and what its figures were at the time. */
export const monthReviewSchema = z.object({
  id,
  month,
  signature: z.string().max(1000),
  reviewedAt: date,
});
export type MonthReview = z.infer<typeof monthReviewSchema>;

/** One document of household preferences. */
export const trackerSettingsSchema = z.object({
  id,
  familyMembers: textList,
  incomeSources: textList,
  expenseCategories: textList,
  debtTypes: textList,
  investmentTypes: textList,
  /** Growth behaviour of custom investment types. */
  growthTypes: z.record(z.string(), z.enum(['market', 'fixed', 'no-return'])).default({}),
  projectionYears: z.number().int().min(1).max(40).default(5),
  includeMonthlyContributions: z.boolean().default(true),
  includeGratuity: z.boolean().default(true),
  excludedContributions: textList,
  stepUps: z.record(z.string(), z.number()).default({}),
  returns: z.record(z.string(), scenarioRates).default({}),
  projectionMonthly: z.record(z.string(), z.number()).default({}),
  onboardingDone: z.boolean().default(false),
  /** Uploaded profile photos, small enough to keep here, by email address. */
  photos: z.record(z.string(), z.string().max(60_000)).default({}),
  backupReminderDays: z.number().int().min(0).max(365).default(30),
  lastBackupOn: z.string().optional(),
  goal: z
    .object({
      years: z.number().int().min(1).max(40),
      inflation: z.number().min(0).max(30),
      target: z.number().nonnegative(),
    })
    .default({ years: 5, inflation: 6, target: 0 }),
});
export type TrackerSettings = z.infer<typeof trackerSettingsSchema>;

export const defaultSettings = (): TrackerSettings =>
  trackerSettingsSchema.parse({ id: TRACKER_SETTINGS_ID });
