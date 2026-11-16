import type { Contribution, Holding } from '../schema/records';
import {
  addMonths,
  financialYearRange,
  financialYearStart,
  previousMonth,
  roundMoney,
} from './calendar';
import { monthlyContribution } from './holdings';

export type RetirementKind = 'pf' | 'ppf' | 'nps';
export const RETIREMENT_KINDS: readonly RetirementKind[] = ['pf', 'ppf', 'nps'];

export interface RetirementTypeMonth {
  kind: RetirementKind;
  /** All that went in this month, the PF pension share (EPS) included. */
  total: number;
  /** For PF: the employer's part of `total`. */
  employer: number;
  /** What each person put in, in the order their accounts are listed. */
  byMember: { member: string; amount: number }[];
  /** Scheduled contributions for this month with nothing recorded yet. */
  expected: { holdingId: string; member: string; date: string; amount: number }[];
}

export interface RetirementMonth {
  month: string;
  total: number;
  employer: number;
  previousTotal: number;
  /** From the start of this month's financial year to the end of this month. */
  yearTotal: number;
  types: RetirementTypeMonth[];
}

const isRetirement = (holding: Holding): holding is Holding & { kind: RetirementKind } =>
  holding.kind !== 'investment';

const counted = (row: Contribution) => !row.skipped;
const putIn = (row: Contribution) => row.amount + (row.epsAmount ?? 0);

/**
 * The employer's part of a PF contribution: whatever is beyond the employee's share as set on
 * the account. With no split set, it's taken as none.
 */
function employerPart(holding: Holding, amount: number) {
  if (holding.kind !== 'pf' || holding.employer === undefined) return 0;
  const employee = holding.employee ?? 0;
  return roundMoney(Math.max(0, amount - employee));
}

/** The scheduled date of a holding's contribution in `month`, if it has one. */
function scheduledIn(holding: Holding, month: string) {
  if (!holding.autoContribute || !holding.autoStart || monthlyContribution(holding) <= 0) {
    return null;
  }
  if (month < holding.autoStart.slice(0, 7) || month < holding.date.slice(0, 7)) return null;
  if (holding.maturity && month > holding.maturity.slice(0, 7)) return null;
  const anchor = Number(holding.autoStart.slice(-2));
  const [startYear, startMonth] = holding.autoStart.split('-').map(Number) as [number, number];
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];
  const steps = (year - startYear) * 12 + (monthNumber - startMonth);
  return addMonths(holding.autoStart, steps, anchor);
}

/**
 * What went into PF, PPF and NPS in one month, by type and by person, with the employer's part
 * of PF, scheduled contributions not yet recorded, last month's total and the financial year
 * so far. Removed scheduled contributions don't count.
 */
export function retirementMonth(
  holdings: readonly Holding[],
  contributions: readonly Contribution[],
  month: string,
): RetirementMonth {
  const retirement = holdings.filter(isRetirement);
  const byId = new Map(retirement.map((holding) => [holding.id, holding]));
  const rows = contributions.filter((row) => counted(row) && byId.has(row.holdingId));
  const inMonth = (target: string) => rows.filter((row) => row.date.slice(0, 7) === target);
  const sum = (list: readonly Contribution[]) => roundMoney(list.reduce((s, r) => s + putIn(r), 0));

  const thisMonth = inMonth(month);
  const types = RETIREMENT_KINDS.map((kind): RetirementTypeMonth => {
    const accounts = retirement.filter((holding) => holding.kind === kind);
    const own = thisMonth.filter((row) => byId.get(row.holdingId)?.kind === kind);
    const members = new Map<string, number>();
    let employer = 0;
    for (const holding of accounts) {
      const paid = own.filter((row) => row.holdingId === holding.id);
      const amount = sum(paid);
      if (amount > 0 || !members.has(holding.member)) {
        members.set(holding.member, roundMoney((members.get(holding.member) ?? 0) + amount));
      }
      employer += paid.reduce((s, row) => s + employerPart(holding, putIn(row)), 0);
    }
    const recorded = new Set(own.map((row) => row.holdingId));
    const expected = accounts.flatMap((holding) => {
      const date = scheduledIn(holding, month);
      if (!date || recorded.has(holding.id)) return [];
      const amount = monthlyContribution(holding) + (holding.epsMonthly ?? 0);
      return [{ holdingId: holding.id, member: holding.member, date, amount }];
    });
    return {
      kind,
      total: sum(own),
      employer: roundMoney(employer),
      byMember: [...members].map(([member, amount]) => ({ member, amount })),
      expected,
    };
  }).filter((type) => type.byMember.length > 0);

  const { start } = financialYearRange(financialYearStart(month));
  const yearRows = rows.filter((row) => row.date >= start && row.date.slice(0, 7) <= month);
  return {
    month,
    total: roundMoney(types.reduce((s, type) => s + type.total, 0)),
    employer: roundMoney(types.reduce((s, type) => s + type.employer, 0)),
    previousTotal: sum(inMonth(previousMonth(month))),
    yearTotal: sum(yearRows),
    types,
  };
}
