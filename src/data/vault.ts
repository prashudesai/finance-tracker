import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import {
  createCodec,
  createHouseholdSecret,
  createKeyring,
  importPrivateKey,
  lockForMember,
  openForMember,
  safetyCode,
  unlockWithPassphrase,
  unlockWithRecoveryCode,
  withNewDataKey,
  withNewPassphrase,
  withNewRecoveryCode,
  type HouseholdSecret,
  type Keyring,
  type LockedHouseholdSecret,
  type RecordCodec,
  type SealedRecord,
  lockWithPasskey,
  unlockWithPasskey,
} from './crypto';
import { createPasskey, passkeysAvailable, usePasskey } from './passkey';
import { COLLECTION_NAMES } from './repository';

const BATCH_SIZE = 400;
const DEVICE_DATABASE = 'finance-vault';
const DEVICE_STORE = 'keys';

export interface VaultUser {
  uid: string;
  email: string;
}

export interface VaultMembership {
  householdId: string;
  role: 'owner' | 'editor' | 'viewer';
}

/** Someone waiting for the owner to share the household's keys. */
export interface AccessRequest {
  uid: string;
  email: string;
  code: string;
}

interface MemberKey {
  email: string;
  publicKey: JsonWebKey;
  locked: LockedHouseholdSecret;
}

export interface VaultTools {
  changePassphrase(current: string, next: string): Promise<void>;
  newRecoveryCode(passphrase: string): Promise<string>;
  /** Forgets this device's key, so the next visit asks for the passphrase. */
  forgetDevice(): Promise<void>;
  passkey: {
    available(): Promise<boolean>;
    /** True when opening the app on this device needs Face ID or a fingerprint. */
    enabled(): boolean;
    enable(passphrase: string): Promise<void>;
    disable(): Promise<void>;
  };
}

export interface OwnerTools {
  requests(): Promise<AccessRequest[]>;
  /** Calls `onChange` now and whenever someone asks for access. Returns how to stop. */
  watchRequests(onChange: (requests: AccessRequest[]) => void): () => void;
  approve(request: AccessRequest): Promise<void>;
  deny(request: AccessRequest): Promise<void>;
  /** Drops a member from the keys, then locks every record with a new key. */
  removeMember(email: string): Promise<void>;
}

export type VaultAccess =
  | { status: 'open'; codec: RecordCodec; tools: VaultTools; owner?: OwnerTools }
  | { status: 'waiting'; code: string; retry(): Promise<VaultAccess> };

/** What the unlock screen can do. */
export interface VaultGate {
  hasKeyring: boolean;
  canUsePasskey: boolean;
  /** This device has Face ID on, so the check starts without a tap where browsers allow it. */
  autoPasskey: boolean;
  unlockWithPasskey(): Promise<VaultAccess>;
  create(passphrase: string): Promise<{
    recoveryCode: string;
    /** Whether setup can offer Face ID or a fingerprint on this device. */
    passkeyAvailable: boolean;
    enablePasskey(): Promise<void>;
    enter(): Promise<VaultAccess>;
  }>;
  unlock(passphrase: string): Promise<VaultAccess>;
  recover(code: string, passphrase: string): Promise<VaultAccess>;
  /** For someone who lost both. Deletes what can no longer be read. */
  startOver(): Promise<void>;
}

const passkeyFlag = (uid: string) => `finance-vault-passkey:${uid}`;

/** A device with this set keeps no key, so each visit needs Face ID or a fingerprint. */
function devicePasskey(uid: string, value?: boolean) {
  try {
    if (value === true) localStorage.setItem(passkeyFlag(uid), '1');
    if (value === false) localStorage.removeItem(passkeyFlag(uid));
    return localStorage.getItem(passkeyFlag(uid)) === '1';
  } catch {
    return false;
  }
}

function openDeviceStore() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DEVICE_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DEVICE_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Device storage failed.'));
  });
}

