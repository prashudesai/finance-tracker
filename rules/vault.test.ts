import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, type Firestore } from 'firebase/firestore';
import { firestoreRepository } from '../src/data/firestoreRepository';
import { COLLECTION_NAMES } from '../src/data/repository';
import type { RecordCodec } from '../src/data/crypto';
import { deleteHousehold, startVault, type OwnerTools, type VaultGate } from '../src/data/vault';

const PASS = 'correct horse battery';
const income = {
  id: 'salary-record',
  date: '2026-03-01',
  member: 'Alex Morgan',
  source: 'Secret Employer',
  amount: 123_456,
};

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

const start = (db: Firestore, uid: string, email: string, householdId: string, editor = false) =>
  startVault(
    db,
    { uid, email },
    { householdId, role: uid === householdId ? 'owner' : editor ? 'editor' : 'viewer' },
  );

function gateOf(started: Awaited<ReturnType<typeof start>>): VaultGate {
  if ('gate' in started) return started.gate;
  throw new Error('Expected to be asked for a passphrase');
}

/** Node has no device storage, so every start here is like a new device. */
async function setUpOwner() {
  const gate = gateOf(await start(owner(), 'owner', 'owner@example.com', 'owner'));
  const created = await gate.create(PASS);
  const access = await created.enter();
  if (access.status !== 'open' || !access.owner) throw new Error('Owner did not open');
  return { ...access, owner: access.owner, recoveryCode: created.recoveryCode };
}

async function addMember(tools: OwnerTools) {
  await raw((db) =>
    setDoc(doc(db, 'memberships/member@example.com'), {
      householdId: 'owner',
      role: 'editor',
      accepted: true,
    }),
  );
  const gate = gateOf(await start(member(), 'member', 'member@example.com', 'owner', true));
  const waiting = await (await gate.create(PASS)).enter();
  if (waiting.status !== 'waiting') throw new Error('Member should be waiting');
  const [request] = await tools.requests();
  if (!request) throw new Error('No request arrived');
  expect(request.code).toBe(waiting.code);
  await tools.approve(request);
  const opened = await waiting.retry();
  if (opened.status !== 'open') throw new Error('Member did not open');
  return opened;
}

