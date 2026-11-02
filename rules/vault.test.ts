import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, setDoc, type Firestore } from 'firebase/firestore';
import { PRIVACY_VERSION } from '../src/domain/privacy';
import { firestoreRepository } from '../src/data/firestoreRepository';
import { COLLECTION_NAMES } from '../src/data/repository';
import type { RecordCodec } from '../src/data/crypto';
import {
  deleteHousehold,
  startVault,
  watchMembership,
  type DeviceAsk,
  type DeviceRequest,
  type OwnerTools,
  type VaultAccess,
  type VaultGate,
} from '../src/data/vault';

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

test('Face ID unlock opens the tracker, and turning it off retires it', async () => {
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const rawId = crypto.getRandomValues(new Uint8Array(16)).buffer;
  const credential = () => ({
    rawId,
    getClientExtensionResults: () => ({
      prf: { enabled: true, results: { first: secret.buffer } },
    }),
  });
  vi.stubGlobal('PublicKeyCredential', {
    isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true),
  });
  const credentials = {
    create: vi.fn(() => Promise.resolve(credential())),
    get: vi.fn(() => Promise.resolve(credential())),
  };
  vi.stubGlobal('navigator', { credentials });

  const { codec, tools } = await setUpOwner();
  await firestoreRepository(owner(), 'owner', codec).commit([
    { type: 'set', collection: 'income', id: income.id, value: income },
  ]);
  await expect(tools.passkey.enable('wrong passphrase')).rejects.toThrow('not correct');
  await tools.passkey.enable(PASS);

  const gate = gateOf(await start(owner(), 'owner', 'owner@example.com', 'owner'));
  expect(gate.canUsePasskey).toBe(true);
  const opened = await gate.unlockWithPasskey();
  if (opened.status !== 'open') throw new Error('Did not open');
  expect(await firstRow(owner(), opened.codec)).toEqual([income]);

  await tools.passkey.disable();
  const after = gateOf(await start(owner(), 'owner', 'owner@example.com', 'owner'));
  expect(after.canUsePasskey).toBe(false);
  vi.unstubAllGlobals();
});

test('turning on Face ID during setup needs no second passphrase, and opens the tracker', async () => {
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const rawId = crypto.getRandomValues(new Uint8Array(16)).buffer;
  const credential = () => ({
    rawId,
    getClientExtensionResults: () => ({
      prf: { enabled: true, results: { first: secret.buffer } },
    }),
  });
  vi.stubGlobal('PublicKeyCredential', {
    isUserVerifyingPlatformAuthenticatorAvailable: () => Promise.resolve(true),
  });
  vi.stubGlobal('navigator', {
    credentials: {
      create: () => Promise.resolve(credential()),
      get: () => Promise.resolve(credential()),
    },
  });
  const gate = gateOf(await start(owner(), 'owner', 'owner@example.com', 'owner'));
  const created = await gate.create(PASS);
  expect(created.passkeyAvailable).toBe(true);
  await created.enablePasskey();
  await expect(created.enter()).resolves.toMatchObject({ status: 'open' });
  const next = gateOf(await start(owner(), 'owner', 'owner@example.com', 'owner'));
  await expect(next.unlockWithPasskey()).resolves.toMatchObject({ status: 'open' });
  vi.unstubAllGlobals();
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

test('the owner hears about a request live, and a denied member is shut out', async () => {
  const { owner: tools } = await setUpOwner();
  const seen: string[][] = [];
  const stop = tools.watchRequests((rows) => seen.push(rows.map((row) => row.email)));
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
  await vi.waitFor(() => expect(seen.at(-1)).toEqual(['member@example.com']));
  const [request] = await tools.requests();
  if (!request) throw new Error('No request arrived');
  await tools.deny(request);
  await raw(async (db) => {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'memberships/member@example.com'));
  });
  await vi.waitFor(() => expect(seen.at(-1)).toEqual([]));
  stop();
  await expect(waiting.retry()).rejects.toThrow('no longer have access');
  expect(
    await raw(async (db) => (await getDoc(doc(db, 'households/owner/keys/member'))).exists()),
  ).toBe(false);
});

async function savedDevice() {
  const started = await start(owner(), 'owner', 'owner@example.com', 'owner');
  const access = await gateOf(started).unlock(PASS);
  if (access.status !== 'open') throw new Error('Saved device did not open');
  return access;
}

