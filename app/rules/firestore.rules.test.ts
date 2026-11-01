import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

let env: RulesTestEnvironment;

const person = (uid: string, email: string, verified = true) =>
  env.authenticatedContext(uid, { email, email_verified: verified }).firestore();

const owner = () => person('owner', 'owner@example.com');
const editor = () => person('ed', 'editor@example.com');
const viewer = () => person('vi', 'viewer@example.com');
const stranger = () => person('st', 'stranger@example.com');
const record = 'households/owner/income/a';

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
    await setDoc(doc(db, record), { amount: 1 });
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
      await assertSucceeds(setDoc(doc(db, record), { amount: 2 }));
    }
  });

  test('viewers can read but not write', async () => {
    await assertSucceeds(getDoc(doc(viewer(), record)));
    await assertFails(setDoc(doc(viewer(), record), { amount: 2 }));
    await assertFails(deleteDoc(doc(viewer(), record)));
  });

  test('strangers, unverified and signed-out users have no access', async () => {
    const unverified = person('owner', 'owner@example.com', false);
    for (const db of [stranger(), unverified, env.unauthenticatedContext().firestore()]) {
      await assertFails(getDoc(doc(db, record)));
      await assertFails(setDoc(doc(db, record), { amount: 2 }));
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
    ]) {
      await assertSucceeds(setDoc(doc(db, `households/owner/${name}/a`), { value: 1 }));
    }
    await assertFails(setDoc(doc(viewer(), 'households/owner/holdings/a'), { value: 1 }));
  });

  test('only known collections can be written', async () => {
    await assertFails(setDoc(doc(owner(), 'households/owner/unknown/a'), {}));
  });
});

describe('memberships', () => {
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
