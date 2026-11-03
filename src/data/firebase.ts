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
  addDoc,
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
import type { ErrorReport } from '../domain/errorReport';
import type { FamilyAccess, FeedbackKind } from '../Shell';
import type { RecordCodec } from './crypto';
import { firestoreRepository } from './firestoreRepository';
import {
  deleteHousehold,
  deleteKeyring,
  deleteMemberKeys,
  forgetOnDevice,
  startVault,
  watchMembership,
  type OwnerTools,
  type VaultMembership,
} from './vault';

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

export const signOutUser = async () => {
  if (auth.currentUser) await forgetOnDevice(auth.currentUser.uid);
  await signOut(auth);
};

/** Errors only, sanitized on the device. Records and names never pass through here. */
export const sendErrorReport = (report: ErrorReport) =>
  addDoc(collection(db, 'errorReports'), report);

/** A feature suggestion or problem report, without the sender's name or email. */
export const sendFeedback = (message: {
  kind: FeedbackKind;
  text: string;
  version: string;
  day: string;
}) => addDoc(collection(db, 'feedback'), message).then(() => undefined);

export const onMembershipRemoved = (user: User, onRemoved: () => void) =>
  watchMembership(db, user.email?.toLowerCase() ?? '', onRemoved);

export const openVault = (user: User, membership: VaultMembership) =>
  startVault(db, { uid: user.uid, email: user.email?.toLowerCase() ?? '' }, membership);

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
export const familyAccess = (ownerUid: string, owner: OwnerTools): FamilyAccess => ({
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
  watchRequests: (onChange) => owner.watchRequests(onChange),
  approve: (request) => owner.approve(request),
  async deny(request) {
    await deleteDoc(memberDoc(request.email));
    await owner.deny(request);
  },
  async remove(email) {
    await owner.removeMember(email);
    await deleteDoc(memberDoc(email));
  },
});

/**
 * Confirms it's really them first, so a failed sign-in deletes nothing. An owner's whole tracker
 * and family access go. A member loses only their own access. Then the sign-in goes, which
 * signs them out.
 */
export async function deleteAccount(
  user: User,
  { householdId, role }: VaultMembership,
  clearMemberData: () => Promise<void>,
) {
  await reauthenticateWithPopup(user, new GoogleAuthProvider());
  if (role === 'owner') {
    const members = await getDocs(
      query(collection(db, 'memberships'), where('householdId', '==', user.uid)),
    );
    await Promise.all(members.docs.map((row) => deleteDoc(row.ref)));
    await deleteHousehold(db, householdId);
  } else {
    // A member's access ends with their membership, so their data goes first.
    await clearMemberData();
    await deleteMemberKeys(db, user.uid, householdId);
    if (user.email) await deleteDoc(memberDoc(user.email));
  }
  await deleteKeyring(db, user.uid);
  await deleteUser(user);
  await signOut(auth);
}

export const createFirestoreRepository = (householdId: string, codec: RecordCodec) =>
  firestoreRepository(db, householdId, codec);
