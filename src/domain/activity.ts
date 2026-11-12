import type { Holding } from '../schema/records';
import { addDays } from './calendar';
import { holdingValue, receivedPayouts, type HoldingData } from './holdings';

/** Whether a name is only an account number, such as 100281757735. */
export const isAccountNumber = (name: string) =>
  /^[0-9Xx*]{6,}$/.test(name.replace(/[\s\-/]/g, ''));
const lastFour = (name: string) => name.replace(/[\s\-/]/g, '').slice(-4);

/**
 * A holding's name as it reads best in a list. A name that is only an account number, as PF,
 * PPF and NPS accounts often are, shows whose account it is instead, with its last four digits
 * added only when that person has another such account in the same list. Any other name
 * stays as it is.
 */
export function holdingDisplayName(
  holding: Pick<Holding, 'id' | 'name' | 'member'>,
  all: readonly Pick<Holding, 'id' | 'name' | 'member'>[],
) {
  if (!isAccountNumber(holding.name)) return holding.name;
  if (!holding.member) return `A/c ••${lastFour(holding.name)}`;
  const sameOwner = all.filter(
    (other) =>
      other.id !== holding.id && other.member === holding.member && isAccountNumber(other.name),
  );
  return sameOwner.length > 0 ? `${holding.member} ••${lastFour(holding.name)}` : holding.member;
}

export type ActivityKind = 'contribution' | 'scheduled' | 'valued' | 'withdrew' | 'interest';

export interface ActivityRow {
  id: string;
  kind: ActivityKind;
  date: string;
  holdingId: string;
  /** What came in, went out or was paid; for a value update, the new value. */
  amount: number;
  /** For a value update: how far it moved from the value just before it. */
  change?: number;
}

/**
 * The latest activity across some holdings, newest first: contributions (scheduled ones told
 * apart), value updates with how far each moved the value, withdrawals and interest paid
 * out. Nothing after `today` is included, so scheduled contributions still to come don't show.
 */
export function holdingActivity(
  holdings: readonly Holding[],
  data: HoldingData,
  today: string,
  limit = 6,
): ActivityRow[] {
  const ids = new Set(holdings.map((holding) => holding.id));
  const byId = new Map(holdings.map((holding) => [holding.id, holding]));
  const rows: ActivityRow[] = [
    ...data.contributions
      .filter((row) => ids.has(row.holdingId) && !row.skipped && row.date <= today)
      .map((row): ActivityRow => ({
        id: row.id,
        kind: row.automatic ? 'scheduled' : 'contribution',
        date: row.date,
        holdingId: row.holdingId,
        amount: row.amount,
      })),
    ...data.valuations
      .filter((row) => ids.has(row.holdingId) && row.date <= today)
      .map((row): ActivityRow => {
        const holding = byId.get(row.holdingId);
        // The value the day before, from earlier valuations and what was added since.
        const before =
          holding && holding.date < row.date
            ? holdingValue(holding, data, addDays(row.date, -1))
            : null;
        return {
          id: row.id,
          kind: 'valued',
          date: row.date,
          holdingId: row.holdingId,
          amount: row.value,
          ...(before === null ? {} : { change: row.value - before }),
        };
      }),
    ...holdings.flatMap((holding) =>
      receivedPayouts(holding.id, data.payouts ?? [])
        .filter((row) => row.date <= today)
        .map((row): ActivityRow => ({
          id: row.id,
          kind: 'interest',
          date: row.date,
          holdingId: row.holdingId,
          amount: row.amount,
        })),
    ),
    ...(data.withdrawals ?? [])
      .filter((row) => ids.has(row.holdingId) && row.date <= today)
      .map((row): ActivityRow => ({
        id: row.id,
        kind: 'withdrew',
        date: row.date,
        holdingId: row.holdingId,
        amount: row.amount,
      })),
  ];
  return rows.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
