import {
  COLLECTIONS,
  documentId,
  type CollectionName,
  type RecordWrite,
  type TrackerData,
} from '../data/repository';
import type { ChangeRecord } from '../schema/records';

const MAX_ENTRIES = 50;
export const MAX_CHANGES = 200;

const LABELS: Partial<Record<CollectionName, string>> = {
  income: 'income',
  expenses: 'expense',
  loans: 'loan',
  recurringRules: 'recurring item',
  recurringOccurrences: 'recurring entry',
  monthlyBalances: 'monthly balance',
  holdings: 'holding',
  contributions: 'contribution',
  valuations: 'valuation',
  gratuityAccounts: 'gratuity account',
  projectionAdjustments: 'planned change',
  interestCredits: 'interest credit',
  epsUpdates: 'EPS correction',
  statementChecks: 'statement check',
};

const find = (data: TrackerData, collection: CollectionName, id: string) =>
  (data[collection] as object[]).find((row) => documentId(collection, row) === id) ?? null;

/** Firestore drops undefined, so what is logged matches what is saved. */
const plain = (value: unknown): unknown =>
  value === undefined ? null : JSON.parse(JSON.stringify(value));

function describe(value: unknown) {
  const row = (value ?? {}) as Record<string, unknown>;
  const name = row.name ?? row.source ?? row.category ?? row.type ?? row.month;
  return typeof name === 'string' ? ` · ${name}` : '';
}

function summarize(writes: (RecordWrite & { collection: CollectionName })[], data: TrackerData) {
  const [first] = writes;
  if (writes.length > 1 || !first) return `Changed ${writes.length} records`;
  const before = find(data, first.collection, first.id);
  const verb = first.type === 'delete' ? 'Deleted' : before ? 'Changed' : 'Added';
  const value = first.type === 'set' ? first.value : before;
  return `${verb} ${LABELS[first.collection]}${describe(value)}`;
}

/** A log entry for financial writes, or null when nothing financial changed. */
export function buildChange(
  data: TrackerData,
  writes: RecordWrite[],
  meta: { id: string; at: string; actor: string },
): ChangeRecord | null {
  const tracked = writes.filter((write) => LABELS[write.collection]);
  if (tracked.length === 0) return null;
  return {
    ...meta,
    summary: summarize(tracked, data),
    count: tracked.length,
    // Very large changes keep only their summary, to stay within one document.
    entries:
      tracked.length > MAX_ENTRIES
        ? []
        : tracked.map((write) => ({
            collection: write.collection,
            docId: write.id,
            before: plain(find(data, write.collection, write.id)),
            after: write.type === 'set' ? plain(write.value) : null,
          })),
    undone: false,
  };
}

/** Normalises a stored row, so defaults and key order don't look like a change. */
function canonical(collection: CollectionName, value: unknown) {
  if (value === null || value === undefined) return 'null';
  const parsed = COLLECTIONS[collection].safeParse(value);
  const row = (parsed.success ? parsed.data : value) as Record<string, unknown>;
  return JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)));
}

/** Writes that put records back. Throws rather than overwrite a later edit. */
export function undoWrites(data: TrackerData, change: ChangeRecord): RecordWrite[] {
  return change.entries.map((entry) => {
    const collection = entry.collection as CollectionName;
    const current = find(data, collection, entry.docId);
    if (canonical(collection, current) !== canonical(collection, entry.after)) {
      throw new Error(`A record in "${change.summary}" has changed since, so this was not undone.`);
    }
    return entry.before === null || entry.before === undefined
      ? { type: 'delete', collection, id: entry.docId }
      : { type: 'set', collection, id: entry.docId, value: entry.before as object };
  });
}

/** Deletes the oldest entries beyond the limit. */
export function pruneWrites(changes: ChangeRecord[]): RecordWrite[] {
  return [...changes]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(MAX_CHANGES - 1)
    .map((row) => ({ type: 'delete', collection: 'changes', id: row.id }));
}
