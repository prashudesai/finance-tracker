import { averageContributions, holdingGroups, netWorth } from '../../domain/analytics';
import { addMonths, ageOn } from '../../domain/calendar';
import { monthlyAverages, monthsUntil } from '../../domain/goals';
import { holdingValue } from '../../domain/holdings';
import type { RetirementInputs, RetirementPart } from '../../domain/retirement';
import type { TrackerData } from '../../data/repository';
import type { TrackerSettings } from '../../schema/records';

export type Assumptions = NonNullable<TrackerSettings['retirement']>;

/** Ages come from the dates, which only the person can give. */
/** Retirement is the 60th birthday unless another date is picked. */
export const RETIRE_AT = 60;

export const DEFAULTS: Omit<Assumptions, 'birthDate' | 'retireDate'> = {
  untilAge: 85,
  inflation: 6,
  growthBefore: 10,
  growthAfter: 10,
  stepUp: 5,
  contributions: true,
  fund: 'all',
};

export type After = NonNullable<Assumptions['after']>[string];

/** One investment's behaviour after retiring, as typed, so fields can be mid-edit. */
export interface AfterDraft {
  behaviour: After['behaviour'];
  growth: string;
  payout: string;
  /** A payout as a percentage of the value a year, or a fixed amount a month. */
  payoutIn: 'percent' | 'amount';
  payoutAmount: string;
  payoutEvery: Every;
  sellable: boolean;
  moving: boolean;
  moveShare: string;
  movePayout: string;
}

export const BEHAVIOURS = [
  ['growth', 'Grows'],
  ['income', 'Income'],
  ['both', 'Both'],
] as const;

export const draftOf = (saved: After | undefined, growth: number): AfterDraft => ({
  behaviour: saved?.behaviour ?? 'growth',
  growth: String(saved?.growth ?? growth),
  payout: String(saved?.payoutFixed ? 7 : (saved?.payout ?? 7)),
  payoutIn: saved?.payoutFixed ? 'amount' : 'percent',
  payoutAmount: saved?.payoutFixed ? String(saved.payoutFixed.amount) : '',
  payoutEvery: saved?.payoutFixed?.every ?? 'month',
  sellable: saved?.sellable ?? true,
  moving: Boolean(saved?.move),
  moveShare: String(Math.round((saved?.move?.share ?? 0.3) * 100)),
  movePayout: String(saved?.move?.payout ?? 8),
});

/** What's saved for a draft, in the schema's order so saved and unsaved compare equal. */
export function afterOf(draft: AfterDraft): After {
  const pays = draft.behaviour !== 'growth';
  const grows = draft.behaviour !== 'income';
  return {
    behaviour: draft.behaviour,
    growth: grows ? Number(draft.growth) : 0,
    payout: pays && draft.payoutIn === 'percent' ? Number(draft.payout) : 0,
    ...(pays && draft.payoutIn === 'amount'
      ? { payoutFixed: { amount: Number(draft.payoutAmount), every: draft.payoutEvery } }
      : {}),
    sellable: pays ? draft.sellable : true,
    ...(grows && draft.moving
      ? { move: { share: Number(draft.moveShare) / 100, payout: Number(draft.movePayout) } }
      : {}),
  };
}

export const MOVED = ' → income';

export type Every = 'month' | 'quarter' | 'year';

export const EVERY = [
  ['month', 'Monthly'],
  ['quarter', 'Quarterly'],
  ['year', 'Yearly'],
] as const;

/** A fixed payout spread evenly over the months it covers, for the month-by-month plan. */
export const monthlyOf = ({ amount, every }: { amount: number; every: Every }) =>
  amount / (every === 'month' ? 1 : every === 'quarter' ? 3 : 12);

/**
 * The retirement planner's inputs from what's saved, as the planner works them out, for views
 * such as Plan's overview that show its result without the planner open. Null until a date of
 * birth is saved, or when a saved value is out of range.
 */
