import {
  collection,
  doc,
  onSnapshot,
  waitForPendingWrites,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import { parseRows, type CollectionName, type TrackerRepository } from './repository';

const BATCH_SIZE = 400;

/** Firestore rejects `undefined`, which optional form fields produce. */
function stripUndefined(value: object) {
  return JSON.parse(JSON.stringify(value)) as object;
}

export function firestoreRepository(db: Firestore, householdId: string): TrackerRepository {
  const path = (name: CollectionName) => `households/${householdId}/${name}`;
  return {
    subscribe(name, onRows, onError) {
      return onSnapshot(
        collection(db, path(name)),
        (snapshot) => {
          const { rows, invalidCount } = parseRows(
            name,
            snapshot.docs.map((row) => row.data()),
          );
          onRows(rows, invalidCount);
        },
        onError,
      );
    },
    flush: () => waitForPendingWrites(db),
    /** Sent in batches, so a large restore stays within Firestore's request limits. */
    async commit(writes) {
      for (let start = 0; start < writes.length; start += BATCH_SIZE) {
        const batch = writeBatch(db);
        for (const write of writes.slice(start, start + BATCH_SIZE)) {
          const target = doc(db, path(write.collection), write.id);
          if (write.type === 'set') batch.set(target, stripUndefined(write.value));
          else batch.delete(target);
        }
        await batch.commit();
      }
    },
  };
}
