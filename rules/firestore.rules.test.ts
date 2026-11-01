import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';

let env: RulesTestEnvironment;

const person = (uid: string, email: string, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();

const owner = () => person('owner', 'owner@example.com');
const editor = () => person('ed', 'editor@example.com');
const viewer = () => person('vi', 'viewer@example.com');
const stranger = () => person('st', 'stranger@example.com');
const record = 'households/owner/income/a';
const sealed = { k: 1, iv: 'aXY=', c: 'Yw==' };

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-finance-tracker',
    firestore: { rules: readFileSync(resolve(__dirname, '../firestore.rules'), 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, record), sealed);
    const member = (role: string, accepted: boolean) => ({ householdId: 'owner', role, accepted });
    await setDoc(doc(db, 'memberships/editor@example.com'), member('editor', true));
    await setDoc(doc(db, 'memberships/viewer@example.com'), member('viewer', true));
    await setDoc(doc(db, 'memberships/pending@example.com'), member('editor', false));
  });
});

describe('household records', () => {
  test('owners and editors can read and write', async () => {
    for (const db of [owner(), editor()]) {
      await assertSucceeds(getDoc(doc(db, record)));
      await assertSucceeds(setDoc(doc(db, record), sealed));
    }
  });

  test('viewers can read but not write', async () => {
    await assertSucceeds(getDoc(doc(viewer(), record)));
    await assertFails(setDoc(doc(viewer(), record), sealed));
    await assertFails(deleteDoc(doc(viewer(), record)));
  });

  test('strangers, unverified and signed-out users have no access', async () => {
    const unverified = person('owner', 'owner@example.com', false);
    for (const db of [stranger(), unverified, env.unauthenticatedContext().firestore()]) {
      await assertFails(getDoc(doc(db, record)));
      await assertFails(setDoc(doc(db, record), sealed));
    }
  });

  test('an unaccepted invite grants nothing', async () => {
    await assertFails(getDoc(doc(person('pe', 'pending@example.com'), record)));
  });

  test('membership of one household does not reach another', async () => {
    await assertFails(getDoc(doc(editor(), 'households/other/income/a')));
  });

  test('every tracker collection can be written by an editor', async () => {
    const db = editor();
    for (const name of [
      'holdings',
      'contributions',
      'valuations',
      'gratuityAccounts',
      'projectionAdjustments',
      'settings',
      'monthReviews',
      'changes',
      'interestCredits',
      'epsUpdates',
    ]) {
      await assertSucceeds(setDoc(doc(db, `households/owner/${name}/a`), sealed));
    }
    await assertFails(setDoc(doc(viewer(), 'households/owner/holdings/a'), sealed));
  });

  test('only known collections can be written', async () => {
    await assertFails(setDoc(doc(owner(), 'households/owner/unknown/a'), {}));
  });
});

describe('memberships', () => {
  test('owners can list and manage their members, and others cannot', async () => {
    const list = (db: ReturnType<typeof owner>, household: string) =>
      getDocs(query(collection(db, 'memberships'), where('householdId', '==', household)));
    const found = await assertSucceeds(list(owner(), 'owner'));
    expect(found.size).toBe(3);
    await assertFails(list(stranger(), 'owner'));
    await assertFails(list(editor(), 'owner'));
    await assertSucceeds(
      updateDoc(doc(owner(), 'memberships/viewer@example.com'), { role: 'editor' }),
    );
    await assertFails(updateDoc(doc(owner(), 'memberships/viewer@example.com'), { role: 'owner' }));
  });

  const invite = { householdId: 'owner', role: 'viewer', accepted: false };

  test('owners can invite someone else to their own household', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'memberships/new@example.com'), invite));
  });

  test('an invite cannot arrive already accepted, or as owner', async () => {
    const db = owner();
    await assertFails(
      setDoc(doc(db, 'memberships/new@example.com'), { ...invite, accepted: true }),
    );
    await assertFails(setDoc(doc(db, 'memberships/new@example.com'), { ...invite, role: 'owner' }));
  });

  test('nobody can invite people into a household they do not own', async () => {
    await assertFails(setDoc(doc(stranger(), 'memberships/new@example.com'), invite));
    await assertFails(setDoc(doc(editor(), 'memberships/new@example.com'), invite));
  });

  test('another owner cannot take over an existing invite', async () => {
    const takeover = { householdId: 'st', role: 'viewer', accepted: false };
    await assertFails(setDoc(doc(stranger(), 'memberships/editor@example.com'), takeover));
  });

  test('invitees can accept, but cannot raise their own role', async () => {
    const db = person('pe', 'pending@example.com');
    const own = doc(db, 'memberships/pending@example.com');
    await assertFails(updateDoc(own, { role: 'owner' }));
    await assertSucceeds(updateDoc(own, { accepted: true }));
    await assertSucceeds(getDoc(doc(db, record)));
  });

  test('viewers cannot promote themselves', async () => {
    await assertFails(
      updateDoc(doc(viewer(), 'memberships/viewer@example.com'), { role: 'editor' }),
    );
  });

  test('owners can remove members, ending their access', async () => {
    await assertSucceeds(deleteDoc(doc(owner(), 'memberships/editor@example.com')));
    await assertFails(getDoc(doc(editor(), record)));
  });
});

describe('encryption', () => {
  const memberKey = { email: 'editor@example.com', publicKey: { x: 'x' }, locked: { c: 'c' } };

  test('readable records are refused, whoever writes them', async () => {
    await assertFails(setDoc(doc(owner(), record), { amount: 2 }));
    await assertFails(setDoc(doc(owner(), record), { ...sealed, amount: 2 }));
    await assertFails(setDoc(doc(owner(), record), { k: 1, iv: 'aXY=' }));
    await assertFails(setDoc(doc(editor(), record), { amount: 2 }));
    await assertSucceeds(setDoc(doc(owner(), record), sealed));
  });

  test('a keyring belongs to its person', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'keyrings/owner'), { publicKey: {} }));
    await assertFails(getDoc(doc(editor(), 'keyrings/owner')));
    await assertFails(setDoc(doc(editor(), 'keyrings/owner'), { publicKey: {} }));
  });

  test('only the owner shares keys, and members see only their own', async () => {
    await assertSucceeds(setDoc(doc(owner(), 'households/owner/keys/ed'), memberKey));
    await assertFails(setDoc(doc(editor(), 'households/owner/keys/ed'), memberKey));
    await assertFails(setDoc(doc(editor(), 'households/owner/keys/vi'), memberKey));
    await assertSucceeds(getDoc(doc(editor(), 'households/owner/keys/ed')));
    await assertFails(getDoc(doc(viewer(), 'households/owner/keys/ed')));
    await assertFails(getDoc(doc(stranger(), 'households/owner/keys/ed')));
  });

  test('a member can only ask for themselves, and outsiders cannot ask', async () => {
    const ask = { email: 'editor@example.com', publicKey: { x: 'x' } };
    await assertSucceeds(setDoc(doc(editor(), 'households/owner/requests/ed'), ask));
    await assertFails(setDoc(doc(viewer(), 'households/owner/requests/ed'), ask));
    await assertFails(
      setDoc(doc(editor(), 'households/owner/requests/ed'), { ...ask, email: 'x@example.com' }),
    );
    await assertFails(setDoc(doc(stranger(), 'households/owner/requests/st'), ask));
    await assertSucceeds(getDoc(doc(owner(), 'households/owner/requests/ed')));
  });
});
