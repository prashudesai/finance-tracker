/**
 * End-to-end encryption, using only the browser's own Web Crypto.
 *
 * A household has data keys that lock its records. Each person has a key pair, and the
 * household's keys are locked to each member's public key. A private key is locked by that
 * person's passphrase, and again by their recovery code. Firebase only ever stores the locked
 * forms, so nobody can read records without a member's passphrase or recovery code.
 */

/** OWASP's minimum for PBKDF2-SHA256. */
const KDF_ITERATIONS = 600_000;
const RECOVERY_BYTES = 20;
const BASE64_CHUNK = 0x8000;
const BASE32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export const MIN_PASSPHRASE_LENGTH = 12;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBytes = (text: string) => encoder.encode(text);
const buffer = (bytes: Uint8Array) => bytes.slice().buffer;

/** Converted in pieces, because too many arguments at once overflow the call stack. */
export function toBase64(bytes: Uint8Array) {
  let text = '';
  for (let start = 0; start < bytes.length; start += BASE64_CHUNK) {
    text += String.fromCharCode(...bytes.subarray(start, start + BASE64_CHUNK));
  }
  return btoa(text);
}

export function fromBase64(text: string) {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

export interface Sealed {
  iv: string;
  c: string;
}

async function seal(key: CryptoKey, plain: Uint8Array, context: string): Promise<Sealed> {
  const iv = randomBytes(12);
  const c = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: buffer(iv), additionalData: buffer(toBytes(context)) },
    key,
    buffer(plain),
  );
  return { iv: toBase64(iv), c: toBase64(new Uint8Array(c)) };
}

async function unseal(key: CryptoKey, { iv, c }: Sealed, context: string) {
  const plain = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: buffer(fromBase64(iv)),
      additionalData: buffer(toBytes(context)),
    },
    key,
    buffer(fromBase64(c)),
  );
  return new Uint8Array(plain);
}

const importAesKey = (raw: Uint8Array) =>
  crypto.subtle.importKey('raw', buffer(raw), 'AES-GCM', false, ['encrypt', 'decrypt']);

interface LockedSecret extends Sealed {
  salt: string;
  iterations: number;
}

