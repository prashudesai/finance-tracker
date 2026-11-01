import {
  COLLECTION_NAMES,
  documentId,
  parseRows,
  type RecordWrite,
  type TrackerData,
} from '../data/repository';

const FORMAT = 'finance-tracker';
const VERSION = 2;

export function createBackup(data: TrackerData, exportedAt: string) {
  return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt, data }, null, 2);
}

/** Reads a backup, rejecting the whole file if any record is invalid. */
export function parseBackup(text: string): TrackerData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not a valid backup.');
  }
  const file = parsed as { format?: unknown; version?: unknown; data?: Record<string, unknown> };
  if (file?.format !== FORMAT || file.version !== VERSION || typeof file.data !== 'object') {
    throw new Error('This backup format is not supported.');
  }
  const data = {} as Record<keyof TrackerData, unknown>;
  for (const name of COLLECTION_NAMES) {
    const rows = file.data?.[name] ?? [];
    if (!Array.isArray(rows)) throw new Error('This backup is damaged.');
    const result = parseRows(name, rows);
    if (result.invalidCount > 0) {
      throw new Error(`${result.invalidCount} ${name} record(s) in this backup are invalid.`);
    }
    data[name] = result.rows;
  }
  return data as TrackerData;
}

/** Writes that delete everything held now. */
export function clearWrites(current: TrackerData): RecordWrite[] {
  return COLLECTION_NAMES.flatMap((collection) =>
    (current[collection] as object[]).map((row): RecordWrite => ({
      type: 'delete',
      collection,
      id: documentId(collection, row),
    })),
  );
}

/** Writes that replace everything held now with the backup's records. */
export function restoreWrites(current: TrackerData, backup: TrackerData): RecordWrite[] {
  const writes = COLLECTION_NAMES.flatMap((collection) =>
    (backup[collection] as object[]).map((value): RecordWrite => ({
      type: 'set',
      collection,
      id: documentId(collection, value),
      value,
    })),
  );
  const kept = new Set(writes.map((write) => `${write.collection}/${write.id}`));
  return [
    ...clearWrites(current).filter((write) => !kept.has(`${write.collection}/${write.id}`)),
    ...writes,
  ];
}
