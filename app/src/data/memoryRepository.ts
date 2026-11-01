import {
  COLLECTION_NAMES,
  parseRows,
  type CollectionName,
  type RecordWrite,
  type TrackerData,
  type TrackerRepository,
} from './repository';

/** An in-process backend for tests and the local preview. Nothing is persisted. */
export function createMemoryRepository(seed: Partial<TrackerData> = {}): TrackerRepository {
  const stores = new Map<CollectionName, Map<string, object>>(
    COLLECTION_NAMES.map((name) => [
      name,
      new Map((seed[name] ?? []).map((row, index) => [storedId(row, index), row])),
    ]),
  );
  const listeners = new Map<CollectionName, Set<() => void>>(
    COLLECTION_NAMES.map((name) => [name, new Set()]),
  );

  return {
    subscribe(name, onRows) {
      const emit = () => {
        const { rows, invalidCount } = parseRows(name, [...(stores.get(name)?.values() ?? [])]);
        onRows(rows, invalidCount);
      };
      const group = listeners.get(name);
      group?.add(emit);
      emit();
      return () => group?.delete(emit);
    },
    async commit(writes: RecordWrite[]) {
      for (const write of writes) {
        const store = stores.get(write.collection);
        if (write.type === 'set') store?.set(write.id, write.value);
        else store?.delete(write.id);
      }
      for (const name of new Set(writes.map((write) => write.collection))) {
        for (const emit of listeners.get(name) ?? []) emit();
      }
    },
  };
}

function storedId(row: object, index: number) {
  return 'id' in row && typeof row.id === 'string' ? row.id : String(index);
}