export function savedRetirementInputs(
  data: TrackerData,
  settings: TrackerSettings,
  today: string,
): RetirementInputs | null {
  const saved = settings.retirement;
  if (!saved?.birthDate) return null;
  const birthDate = saved.birthDate;
  const retirementIds = new Set(
    data.holdings.filter((row) => row.kind !== 'investment').map((row) => row.id),
  );
  const fundKind = saved.fund ?? DEFAULTS.fund;
  const fund =
    fundKind === 'retirement'
      ? data.holdings
          .filter((row) => retirementIds.has(row.id) && row.date <= today)
          .reduce((sum, row) => sum + holdingValue(row, data, today), 0)
      : netWorth(data, today).assets;
  const monthlyContribution =
    (saved.contributions ?? DEFAULTS.contributions)
      ? averageContributions(
          fundKind === 'retirement'
            ? {
                ...data,
                contributions: data.contributions.filter((row) => retirementIds.has(row.holdingId)),
              }
            : data,
          today.slice(0, 7),
        )
      : 0;
  const monthlyExpense = saved.monthlyExpense ?? monthlyAverages(data, today)?.expenses ?? 0;
  const growthAfter = saved.growthAfter ?? DEFAULTS.growthAfter;

  const groups = holdingGroups(
    data.holdings.filter(
      (row) => row.date <= today && (fundKind === 'all' || retirementIds.has(row.id)),
    ),
  )
    .map((group) => {
      const ids = new Set(group.holdings.map((row) => row.id));
      return {
        ...group,
        value: group.holdings.reduce((sum, row) => sum + holdingValue(row, data, today), 0),
        contributes: averageContributions(
          { ...data, contributions: data.contributions.filter((row) => ids.has(row.holdingId)) },
          today.slice(0, 7),
        ),
      };
    })
    .filter((group) => group.value > 0 || group.contributes > 0)
    .sort((a, b) => b.value - a.value);
  const each = (saved.afterMode ?? 'simple') === 'each' && groups.length > 0;
  const totalContributes = groups.reduce((sum, group) => sum + group.contributes, 0);
  const totalValue = groups.reduce((sum, group) => sum + group.value, 0);
  const parts: RetirementPart[] = groups.map((group) => {
    const after = afterOf(draftOf(saved.after?.[group.key], growthAfter));
    return {
      name: group.key,
      value: group.value,
      share:
        totalContributes > 0
          ? group.contributes / totalContributes
          : totalValue > 0
            ? group.value / totalValue
            : 1 / groups.length,
      growth: after.growth,
      payout: after.payout,
      ...(after.payoutFixed ? { payoutMonthly: monthlyOf(after.payoutFixed) } : {}),
      sellable: after.sellable,
      ...(after.move ? { move: after.move } : {}),
    };
  });

  const retireOn = saved.retireDate || addMonths(birthDate, RETIRE_AT * 12);
  const age = ageOn(birthDate, today);
  const retireAge = ageOn(birthDate, retireOn);
  const untilAge = saved.untilAge ?? DEFAULTS.untilAge;
  if (age < 18 || age > 100 || retireAge < 18 || retireAge > 100) return null;
  if (untilAge <= Math.max(age, retireAge) || !(monthlyExpense > 0)) return null;
  return {
    fund,
    monthlyExpense,
    monthlyContribution,
    stepUp: saved.stepUp ?? DEFAULTS.stepUp,
    age,
    retireAge,
    untilAge,
    inflation: saved.inflation ?? DEFAULTS.inflation,
    growthBefore: saved.growthBefore ?? DEFAULTS.growthBefore,
    growthAfter,
    monthsToRetire: monthsUntil(today, retireOn),
    months: monthsUntil(today, addMonths(birthDate, (untilAge + 1) * 12)),
    firstStretch: (16 - Number(today.slice(5, 7))) % 12 || 12,
    ...(each ? { parts } : {}),
  };
}
