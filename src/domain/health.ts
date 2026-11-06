import type { TrackerData } from '../data/repository';
import { isMarket, monthCloser } from './analytics';
import { addDays, nextMonth, roundMoney } from './calendar';
import { latestValuation } from './holdings';
import { summarizeLoans } from './summary';

/**
 * Things in the records that would make figures wrong or out of date, each with where to put
 * it right. Worked out from the household's records alone, like everything else.
 */
export type HealthIssue =
  | { kind: 'missingBalances'; months: string[] }
  | { kind: 'moreThanExpected'; months: { month: string; amount: number }[] }
  | { kind: 'staleValues'; names: string[]; oldest: string }
  | { kind: 'loanErrors'; loans: { name: string; error: string }[] }
  | {
      kind: 'orphans';
      /** Records for investments or loans that no longer exist, by collection. */
      records: {
        collection: 'contributions' | 'valuations' | 'withdrawals' | 'expenses';
        id: string;
      }[];
    };

/** Market values older than this are out of date. */
export const STALE_DAYS = 45;
/** Bank balances this much above what was expected are worth a look, as income may be missing. */
const ABOVE_EXPECTED = 1_000;

export function dataHealth(household: TrackerData, today: string): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const current = today.slice(0, 7);

  // Once balances are in use, every month from the first one on should have its opening.
  const recorded = new Set(household.monthlyBalances.map((row) => row.month));
  const first = [...recorded].sort()[0];
  if (first) {
    const missing: string[] = [];
    for (let month = first; month <= current; month = nextMonth(month)) {
      if (!recorded.has(month)) missing.push(month);
    }
    if (missing.length > 0) issues.push({ kind: 'missingBalances', months: missing });
  }

  // A closing balance well above the expected one usually means income wasn't recorded.
  const closeOf = monthCloser(household);
  const above = household.monthlyBalances
    .map(({ month }) => ({ month, unrecorded: closeOf(month).unrecorded }))
    .filter(
      (row): row is { month: string; unrecorded: number } =>
        row.unrecorded !== null && row.unrecorded < -ABOVE_EXPECTED,
    )
    .map((row) => ({ month: row.month, amount: roundMoney(-row.unrecorded) }))
    .sort((a, b) => b.month.localeCompare(a.month));
  if (above.length > 0) issues.push({ kind: 'moreThanExpected', months: above });

  // Market investments without a value for a while make net worth and returns stale.
  const cutoff = addDays(today, -STALE_DAYS);
  const stale = household.holdings
    .filter((holding) => holding.date <= cutoff && isMarket(holding, household.settings[0]))
    .map((holding) => ({
      name: holding.name,
      date: latestValuation(holding.id, household.valuations, today)?.date ?? holding.date,
    }))
    .filter(({ date }) => date < cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));
  const oldest = stale[0];
  if (oldest) {
    issues.push({ kind: 'staleValues', names: stale.map((row) => row.name), oldest: oldest.date });
  }

  // A loan whose history can't be replayed has no balance at all.
  const broken = summarizeLoans(household, today)
    .filter((loan) => loan.error)
    .map((loan) => ({ name: loan.type, error: loan.error ?? '' }));
  if (broken.length > 0) issues.push({ kind: 'loanErrors', loans: broken });

  // Records left behind by an investment or loan that was deleted.
  const holdings = new Set(household.holdings.map((row) => row.id));
  const loans = new Set(household.loans.map((row) => row.id));
  const records = [
    ...(['contributions', 'valuations', 'withdrawals'] as const).flatMap((collection) =>
      household[collection]
        .filter((row) => !holdings.has(row.holdingId))
        .map((row) => ({ collection, id: row.id })),
    ),
    ...household.expenses
      .filter((row) => row.loanId && !loans.has(row.loanId))
      .map((row) => ({ collection: 'expenses' as const, id: row.id })),
  ];
  if (records.length > 0) issues.push({ kind: 'orphans', records });
  return issues;
}
