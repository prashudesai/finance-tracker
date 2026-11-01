import { initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  browserPopupRedirectResolver,
  deleteUser,
  GoogleAuthProvider,
  initializeAuth,
  onAuthStateChanged,
  reauthenticateWithPopup,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  collection,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import type { FamilyAccess } from '../Shell';
import { firestoreRepository } from './firestoreRepository';

// Firebase web configuration identifies the project; it is not a secret.
const app = initializeApp({
  apiKey: 'AIzaSyAecTwMoXpLt53cgbOQcdUA4-dtQiRF2iQ',
  authDomain: 'finance-trackerp.firebaseapp.com',
  projectId: 'finance-trackerp',
  appId: '1:223707453815:web:2d35079b430a7ee15ae972',
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

const memberDoc = (email: string) => doc(db, 'memberships', email.trim().toLowerCase());

/** Family management for a household's owner. Security rules enforce who may do this. */
export const familyAccess = (ownerUid: string): FamilyAccess => ({
  async list() {
    const members = await getDocs(
      query(collection(db, 'memberships'), where('householdId', '==', ownerUid)),
    );
    return members.docs.map((row) => ({
      email: row.id,
      role: row.data().role,
      accepted: row.data().accepted === true,
    }));
  },
  invite: (email, role) =>
    setDoc(memberDoc(email), { householdId: ownerUid, role, accepted: false }),
  setRole: (email, role) => updateDoc(memberDoc(email), { role }),
  remove: (email) => deleteDoc(memberDoc(email)),
});

/**
 * Confirms it's really them first, so a failed sign-in deletes nothing. An owner's records
 * and family access go too. A member loses only their own access. Then the sign-in goes.
 */
export async function deleteAccount(user: User, owner: boolean, clearOwnData: () => Promise<void>) {
  await reauthenticateWithPopup(user, new GoogleAuthProvider());
  if (owner) {
    const family = familyAccess(user.uid);
    await Promise.all((await family.list()).map((member) => family.remove(member.email)));
    await clearOwnData();
  } else if (user.email) {
    // A member's access ends with this document, so their data goes first.
    await clearOwnData();
    await deleteDoc(memberDoc(user.email));
  }
  await deleteUser(user);
}

export const createFirestoreRepository = (householdId: string) =>
  firestoreRepository(db, householdId);