function firstRow(db: Firestore, codec: RecordCodec) {
  return new Promise<unknown[]>((done, fail) => {
    const stop = firestoreRepository(db, 'owner', codec).subscribe(
      'income',
      (rows) => {
        setTimeout(() => stop());
        done(rows);
      },
      fail,
    );
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-finance-vault',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
});

afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

test('nothing readable reaches the database', async () => {
  const { codec } = await setUpOwner();
  const repository = firestoreRepository(owner(), 'owner', codec);
  await repository.commit([
    { type: 'set', collection: 'income', id: income.id, value: income },
    {
      type: 'set',
      collection: 'monthlyBalances',
      id: '2026-03',
      value: { month: '2026-03', startBalance: 777_888 },
    },
  ]);
  const stored = await raw(async (db) => {
    const found: { id: string; data: unknown }[] = [];
    for (const name of [...COLLECTION_NAMES, 'keys']) {
      const rows = await getDocs(collection(db, 'households/owner', name));
      for (const row of rows.docs) found.push({ id: row.id, data: row.data() });
    }
    const keyring = await getDoc(doc(db, 'keyrings/owner'));
    found.push({ id: keyring.id, data: keyring.data() });
    return JSON.stringify(found);
  });
  for (const secret of [
    'Secret Employer',
    'Alex Morgan',
    'salary-record',
    '123456',
    '777888',
    '2026-03',
    PASS,
  ]) {
    expect(stored, secret).not.toContain(secret);
  }
  expect(await firstRow(owner(), codec)).toEqual([income]);
});

test('another device opens with the passphrase or recovery code, not a wrong one', async () => {
  const { codec, recoveryCode } = await setUpOwner();
  await firestoreRepository(owner(), 'owner', codec).commit([
    { type: 'set', collection: 'income', id: income.id, value: income },
  ]);
  const gate = gateOf(await start(owner(), 'owner', 'owner@example.com', 'owner'));
  expect(gate.hasKeyring).toBe(true);
  await expect(gate.unlock('not the passphrase')).rejects.toThrow('not correct');
  const opened = await gate.unlock(PASS);
  if (opened.status !== 'open') throw new Error('Did not open');
  expect(await firstRow(owner(), opened.codec)).toEqual([income]);

  const recovered = await gate.recover(recoveryCode, 'a replacement passphrase');
  if (recovered.status !== 'open') throw new Error('Did not recover');
  await expect(gate.unlock(PASS)).rejects.toThrow('not correct');
  await expect(gate.unlock('a replacement passphrase')).resolves.toMatchObject({ status: 'open' });
});

test('a family member reads shared records only after the owner approves', async () => {
  const { codec, owner: tools } = await setUpOwner();
  await firestoreRepository(owner(), 'owner', codec).commit([
    { type: 'set', collection: 'income', id: income.id, value: income },
  ]);
  const opened = await addMember(tools);
  expect(await firstRow(member(), opened.codec)).toEqual([income]);
  expect(await tools.requests()).toEqual([]);

  // What the member saves, the owner can read.
  const shared = { ...income, id: 'from-member' };
  await firestoreRepository(member(), 'owner', opened.codec).commit([
    { type: 'set', collection: 'income', id: shared.id, value: shared },
  ]);
  const rows = (await firstRow(owner(), codec)) as { id: string }[];
  expect(rows.map((row) => row.id).sort()).toEqual(['from-member', 'salary-record']);
});

test('approval is refused if the key changed after the code was shown', async () => {
  const { owner: tools } = await setUpOwner();
  await raw((db) =>
    setDoc(doc(db, 'memberships/member@example.com'), {
      householdId: 'owner',
      role: 'editor',
      accepted: true,
    }),
  );
  const gate = gateOf(await start(member(), 'member', 'member@example.com', 'owner', true));
  await (await gate.create(PASS)).enter();
  const [request] = await tools.requests();
  if (!request) throw new Error('No request arrived');
  await raw((db) =>
    setDoc(doc(db, 'households/owner/requests/member'), {
      email: 'member@example.com',
      publicKey: { kty: 'EC', crv: 'P-256', x: 'swapped', y: 'swapped' },
    }),
  );
  await expect(tools.approve(request)).rejects.toThrow('changed');
  expect(
    await raw(async (db) => (await getDoc(doc(db, 'households/owner/keys/member'))).exists()),
  ).toBe(false);
});

test('a removed member cannot read anything, even with the stored data', async () => {
  const { codec, owner: tools } = await setUpOwner();
  await firestoreRepository(owner(), 'owner', codec).commit([
    { type: 'set', collection: 'income', id: income.id, value: income },
  ]);
  const removed = await addMember(tools);
  await tools.removeMember('member@example.com');

  const rows = await raw((db) => getDocs(collection(db, 'households/owner/income')));
  const [stored] = rows.docs;
  if (!stored) throw new Error('Record is missing');
  expect(stored.data().k).toBe(2);
  // Handing them the ciphertext directly doesn't help: their key is out of date.
  await expect(removed.codec.open('income', stored.id, stored.data() as never)).rejects.toThrow();
  expect(
    await raw(async (db) => (await getDoc(doc(db, 'households/owner/keys/member'))).exists()),
  ).toBe(false);

  // The owner carries on, on this device and a new one.
  expect(await firstRow(owner(), codec)).toEqual([income]);
  const again = await gateOf(await start(owner(), 'owner', 'owner@example.com', 'owner')).unlock(
    PASS,
  );
  if (again.status !== 'open') throw new Error('Did not open');
  expect(await firstRow(owner(), again.codec)).toEqual([income]);
});

test('a remaining member follows the new key without being approved again', async () => {
  const { codec, owner: tools } = await setUpOwner();
  const staying = await addMember(tools);
  await tools.removeMember('someone-else@example.com');
  await firestoreRepository(owner(), 'owner', codec).commit([
    { type: 'set', collection: 'income', id: income.id, value: income },
  ]);
  expect(await firstRow(member(), staying.codec)).toEqual([income]);
});

test('missing keys never overwrite a tracker that is already encrypted', async () => {
  const { codec } = await setUpOwner();
  await firestoreRepository(owner(), 'owner', codec).commit([
    { type: 'set', collection: 'income', id: income.id, value: income },
  ]);
  await raw(async (db) => {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'households/owner/keys/owner'));
  });
  const gate = gateOf(await start(owner(), 'owner', 'owner@example.com', 'owner'));
  await expect(gate.unlock(PASS)).rejects.toThrow('missing');
});

test('deleting a tracker leaves nothing behind, including old readable records', async () => {
  const { codec, owner: tools } = await setUpOwner();
  await firestoreRepository(owner(), 'owner', codec).commit([
    { type: 'set', collection: 'income', id: income.id, value: income },
  ]);
  await addMember(tools);
  await raw((db) => setDoc(doc(db, 'households/owner/expenses/old'), { amount: 5 }));
  await deleteHousehold(owner(), 'owner');
  const left = await raw(async (db) => {
    let count = 0;
    for (const name of [...COLLECTION_NAMES, 'keys', 'requests']) {
      count += (await getDocs(collection(db, 'households/owner', name))).size;
    }
    return count;
  });
  expect(left).toBe(0);
});
