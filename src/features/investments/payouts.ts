import type { RecordWrite } from '../../data/repository';
import type { Holding, Income, Payout } from '../../schema/records';
import { useTracker } from '../../store/tracker';

export const PAYOUT_SOURCE = 'Investments';

/** Saves a payout as received, with the income it brought in, or updates both. */
export function receivedWrites(holding: Holding, payout: Payout, amount: number): RecordWrite[] {
  const incomeId = payout.incomeId ?? crypto.randomUUID();
  const income: Income = {
    id: incomeId,
    date: payout.date,
    member: holding.member,
    source: PAYOUT_SOURCE,
    amount,
    notes: `${holding.name} interest`,
  };
  const row: Payout = { ...payout, amount, incomeId };
  delete row.skipped;
  return [
    { type: 'set', collection: 'payouts', id: row.id, value: row },
    { type: 'set', collection: 'income', id: incomeId, value: income },
  ];
}

/** Records a payout as not received, so it isn't asked for again. */
export const skippedWrites = (payout: Payout): RecordWrite[] => [
  {
    type: 'set',
    collection: 'payouts',
    id: payout.id,
    value: {
      id: payout.id,
      holdingId: payout.holdingId,
      date: payout.date,
      amount: 0,
      skipped: true,
    },
  },
  ...(payout.incomeId
    ? [{ type: 'delete', collection: 'income', id: payout.incomeId } as const]
    : []),
];

/** Removes a recorded payout and its income. A scheduled one will be asked for again. */
export const removedWrites = (payout: Payout): RecordWrite[] => [
  { type: 'delete', collection: 'payouts', id: payout.id },
  ...(payout.incomeId
    ? [{ type: 'delete', collection: 'income', id: payout.incomeId } as const]
    : []),
];

export function usePayouts() {
  const data = useTracker((state) => state.data);
  const commit = useTracker((state) => state.commit);
  const holdingOf = (payout: Payout) => data.holdings.find((row) => row.id === payout.holdingId);
  return {
    receive(payout: Payout, amount = payout.amount) {
      const holding = holdingOf(payout);
      if (holding && amount > 0) commit(receivedWrites(holding, payout, amount));
    },
    skip: (payout: Payout) => commit(skippedWrites(payout)),
    remove: (payout: Payout) => commit(removedWrites(payout)),
  };
}
