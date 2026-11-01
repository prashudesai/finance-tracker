import type { z } from 'zod';
import {
  changeRecordSchema,
  contributionSchema,
  epsUpdateSchema,
  expenseSchema,
  gratuityAccountSchema,
  holdingSchema,
  incomeSchema,
  interestCreditSchema,
  loanSchema,
  monthReviewSchema,
  monthlyBalanceSchema,
  projectionAdjustmentSchema,
  recurringOccurrenceSchema,
  recurringRuleSchema,
  statementCheckSchema,
  trackerSettingsSchema,
  valuationSchema,
  type ChangeRecord,
  type Contribution,
  type EpsUpdate,
  type Expense,
  type GratuityAccount,
  type Holding,
  type Income,
  type InterestCredit,
  type Loan,
  type MonthReview,
  type MonthlyBalance,
  type ProjectionAdjustment,
  type RecurringOccurrence,
  type RecurringRule,
  type StatementCheck,
  type TrackerSettings,
  type Valuation,
} from '../schema/records';

export interface TrackerData {
  income: Income[];
  expenses: Expense[];
  loans: Loan[];
  recurringRules: RecurringRule[];
  recurringOccurrences: RecurringOccurrence[];
  monthlyBalances: MonthlyBalance[];
  holdings: Holding[];
  contributions: Contribution[];
  valuations: Valuation[];
  gratuityAccounts: GratuityAccount[];
  projectionAdjustments: ProjectionAdjustment[];
  settings: TrackerSettings[];
  monthReviews: MonthReview[];
  changes: ChangeRecord[];
  interestCredits: InterestCredit[];
  epsUpdates: EpsUpdate[];
  statementChecks: StatementCheck[];
}

export type CollectionName = keyof TrackerData;

export const COLLECTIONS: { [Name in CollectionName]: z.ZodType<TrackerData[Name][number]> } = {
  income: incomeSchema,
  expenses: expenseSchema,
  loans: loanSchema,
  recurringRules: recurringRuleSchema,
  recurringOccurrences: recurringOccurrenceSchema,
  monthlyBalances: monthlyBalanceSchema,
  holdings: holdingSchema,
  contributions: contributionSchema,
  valuations: valuationSchema,
  gratuityAccounts: gratuityAccountSchema,
  projectionAdjustments: projectionAdjustmentSchema,
  settings: trackerSettingsSchema,
  monthReviews: monthReviewSchema,
  changes: changeRecordSchema,
  interestCredits: interestCreditSchema,
  epsUpdates: epsUpdateSchema,
  statementChecks: statementCheckSchema,
};

export const COLLECTION_NAMES = Object.keys(COLLECTIONS) as CollectionName[];

export const emptyTrackerData = (): TrackerData => ({
  income: [],
  expenses: [],
  loans: [],
  recurringRules: [],
  recurringOccurrences: [],
  monthlyBalances: [],
  holdings: [],
  contributions: [],
  valuations: [],
  gratuityAccounts: [],
  projectionAdjustments: [],
  settings: [],
  monthReviews: [],
  changes: [],
  interestCredits: [],
  epsUpdates: [],
  statementChecks: [],
});

export type RecordWrite =
  | { type: 'set'; collection: CollectionName; id: string; value: object }
  | { type: 'delete'; collection: CollectionName; id: string };

/** A stored document id. Months and occurrences have natural keys instead of an `id` field. */
export const recordId = {
  monthlyBalance: (row: MonthlyBalance) => row.month,
  occurrence: (row: RecurringOccurrence) => `${row.ruleId}_${row.month}`,
};

/** The document ID a row is stored under. */
export function documentId(name: CollectionName, row: object) {
  if (name === 'monthlyBalances') return recordId.monthlyBalance(row as MonthlyBalance);
  if (name === 'recurringOccurrences') return recordId.occurrence(row as RecurringOccurrence);
  return (row as { id: string }).id;
}

export interface TrackerRepository {
  /** Calls `onRows` with every valid document, now and after each change. */
  subscribe<Name extends CollectionName>(
    name: Name,
    onRows: (rows: TrackerData[Name], invalidCount: number) => void,
    onError: (error: Error) => void,
  ): () => void;
  /** Applies all writes together. Offline writes are queued by the backend. */
  commit(writes: RecordWrite[]): Promise<void>;
}

/** Keeps the rows that match the schema, so one bad document cannot blank the app. */
export function parseRows<Name extends CollectionName>(name: Name, rows: unknown[]) {
  const valid: TrackerData[Name][number][] = [];
  for (const row of rows) {
    const result = COLLECTIONS[name].safeParse(row);
    if (result.success) valid.push(result.data);
  }
  return { rows: valid as TrackerData[Name], invalidCount: rows.length - valid.length };
}
