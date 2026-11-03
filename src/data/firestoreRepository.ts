import {
  collection,
  doc,
  onSnapshot,
  waitForPendingWrites,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import type { RecordCodec, SealedRecord } from './crypto';
import { parseRows, type CollectionName, type TrackerRepository } from './repository';

const BATCH_SIZE = 400;

/** Firestore rejects `undefined`, which optional form fields produce. */
function stripUndefined(value: object) {
  return JSON.parse(JSON.stringify(value)) as object;
}

const isSealed = (stored: object): stored is SealedRecord => 'c' in stored;

/** Every record passes through `codec`, so the database only sees locked data. */
export function firestoreRepository(
  db: Firestore,
  householdId: string,
  codec: RecordCodec,
): TrackerRepository {
  const path = (name: CollectionName) => `households/${householdId}/${name}`;
  return {
    subscribe(name, onRows, onError) {
      let latest = 0;
      // One change shouldn't mean decrypting a whole collection again.
      let opened = new Map<string, { c: string; value: Promise<unknown> }>();
      return onSnapshot(
        collection(db, path(name)),
        (snapshot) => {
          latest += 1;
          const version = latest;
          const current = new Map<string, { c: string; value: Promise<unknown> }>();
          for (const row of snapshot.docs) {
            const stored = row.data();
            // Records saved before encryption are left alone and not shown.
            if (!isSealed(stored)) continue;
            const known = opened.get(row.id);
            current.set(
              row.id,
              known?.c === stored.c
                ? known
                : {
                    c: stored.c,
                    value: codec.open(name, row.id, stored).catch(() => undefined),
                  },
            );
          }
          opened = current;
          void Promise.all([...current.values()].map((row) => row.value)).then((rows) => {
            // Decrypting takes time, so an older snapshot may finish after a newer one.
            if (version !== latest) return;
            const { rows: valid, invalidCount } = parseRows(name, rows);
            onRows(valid, invalidCount);
          });
        },
        onError,
      );
    },
    flush: () => waitForPendingWrites(db),
    /** Sent in batches, so a large restore stays within Firestore's request limits. */
    async commit(writes) {
      const sealed = await Promise.all(
        writes.map(async (write) => {
          const id = await codec.documentId(write.collection, write.id);
          const target = doc(db, path(write.collection), id);
          if (write.type === 'delete') return { target, value: null };
          const value = stripUndefined(write.value);
          return { target, value: await codec.seal(write.collection, id, value) };
        }),
      );
      for (let start = 0; start < sealed.length; start += BATCH_SIZE) {
        const batch = writeBatch(db);
        for (const { target, value } of sealed.slice(start, start + BATCH_SIZE)) {
          if (value) batch.set(target, value);
          else batch.delete(target);
        }
        await batch.commit();
      }
    },
  };
}
