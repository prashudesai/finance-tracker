import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';
import { firestoreRepository } from '../src/data/firestoreRepository';
import { COLLECTION_NAMES, documentId, type TrackerData } from '../src/data/repository';
import { previewData } from '../src/data/previewData';
import { clearWrites, restoreWrites } from '../src/domain/backup';
import { emptyTrackerData } from '../src/data/repository';

let env: RulesTestEnvironment;

const asOwner = () =>
  env
    .authenticatedContext('owner', { email: 'owner@example.com', email_verified: true })
    .firestore() as unknown as Firestore;

/** Waits for the next emission that satisfies `ready`. */
function nextRows<Name extends keyof TrackerData>(
  db: Firestore,
  name: Name,
  ready: (rows: TrackerData[Name], invalid: number) => boolean,
) {
  return new Promise<{ rows: TrackerData[Name]; invalid: number }>((done, fail) => {
    const stop = firestoreRepository(db, 'owner').subscribe(
      name,
      (rows, invalid) => {
        if (ready(rows, invalid)) {
          setTimeout(() => stop());
          done({ rows, invalid });
        }
      },
      fail,
    );
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-finance-repository',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
});

afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

test('records round-trip through Firestore and pass their schemas', async () => {
  const db = asOwner();
  const seed = { ...emptyTrackerData(), ...previewData() };
  await firestoreRepository(db, 'owner').commit(restoreWrites(emptyTrackerData(), seed));

  for (const name of COLLECTION_NAMES) {
    const expected = seed[name] as object[];
    if (expected.length === 0) continue;
    const { rows, invalid } = await nextRows(db, name, (found) => found.length === expected.length);
    expect(invalid, name).toBe(0);
    const byId = (list: object[]) =>
      [...list].sort((a, b) => documentId(name, a).localeCompare(documentId(name, b)));
    expect(byId(rows as object[]), name).toEqual(byId(expected));
  }
});

test('undefined optional fields save without error', async () => {
  const db = asOwner();
  const row = {
    id: 'i',
    date: '2026-01-01',
    member: 'A',
    source: 'Salary',
    amount: 5,
    notes: undefined,
  };
  await firestoreRepository(db, 'owner').commit([
    { type: 'set', collection: 'income', id: 'i', value: row },
  ]);
  const { rows } = await nextRows(db, 'income', (found) => found.length === 1);
  expect(rows[0]?.amount).toBe(5);
});

test('a second device sees changes live', async () => {
  const device = asOwner();
  const other = asOwner();
  const seen = nextRows(other, 'income', (found) => found.some((row) => row.id === 'live'));
  await firestoreRepository(device, 'owner').commit([
    {
      type: 'set',
      collection: 'income',
      id: 'live',
      value: { id: 'live', date: '2026-01-01', member: 'A', source: 'S', amount: 1 },
    },
  ]);
  expect((await seen).rows).toHaveLength(1);
});

test('an invalid document is counted, not shown', async () => {
  const db = asOwner();
  await setDoc(doc(db, 'households/owner/income/bad'), { amount: -1 });
  const { rows, invalid } = await nextRows(db, 'income', (_, count) => count === 1);
  expect(rows).toEqual([]);
  expect(invalid).toBe(1);
});

test('clearing removes every record', async () => {
  const db = asOwner();
  const seed = { ...emptyTrackerData(), ...previewData() };
  const repository = firestoreRepository(db, 'owner');
  await repository.commit(
    seed.income.map((value) => ({ type: 'set', collection: 'income', id: value.id, value })),
  );
  await repository.commit(clearWrites({ ...emptyTrackerData(), income: seed.income }));
  const { rows } = await nextRows(db, 'income', (found) => found.length === 0);
  expect(rows).toEqual([]);
});

test('deleting an account leaves nothing in any collection', async () => {
  const db = asOwner();
  const seed = { ...emptyTrackerData(), ...previewData() };
  const repository = firestoreRepository(db, 'owner');
  await repository.commit(restoreWrites(emptyTrackerData(), seed));
  await repository.commit(clearWrites(seed));
  for (const name of COLLECTION_NAMES) {
    const { rows } = await nextRows(db, name, (found) => found.length === 0);
    expect(rows, name).toEqual([]);
  }
});

test('a commit larger than one batch saves every record', async () => {
  const db = asOwner();
  const value = { id: 'x', date: '2026-01-01', member: 'A', source: 'S', amount: 1 };
  const writes = Array.from({ length: 901 }, (_, index) => ({
    type: 'set' as const,
    collection: 'income' as const,
    id: `i${index}`,
    value: { ...value, id: `i${index}` },
  }));
  await firestoreRepository(db, 'owner').commit(writes);
  const { rows } = await nextRows(db, 'income', (found) => found.length === 901);
  expect(rows).toHaveLength(901);
});