async function keyFromSecret(secret: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey('raw', buffer(toBytes(secret)), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: buffer(salt), iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function lockWithSecret(plain: Uint8Array, secret: string, context: string) {
  const salt = randomBytes(16);
  const key = await keyFromSecret(secret, salt, KDF_ITERATIONS);
  const sealed = await seal(key, plain, context);
  return { ...sealed, salt: toBase64(salt), iterations: KDF_ITERATIONS } as LockedSecret;
}

async function unlockWithSecret(locked: LockedSecret, secret: string, context: string) {
  const key = await keyFromSecret(secret, fromBase64(locked.salt), locked.iterations);
  return unseal(key, locked, context);
}

/** Groups of four, without characters that are easily misread. */
export function createRecoveryCode() {
  const chars = [...randomBytes(RECOVERY_BYTES)].map(
    (byte) => BASE32[byte % BASE32.length] as string,
  );
  return chars.join('').replace(/(.{4})(?=.)/g, '$1-');
}

const normalizeRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** A person's key pair. The private key is only stored locked. */
export interface Keyring {
  publicKey: JsonWebKey;
  passphrase: LockedSecret;
  recovery: LockedSecret;
  passkeys?: LockedWithPasskey[];
}

/** The private key, locked by a secret only a device's passkey can produce. */
export interface LockedWithPasskey extends Sealed {
  id: string;
  salt: string;
}

const PRIVATE_KEY = 'private-key';
const RECOVERY_KEY = 'recovery';

async function exportPrivateKey(key: CryptoKey) {
  return new Uint8Array(await crypto.subtle.exportKey('pkcs8', key));
}

/** Not extractable, so a key kept on a device can be used but never read back out. */
export const importPrivateKey = (pkcs8: Uint8Array) =>
  crypto.subtle.importKey('pkcs8', buffer(pkcs8), { name: 'ECDH', namedCurve: 'P-256' }, false, [
    'deriveBits',
  ]);

export async function createKeyring(passphrase: string) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const pkcs8 = await exportPrivateKey(pair.privateKey);
  const recoveryCode = createRecoveryCode();
  const keyring: Keyring = {
    publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
    passphrase: await lockWithSecret(pkcs8, passphrase, PRIVATE_KEY),
    recovery: await lockWithSecret(pkcs8, normalizeRecoveryCode(recoveryCode), RECOVERY_KEY),
  };
  return { keyring, recoveryCode, pkcs8 };
}

export const unlockWithPassphrase = (keyring: Keyring, passphrase: string) =>
  unlockWithSecret(keyring.passphrase, passphrase, PRIVATE_KEY);

export const unlockWithRecoveryCode = (keyring: Keyring, code: string) =>
  unlockWithSecret(keyring.recovery, normalizeRecoveryCode(code), RECOVERY_KEY);

export async function withNewPassphrase(keyring: Keyring, pkcs8: Uint8Array, passphrase: string) {
  return { ...keyring, passphrase: await lockWithSecret(pkcs8, passphrase, PRIVATE_KEY) };
}

export async function withNewRecoveryCode(keyring: Keyring, pkcs8: Uint8Array) {
  const recoveryCode = createRecoveryCode();
  const recovery = await lockWithSecret(pkcs8, normalizeRecoveryCode(recoveryCode), RECOVERY_KEY);
  return { keyring: { ...keyring, recovery }, recoveryCode };
}

const PASSKEY_CONTEXT = 'passkey';

async function keyFromPasskey(secret: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', buffer(secret), 'HKDF', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new ArrayBuffer(32),
      info: buffer(toBytes(PASSKEY_CONTEXT)),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function lockWithPasskey(
  pkcs8: Uint8Array,
  { id, salt, secret }: { id: string; salt: string; secret: Uint8Array },
): Promise<LockedWithPasskey> {
  const sealed = await seal(await keyFromPasskey(secret), pkcs8, PASSKEY_CONTEXT);
  return { id, salt, ...sealed };
}

export async function unlockWithPasskey(locked: LockedWithPasskey, secret: Uint8Array) {
  return unseal(await keyFromPasskey(secret), locked, PASSKEY_CONTEXT);
}

/** Every data key a household has used, so records written before a change stay readable. */
export interface HouseholdSecret {
  current: number;
  dataKeys: Record<string, string>;
  idKey: string;
}

export const createHouseholdSecret = (): HouseholdSecret => ({
  current: 1,
  dataKeys: { 1: toBase64(randomBytes(32)) },
  idKey: toBase64(randomBytes(32)),
});

export function withNewDataKey(secret: HouseholdSecret): HouseholdSecret {
  const current = secret.current + 1;
  return {
    ...secret,
    current,
    dataKeys: { ...secret.dataKeys, [current]: toBase64(randomBytes(32)) },
  };
}

export interface LockedHouseholdSecret extends Sealed {
  ephemeralKey: JsonWebKey;
}

async function sharedKey(privateKey: CryptoKey, publicKey: JsonWebKey, context: string) {
  const peer = await crypto.subtle.importKey(
    'jwk',
    publicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peer }, privateKey, 256);
  const material = await crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new ArrayBuffer(32),
      info: buffer(toBytes(context)),
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

const memberContext = (householdId: string, uid: string) => `household/${householdId}/${uid}`;
const deviceContext = (uid: string) => `device/${uid}`;

async function lockTo(bytes: Uint8Array, publicKey: JsonWebKey, context: string) {
  const ephemeral = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ]);
  const key = await sharedKey(ephemeral.privateKey, publicKey, context);
  return {
    ...(await seal(key, bytes, context)),
    ephemeralKey: await crypto.subtle.exportKey('jwk', ephemeral.publicKey),
  };
}

/** Locks a household's keys so only the holder of `publicKey` can open them. */
export function lockForMember(
  secret: HouseholdSecret,
  publicKey: JsonWebKey,
  householdId: string,
  uid: string,
): Promise<LockedHouseholdSecret> {
  return lockTo(toBytes(JSON.stringify(secret)), publicKey, memberContext(householdId, uid));
}

export async function openForMember(
  locked: LockedHouseholdSecret,
  privateKey: CryptoKey,
  householdId: string,
  uid: string,
) {
  const context = memberContext(householdId, uid);
  const key = await sharedKey(privateKey, locked.ephemeralKey, context);
  return JSON.parse(decoder.decode(await unseal(key, locked, context))) as HouseholdSecret;
}

/** A throwaway key pair, so a new device can be sent a personal key. Lost with the page. */
export async function createDevicePair() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
    'deriveBits',
  ]);
  return {
    privateKey: pair.privateKey,
    publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
  };
}