async function askFromNewDevice() {
  const gate = gateOf(await start(owner(), 'owner', 'owner@example.com', 'owner'));
  const answers: DeviceAsk[] = [];
  const stop = gate.askSavedDevice((ask) => answers.push(ask));
  await vi.waitFor(() => expect(answers[0]?.status).toBe('waiting'));
  return { answers, stop };
}

const seeRequests = (saved: Extract<VaultAccess, { status: 'open' }>) =>
  new Promise<DeviceRequest>((resolve) => {
    const stop = saved.tools.watchDevices(([request]) => {
      if (!request) return;
      setTimeout(() => stop());
      resolve(request);
    });
  });

test('a saved device can approve a new one, which then reads the records', async () => {
  const { codec } = await setUpOwner();
  await firestoreRepository(owner(), 'owner', codec).commit([
    { type: 'set', collection: 'income', id: income.id, value: income },
  ]);
  const saved = await savedDevice();
  const { answers, stop } = await askFromNewDevice();
  const request = await seeRequests(saved);
  expect(request.code).toBe((answers[0] as { code: string }).code);
  await saved.tools.approveDevice(request, PASS);
  await vi.waitFor(() => expect(answers.at(-1)?.status).toBe('approved'));
  const opened = answers.at(-1) as Extract<DeviceAsk, { status: 'approved' }>;
  if (opened.access.status !== 'open') throw new Error('New device did not open');
  expect(await firstRow(owner(), opened.access.codec)).toEqual([income]);
  stop();
  await vi.waitFor(async () => {
    const left = await raw((db) => getDocs(collection(db, 'keyrings/owner/deviceRequests')));
    expect(left.empty).toBe(true);
  });
});

test('a new device learns it was denied, and gets no key', async () => {
  await setUpOwner();
  const saved = await savedDevice();
  const { answers, stop } = await askFromNewDevice();
  const request = await seeRequests(saved);
  await saved.tools.denyDevice(request);
  await vi.waitFor(() => expect(answers.at(-1)?.status).toBe('denied'));
  stop();
});

test('approving needs the passphrase, and a swapped request is refused', async () => {
  await setUpOwner();
  const saved = await savedDevice();
  const { stop } = await askFromNewDevice();
  const request = await seeRequests(saved);
  await expect(saved.tools.approveDevice(request, 'not the passphrase')).rejects.toThrow(
    'That passphrase is not correct.',
  );
  await expect(
    saved.tools.approveDevice({ ...request, code: '0000 0000 0000' }, PASS),
  ).rejects.toThrow('This request has ended');
  stop();
});

test('another person cannot see or answer a device request', async () => {
  await setUpOwner();
  const { stop } = await askFromNewDevice();
  const stranger = login('stranger', 'stranger@example.com');
  await assertFails(getDocs(collection(stranger, 'keyrings/owner/deviceRequests')));
  await assertFails(setDoc(doc(stranger, 'keyrings/owner/deviceRequests/x'), { device: 'x' }));
  stop();
});

test('setup records which privacy page was agreed to', async () => {
  await setUpOwner();
  const keyring = await raw((db) => getDoc(doc(db, 'keyrings/owner')));
  expect(keyring.data()?.agreedToPrivacy).toBe(PRIVACY_VERSION);
});

test('a member hears as soon as their membership is removed', async () => {
  const { owner: tools } = await setUpOwner();
  await addMember(tools);
  const removed = vi.fn();
  const stop = watchMembership(member(), 'member@example.com', removed);
  await new Promise((done) => setTimeout(done, 200));
  expect(removed).not.toHaveBeenCalled();
  await raw(async (db) => {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'memberships/member@example.com'));
  });
  await vi.waitFor(() => expect(removed).toHaveBeenCalled());
  stop();
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

test('a damaged record does not stop a member being removed', async () => {
  const { codec, owner: tools } = await setUpOwner();
  await firestoreRepository(owner(), 'owner', codec).commit([
    { type: 'set', collection: 'income', id: income.id, value: income },
  ]);
  await addMember(tools);
  await raw((db) =>
    setDoc(doc(db, 'households/owner/income/bad'), { k: 1, iv: 'AAAA', c: 'AAAA' }),
  );
  await tools.removeMember('member@example.com');
  expect(await firstRow(owner(), codec)).toEqual([income]);
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