async function deviceStore<Value>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<Value>,
) {
  const database = await openDeviceStore();
  try {
    return await new Promise<Value>((resolve, reject) => {
      const request = run(database.transaction(DEVICE_STORE, mode).objectStore(DEVICE_STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Device storage failed.'));
    });
  } finally {
    database.close();
  }
}

/** Device memory is a convenience. Without it, the passphrase is asked for each visit. */
async function rememberOnDevice(uid: string, key: CryptoKey) {
  try {
    await deviceStore<IDBValidKey>('readwrite', (store) => store.put(key, uid));
  } catch {
    // The passphrase still works next time.
  }
}

async function recallFromDevice(uid: string) {
  try {
    return (
      (await deviceStore<CryptoKey | undefined>('readonly', (store) => store.get(uid))) ?? null
    );
  } catch {
    return null;
  }
}

export async function forgetOnDevice(uid: string) {
  devicePasskey(uid, false);
  try {
    await deviceStore<undefined>('readwrite', (store) => store.delete(uid));
  } catch {
    // Nothing was kept here.
  }
}

/** Sets up one person's encrypted access to one household. */
export async function startVault(
  db: Firestore,
  user: VaultUser,
  { householdId, role }: VaultMembership,
): Promise<{ access: VaultAccess } | { gate: VaultGate }> {
  const owner = role === 'owner';
  const keyringDoc = doc(db, 'keyrings', user.uid);
  const memberDoc = (uid: string) => doc(db, 'households', householdId, 'keys', uid);
  const requestDoc = (uid: string) => doc(db, 'households', householdId, 'requests', uid);

  const readKeyring = async () => (await getDoc(keyringDoc)).data() as Keyring | undefined;

  const shareWith = async (
    uid: string,
    email: string,
    publicKey: JsonWebKey,
    s: HouseholdSecret,
  ) => {
    const value: MemberKey = {
      email,
      publicKey,
      locked: await lockForMember(s, publicKey, householdId, uid),
    };
    await setDoc(memberDoc(uid), value);
  };

  const openOwnKeys = async (privateKey: CryptoKey, fromServer: boolean) => {
    const snapshot = await (fromServer ? getDocFromServer : getDoc)(memberDoc(user.uid));
    const stored = snapshot.data() as MemberKey | undefined;
    if (!stored) return null;
    return openForMember(stored.locked, privateKey, householdId, user.uid);
  };

  /** A lost keys document must not lead to new keys that orphan existing records. */
  const hasEncryptedRecords = async () => {
    for (const name of COLLECTION_NAMES) {
      const found = await getDocsFromServer(
        query(collection(db, 'households', householdId, name), where('k', '>=', 1), limit(1)),
      );
      if (!found.empty) return true;
    }
    return false;
  };

  const rotate = async (secret: HouseholdSecret, codec: RecordCodec, leaving: string) => {
    const next = withNewDataKey(secret);
    const members = await getDocsFromServer(collection(db, 'households', householdId, 'keys'));
    for (const member of members.docs) {
      const { email, publicKey } = member.data() as MemberKey;
      if (email === leaving) await deleteDoc(member.ref);
      else await shareWith(member.id, email, publicKey, next);
    }
    const rewriter = createCodec(householdId, next, () => Promise.resolve(next));
    for (const name of COLLECTION_NAMES) {
      const rows = await getDocsFromServer(collection(db, 'households', householdId, name));
      const stale = rows.docs.filter((row) => {
        const stored = row.data() as Partial<SealedRecord>;
        return stored.c !== undefined && stored.k !== next.current;
      });
      for (let start = 0; start < stale.length; start += BATCH_SIZE) {
        const batch = writeBatch(db);
        for (const row of stale.slice(start, start + BATCH_SIZE)) {
          const value = await codec.open(name, row.id, row.data() as SealedRecord);
          batch.set(row.ref, await rewriter.seal(name, row.id, value as object));
        }
        await batch.commit();
      }
    }
    return next;
  };

  const ownerTools = (start: HouseholdSecret, codec: RecordCodec): OwnerTools => {
    let secret = start;
    const requestArea = collection(db, 'households', householdId, 'requests');
    const toRequests = (rows: QueryDocumentSnapshot[]) =>
      Promise.all(
        rows.map(async (row) => {
          const { email, publicKey } = row.data() as { email: string; publicKey: JsonWebKey };
          return { uid: row.id, email, code: await safetyCode(householdId, publicKey) };
        }),
      );
    return {
      requests: async () => toRequests((await getDocs(requestArea)).docs),
      watchRequests(onChange) {
        let latest = 0;
        return onSnapshot(requestArea, (snapshot) => {
          latest += 1;
          const version = latest;
          void toRequests(snapshot.docs).then((requests) => {
            if (version === latest) onChange(requests);
          });
        });
      },
      deny: ({ uid }) => deleteDoc(requestDoc(uid)),
      async approve({ uid, email, code }) {
        const stored = (await getDocFromServer(requestDoc(uid))).data() as
          { publicKey: JsonWebKey } | undefined;
        if (!stored || (await safetyCode(householdId, stored.publicKey)) !== code) {
          throw new Error('This request changed. Check the code with them again.');
        }
        await shareWith(uid, email, stored.publicKey, secret);
        await deleteDoc(requestDoc(uid));
      },
      async removeMember(email) {
        secret = await rotate(secret, codec, email);
        const waiting = await getDocs(
          query(collection(db, 'households', householdId, 'requests'), where('email', '==', email)),
        );
        await Promise.all(waiting.docs.map((row) => deleteDoc(row.ref)));
      },
    };
  };

  const addPasskey = async (keyring: Keyring, pkcs8: Uint8Array) => {
    const locked = await lockWithPasskey(pkcs8, await createPasskey(user));
    await setDoc(keyringDoc, { ...keyring, passkeys: [...(keyring.passkeys ?? []), locked] });
    await forgetOnDevice(user.uid);
    devicePasskey(user.uid, true);
  };

  const tools = (): VaultTools => {
    const currentKeyring = async () => {
      const keyring = await readKeyring();
      if (!keyring) throw new Error('Your key could not be found.');
      return keyring;
    };
    const unlockCurrent = async (keyring: Keyring, passphrase: string) => {
      try {
        return await unlockWithPassphrase(keyring, passphrase);
      } catch {
        throw new Error('That passphrase is not correct.');
      }
    };
    return {
      async changePassphrase(current, next) {
        const keyring = await currentKeyring();
        const pkcs8 = await unlockCurrent(keyring, current);
        await setDoc(keyringDoc, await withNewPassphrase(keyring, pkcs8, next));
      },
      async newRecoveryCode(passphrase) {
        const keyring = await currentKeyring();
        const pkcs8 = await unlockCurrent(keyring, passphrase);
        const renewed = await withNewRecoveryCode(keyring, pkcs8);
        await setDoc(keyringDoc, renewed.keyring);
        return renewed.recoveryCode;
      },
      forgetDevice: () => forgetOnDevice(user.uid),
      passkey: {
        available: passkeysAvailable,
        enabled: () => devicePasskey(user.uid),
        async enable(passphrase) {
          const keyring = await currentKeyring();
          await addPasskey(keyring, await unlockCurrent(keyring, passphrase));
        },
        async disable() {
          const keyring = await currentKeyring();
          const updated = { ...keyring };
          delete updated.passkeys;
          await setDoc(keyringDoc, updated);
          await forgetOnDevice(user.uid);
        },
      },
    };
  };

  const enter = async (privateKey: CryptoKey, publicKey: JsonWebKey): Promise<VaultAccess> => {
    let secret = await openOwnKeys(privateKey, false).catch(() => {
      throw new Error('You no longer have access. Ask the owner for a new invite.');
    });
    if (!secret) {
      if (owner) {
        const encrypted = await hasEncryptedRecords().catch(() => {
          throw new Error('Connect to the internet to finish setting up.');
        });
        if (encrypted) {
          throw new Error('The keys for this tracker are missing, so it cannot be opened.');
        }
        secret = createHouseholdSecret();
        await shareWith(user.uid, user.email, publicKey, secret);
      } else {
        await setDoc(requestDoc(user.uid), { email: user.email, publicKey }).catch(() => {
          throw new Error('You no longer have access. Ask the owner for a new invite.');
        });
        return {
          status: 'waiting',
          code: await safetyCode(householdId, publicKey),
          retry: () => enter(privateKey, publicKey),
        };
      }
    }
    const codec = createCodec(householdId, secret, async () => {
      const next = await openOwnKeys(privateKey, true);
      if (!next) throw new Error('Your access to this tracker has ended.');
      return next;
    });
    return {
      status: 'open',
      codec,
      tools: tools(),
      ...(owner ? { owner: ownerTools(secret, codec) } : {}),
    };
  };

  const enterWith = async (pkcs8: Uint8Array, keyring: Keyring) => {
    const privateKey = await importPrivateKey(pkcs8);
    if (!devicePasskey(user.uid)) await rememberOnDevice(user.uid, privateKey);
    return enter(privateKey, keyring.publicKey);
  };

  const keyring = await readKeyring();
  if (keyring && !keyring.passkeys?.length) devicePasskey(user.uid, false);
  const remembered = keyring ? await recallFromDevice(user.uid) : null;
  if (keyring && remembered) return { access: await enter(remembered, keyring.publicKey) };

  const canUsePasskey = Boolean(keyring?.passkeys?.length) && (await passkeysAvailable());

  return {
    gate: {
      hasKeyring: keyring !== undefined,
      canUsePasskey,
      autoPasskey: canUsePasskey && devicePasskey(user.uid),
      async unlockWithPasskey() {
        const stored = await readKeyring();
        const entries = stored?.passkeys ?? [];
        if (!stored || entries.length === 0) throw new Error('Your key could not be found.');
        const { id, secret } = await usePasskey(entries);
        const entry = entries.find((row) => row.id === id);
        if (!entry) throw new Error('This device could not unlock the tracker.');
        const pkcs8 = await unlockWithPasskey(entry, secret);
        devicePasskey(user.uid, true);
        return enterWith(pkcs8, stored);
      },
      async create(passphrase) {
        const created = await createKeyring(passphrase);
        await setDoc(keyringDoc, created.keyring);
        return {
          recoveryCode: created.recoveryCode,
          passkeyAvailable: await passkeysAvailable(),
          enablePasskey: () => addPasskey(created.keyring, created.pkcs8),
          enter: async () => enterWith(created.pkcs8, (await readKeyring()) ?? created.keyring),
        };
      },
      async unlock(passphrase) {
        const stored = await readKeyring();
        if (!stored) throw new Error('Your key could not be found.');
        let pkcs8: Uint8Array;
        try {
          pkcs8 = await unlockWithPassphrase(stored, passphrase);
        } catch {
          throw new Error('That passphrase is not correct.');
        }
        return enterWith(pkcs8, stored);
      },
      async recover(code, passphrase) {
        const stored = await readKeyring();
        if (!stored) throw new Error('Your key could not be found.');
        let pkcs8: Uint8Array;
        try {
          pkcs8 = await unlockWithRecoveryCode(stored, code);
        } catch {
          throw new Error('That recovery code is not correct.');
        }
        const updated = await withNewPassphrase(stored, pkcs8, passphrase);
        await setDoc(keyringDoc, updated);
        return enterWith(pkcs8, updated);
      },
      async startOver() {
        if (owner) {
          await deleteHousehold(db, householdId);
        } else {
          await deleteDoc(memberDoc(user.uid));
          await deleteDoc(requestDoc(user.uid));
        }
        await deleteDoc(keyringDoc);
      },
    },
  };
}

/**
 * Removes every stored document, asked of the server so nothing is missed. That includes
 * records this device hasn't loaded and any saved before encryption.
 */
export async function deleteHousehold(db: Firestore, householdId: string) {
  for (const name of [...COLLECTION_NAMES, 'requests', 'keys']) {
    const rows = await getDocsFromServer(collection(db, 'households', householdId, name));
    for (let start = 0; start < rows.docs.length; start += BATCH_SIZE) {
      const batch = writeBatch(db);
      for (const row of rows.docs.slice(start, start + BATCH_SIZE)) batch.delete(row.ref);
      await batch.commit();
    }
  }
}

/** Removes a person's own keys from a household they belong to. */
export async function deleteMemberKeys(db: Firestore, uid: string, householdId: string) {
  await deleteDoc(doc(db, 'households', householdId, 'keys', uid));
  await deleteDoc(doc(db, 'households', householdId, 'requests', uid));
}

export async function deleteKeyring(db: Firestore, uid: string) {
  await deleteDoc(doc(db, 'keyrings', uid));
  await forgetOnDevice(uid);
}