/** Locks a personal key so only the new device holding `publicKey` can open it. */
export const lockForDevice = (pkcs8: Uint8Array, publicKey: JsonWebKey, uid: string) =>
  lockTo(pkcs8, publicKey, deviceContext(uid));

export async function openForDevice(
  locked: LockedHouseholdSecret,
  privateKey: CryptoKey,
  uid: string,
) {
  const context = deviceContext(uid);
  const key = await sharedKey(privateKey, locked.ephemeralKey, context);
  return new Uint8Array(await unseal(key, locked, context));
}

/**
 * Both people compare this outside the app before access is approved. It proves the key being
 * approved really is theirs, even if someone with database access tried to swap it.
 */
export async function safetyCode(householdId: string, publicKey: JsonWebKey) {
  const text = `${householdId}|${publicKey.x ?? ''}|${publicKey.y ?? ''}`;
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer(toBytes(text))));
  return [0, 2, 4]
    .map((start) => {
      const value = ((hash[start] ?? 0) << 8) | (hash[start + 1] ?? 0);
      return String(value % 10_000).padStart(4, '0');
    })
    .join(' ');
}

/** How a record sits in the database. Nothing but this may be stored. */
export interface SealedRecord extends Sealed {
  k: number;
}

export interface RecordCodec {
  /** Hides natural keys such as a record's month. */
  documentId(collection: string, id: string): Promise<string>;
  seal(collection: string, documentId: string, value: object): Promise<SealedRecord>;
  open(collection: string, documentId: string, stored: SealedRecord): Promise<unknown>;
}

const BASE64_URL: Record<string, string> = { '+': '-', '/': '_', '=': '' };

/**
 * `refresh` fetches the household's keys again, for a record locked with a newer one.
 * Each record is tied to its own place, so stored records can't be swapped around unnoticed.
 */
export function createCodec(
  householdId: string,
  initial: HouseholdSecret,
  refresh: () => Promise<HouseholdSecret>,
): RecordCodec {
  let secret = initial;
  let refreshing: Promise<void> | null = null;
  const dataKeys = new Map<number, Promise<CryptoKey>>();
  const idKey = crypto.subtle.importKey(
    'raw',
    buffer(fromBase64(initial.idKey)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const dataKey = (version: number) => {
    const raw = secret.dataKeys[version];
    if (!raw) return null;
    const known = dataKeys.get(version);
    if (known) return known;
    const key = importAesKey(fromBase64(raw));
    dataKeys.set(version, key);
    return key;
  };
  const place = (collection: string, documentId: string) =>
    `${householdId}/${collection}/${documentId}`;

  return {
    async documentId(collection, id) {
      const mac = await crypto.subtle.sign('HMAC', await idKey, toBytes(`${collection}/${id}`));
      return toBase64(new Uint8Array(mac).slice(0, 18)).replace(
        /[+/=]/g,
        (char) => BASE64_URL[char] ?? '',
      );
    },
    async seal(collection, documentId, value) {
      const key = await dataKey(secret.current);
      if (!key) throw new Error('This tracker is locked.');
      const plain = toBytes(JSON.stringify(value));
      return { k: secret.current, ...(await seal(key, plain, place(collection, documentId))) };
    },
    async open(collection, documentId, stored) {
      if (!secret.dataKeys[stored.k]) {
        refreshing ??= refresh()
          .then((next) => {
            secret = next;
          })
          .finally(() => {
            refreshing = null;
          });
        await refreshing;
      }
      const key = await dataKey(stored.k);
      if (!key) throw new Error('This record uses a key you do not have.');
      const plain = await unseal(key, stored, place(collection, documentId));
      return JSON.parse(decoder.decode(plain)) as unknown;
    },
  };
}

const BACKUP_FORMAT = 'finance-tracker-encrypted';
const BACKUP_CONTEXT = 'backup';

export async function encryptBackup(text: string, passphrase: string) {
  const locked = await lockWithSecret(toBytes(text), passphrase, BACKUP_CONTEXT);
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1, ...locked }, null, 2);
}

export function isEncryptedBackup(text: string) {
  try {
    return (JSON.parse(text) as { format?: unknown }).format === BACKUP_FORMAT;
  } catch {
    return false;
  }
}

export async function decryptBackup(text: string, passphrase: string) {
  const locked = JSON.parse(text) as LockedSecret;
  try {
    return decoder.decode(await unlockWithSecret(locked, passphrase, BACKUP_CONTEXT));
  } catch {
    throw new Error('That passphrase does not open this backup.');
  }
}
