import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  disableNetwork,
  doc,
  enableNetwork,
  getDoc,
  getDocs,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { firestoreRepository } from '../src/data/firestoreRepository';
import type { RecordCodec } from '../src/data/crypto';
import { deleteKeyring, deleteMemberKeys, startVault, type VaultGate } from '../src/data/vault';

const PASS = 'correct horse battery';
const income = (id: string) => ({
  id,
  date: '2026-03-01',
  member: 'Alex Morgan',
  source: 'Secret Employer',
  amount: 123_456,
});

let env: RulesTestEnvironment;

const login = (uid: string, email: string) =>
  env
    .authenticatedContext(uid, { email, email_verified: true })
    .firestore() as unknown as Firestore;
const owner = () => login('owner', 'owner@example.com');
const member = () => login('member', 'member@example.com');
const raw = <Result>(run: (db: Firestore) => Promise<Result>) => {
  let result: Result;
  return env
    .withSecurityRulesDisabled(async (context) => {
      result = await run(context.firestore() as unknown as Firestore);
    })
    .then(() => result);
};

function gateOf(started: Awaited<ReturnType<typeof startVault>>): VaultGate {
  if ('gate' in started) return started.gate;
  throw new Error('Expected to be asked for a passphrase');
}

const startOwner = (db: Firestore) =>
  startVault(
    db,
    { uid: 'owner', email: 'owner@example.com' },
    { householdId: 'owner', role: 'owner' },
  );

async function setUpOwner() {
  const created = await gateOf(await startOwner(owner())).create(PASS);
  const access = await created.enter();
  if (access.status !== 'open' || !access.owner) throw new Error('Owner did not open');
  return { ...access, owner: access.owner, recoveryCode: created.recoveryCode };
}

async function addMember(
  tools: Awaited<ReturnType<typeof setUpOwner>>['owner'],
  role: 'editor' | 'viewer',
) {
  await raw((db) =>
    setDoc(doc(db, 'memberships/member@example.com'), {
      householdId: 'owner',
      role,
      accepted: true,
    }),
  );
  const gate = gateOf(
    await startVault(
      member(),
      { uid: 'member', email: 'member@example.com' },
      { householdId: 'owner', role },
    ),
  );
  const waiting = await (await gate.create(PASS)).enter();
  if (waiting.status !== 'waiting') throw new Error('Member should be waiting');
  const [request] = await tools.requests();
  if (!request) throw new Error('No request arrived');
  await tools.approve(request);
  const opened = await waiting.retry();
  if (opened.status !== 'open') throw new Error('Member did not open');
  return opened;
}

function rowsOf(
  db: Firestore,
  codec: RecordCodec,
  ready: (rows: unknown[]) => boolean = () => true,
) {
  return new Promise<{ rows: { id: string }[]; invalid: number }>((done, fail) => {
    const stop = firestoreRepository(db, 'owner', codec).subscribe(
      'income',
      (rows, invalid) => {
        if (!ready(rows)) return;
        setTimeout(() => stop());
        done({ rows, invalid });
      },
      fail,
    );
  });
}

const stored = (name = 'income') =>
  raw(async (db) => (await getDocs(collection(db, 'households/owner', name))).docs);

async function seed(codec: RecordCodec, count: number) {
  await firestoreRepository(owner(), 'owner', codec).commit(
    Array.from({ length: count }, (_, index) => {
      const value = income(`row-${index}`);
      return { type: 'set' as const, collection: 'income' as const, id: value.id, value };
    }),
  );
}

