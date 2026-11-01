import type { z } from 'zod';
import {
  expenseSchema,
  incomeSchema,
  loanSchema,
  monthlyBalanceSchema,
  recurringOccurrenceSchema,
  recurringRuleSchema,
  type Expense,
  type Income,
  type Loan,
  type MonthlyBalance,
  type RecurringOccurrence,
  type RecurringRule,
} from '../schema/records';

export interface TrackerData {
  income: Income[];
  expenses: Expense[];
  loans: Loan[];
  recurringRules: RecurringRule[];
  recurringOccurrences: RecurringOccurrence[];
  monthlyBalances: MonthlyBalance[];
}

export type CollectionName = keyof TrackerData;

export const COLLECTIONS: { [Name in CollectionName]: z.ZodType<TrackerData[Name][number]> } = {
  income: incomeSchema,
  expenses: expenseSchema,
  loans: loanSchema,
  recurringRules: recurringRuleSchema,
  recurringOccurrences: recurringOccurrenceSchema,
  monthlyBalances: monthlyBalanceSchema,
};

export const COLLECTION_NAMES = Object.keys(COLLECTIONS) as CollectionName[];

export const emptyTrackerData = (): TrackerData => ({
  income: [],
  expenses: [],
  loans: [],
  recurringRules: [],
  recurringOccurrences: [],
  monthlyBalances: [],
});

export type RecordWrite =
  | { type: 'set'; collection: CollectionName; id: string; value: object }
  | { type: 'delete'; collection: CollectionName; id: string };

/** A stored document id. Months and occurrences have natural keys instead of an `id` field. */
export const recordId = {
  monthlyBalance: (row: MonthlyBalance) => row.month,
  occurrence: (row: RecurringOccurrence) => `${row.ruleId}_${row.month}`,
};

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
