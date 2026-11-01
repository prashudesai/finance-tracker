import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  initializeAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  writeBatch,
} from 'firebase/firestore';
import { parseRows, type CollectionName, type TrackerRepository } from './repository';

// Firebase web configuration identifies the project; it is not a secret.
const app = initializeApp({
  apiKey: 'AIzaSyBYhF_dyyOSyHyGletR58W7bYlL0xw8dQk',
  authDomain: 'finance-tracker-bc7c9.firebaseapp.com',
  projectId: 'finance-tracker-bc7c9',
});

const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

// The local cache gives offline reads, queued writes and multi-tab sync.
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const watchUser = (onChange: (user: User | null) => void) =>
  onAuthStateChanged(auth, onChange);

export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider());

export const signOutUser = () => signOut(auth);

export interface Membership {
  householdId: string;
  role: 'owner' | 'editor' | 'viewer';
}

/** An accepted invite joins that household. Otherwise each user owns their own. */
export async function resolveMembership(user: User): Promise<Membership> {
  const email = user.email?.toLowerCase();
  if (email) {
    const invite = doc(db, 'memberships', email);
    const data = (await getDoc(invite)).data();
    if (data?.accepted === true) return { householdId: data.householdId, role: data.role };
    if (data && window.confirm(`Join a shared family tracker as ${data.role}?`)) {
      await updateDoc(invite, { accepted: true });
      return { householdId: data.householdId, role: data.role };
    }
  }
  return { householdId: user.uid, role: 'owner' };
}

export const inviteMember = (ownerUid: string, email: string, role: 'editor' | 'viewer') =>
  setDoc(doc(db, 'memberships', email.trim().toLowerCase()), {
    householdId: ownerUid,
    role,
    accepted: false,
  });

export function createFirestoreRepository(householdId: string): TrackerRepository {
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
    async commit(writes) {
      const batch = writeBatch(db);
      for (const write of writes) {
        const target = doc(db, path(write.collection), write.id);
        if (write.type === 'set') batch.set(target, stripUndefined(write.value));
        else batch.delete(target);
      }
      await batch.commit();
    },
  };
}

/** Firestore rejects `undefined`, which optional form fields produce. */
function stripUndefined(value: object) {
  return JSON.parse(JSON.stringify(value)) as object;
}