async function tamper(id: string, name = 'income') {
  await raw(async (db) => {
    const row = await getDoc(doc(db, 'households/owner', name, id));
    const data = row.data() as { c: string };
    const flipped = data.c.startsWith('A') ? `B${data.c.slice(1)}` : `A${data.c.slice(1)}`;
    await setDoc(row.ref, { ...data, c: flipped });
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-finance-vault-safety',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
});

afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

test('a tampered record is hidden and counted, and the rest stay readable', async () => {
  const { codec } = await setUpOwner();
  await seed(codec, 3);
  const [first] = await stored();
  if (!first) throw new Error('Nothing stored');
  await tamper(first.id);
  const { rows, invalid } = await rowsOf(owner(), codec);
  expect(rows).toHaveLength(2);
  expect(invalid).toBe(1);
});

test('a record moved to another place fails to open', async () => {
  const { codec } = await setUpOwner();
  await seed(codec, 1);
  const [first] = await stored();
  if (!first) throw new Error('Nothing stored');
  const sealed = first.data();
  await raw((db) => setDoc(doc(db, 'households/owner/income/elsewhere'), sealed));
  await raw((db) => setDoc(doc(db, 'households/owner/expenses', first.id), sealed));
  await expect(codec.open('income', 'elsewhere', sealed as never)).rejects.toThrow();
  await expect(codec.open('expenses', first.id, sealed as never)).rejects.toThrow();
  const { rows, invalid } = await rowsOf(owner(), codec);
  expect(rows).toHaveLength(1);
  expect(invalid).toBe(1);
});

test('a viewer can read but every kind of write is refused', async () => {
  const { codec, owner: tools } = await setUpOwner();
  await seed(codec, 1);
  const viewer = await addMember(tools, 'viewer');
  expect((await rowsOf(member(), viewer.codec)).rows).toHaveLength(1);

  await expect(
    firestoreRepository(member(), 'owner', viewer.codec).commit([
      { type: 'set', collection: 'income', id: 'nope', value: income('nope') },
    ]),
  ).rejects.toThrow();
  const [first] = await stored();
  if (!first) throw new Error('Nothing stored');
  await assertFails(deleteDoc(doc(member(), 'households/owner/income', first.id)));
  await assertFails(
    setDoc(doc(member(), 'households/owner/keys/member'), {
      email: 'member@example.com',
      publicKey: {},
      locked: {},
    }),
  );
  await assertFails(getDoc(doc(member(), 'households/owner/keys/owner')));
});

test('a saved record stays encrypted while waiting offline, then reaches the server', async () => {
  const { codec } = await setUpOwner();
  const db = owner();
  await disableNetwork(db);
  const saving = firestoreRepository(db, 'owner', codec).commit([
    { type: 'set', collection: 'income', id: 'offline', value: income('offline') },
  ]);
  const shown = await rowsOf(db, codec, (rows) => rows.length > 0);
  expect(shown.rows.map((row) => row.id)).toEqual(['offline']);
  expect(await stored()).toHaveLength(0);

  await enableNetwork(db);
  await saving;
  const [row] = await stored();
  expect(Object.keys(row?.data() ?? {}).sort()).toEqual(['c', 'iv', 'k']);
  expect(JSON.stringify(row?.data())).not.toContain('Secret Employer');
});

test('a changed passphrase and a new recovery code retire the old ones everywhere', async () => {
  const { tools, recoveryCode } = await setUpOwner();
  await expect(tools.changePassphrase('not it', 'a brand new passphrase')).rejects.toThrow(
    'not correct',
  );
  await tools.changePassphrase(PASS, 'a brand new passphrase');
  const fresh = await tools.newRecoveryCode('a brand new passphrase');
  const gate = gateOf(await startOwner(owner()));
  await expect(gate.unlock(PASS)).rejects.toThrow('not correct');
  await expect(gate.recover(recoveryCode, 'one more passphrase')).rejects.toThrow('not correct');
  await expect(gate.recover(fresh, 'one more passphrase')).resolves.toMatchObject({
    status: 'open',
  });
});

test('a member deleting their account removes only their own access', async () => {
  const { codec, owner: tools } = await setUpOwner();
  await seed(codec, 1);
  await addMember(tools, 'editor');
  const db = member();
  await deleteMemberKeys(db, 'member', 'owner');
  await deleteDoc(doc(db, 'memberships/member@example.com'));
  await deleteKeyring(db, 'member');

  const left = await raw(async (admin) => ({
    keys: (await getDoc(doc(admin, 'households/owner/keys/member'))).exists(),
    keyring: (await getDoc(doc(admin, 'keyrings/member'))).exists(),
    membership: (await getDoc(doc(admin, 'memberships/member@example.com'))).exists(),
  }));
  expect(left).toEqual({ keys: false, keyring: false, membership: false });
  await assertFails(getDocs(collection(member(), 'households/owner/income')));
  expect((await rowsOf(owner(), codec)).rows).toHaveLength(1);
});

test('removing a member again after a failure loses no records', async () => {
  const { codec, owner: tools } = await setUpOwner();
  await seed(codec, 6);
  const expense = {
    id: 'bill',
    date: '2026-03-02',
    category: 'Utilities',
    subcategory: '',
    amount: 900,
    isAnnual: false,
  };
  await firestoreRepository(owner(), 'owner', codec).commit([
    { type: 'set', collection: 'expenses', id: expense.id, value: expense },
  ]);
  await addMember(tools, 'editor');

  // Income is re-encrypted first, then one unreadable expense stops the job partway.
  const [bill] = await stored('expenses');
  if (!bill) throw new Error('Nothing stored');
  const original = bill.data();
  await tamper(bill.id, 'expenses');
  await expect(tools.removeMember('member@example.com')).rejects.toThrow();
  expect((await stored()).every((row) => row.data().k === 2)).toBe(true);

  await raw((db) => setDoc(doc(db, 'households/owner/expenses', bill.id), original));
  await tools.removeMember('member@example.com');

  // A new device, holding only what the server has, reads everything.
  const again = await gateOf(await startOwner(owner())).unlock(PASS);
  if (again.status !== 'open') throw new Error('Did not open');
  const { rows, invalid } = await rowsOf(owner(), again.codec);
  expect(invalid).toBe(0);
  expect(rows).toHaveLength(6);
});
