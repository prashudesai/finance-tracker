import {
  createCodec,
  createHouseholdSecret,
  createKeyring,
  decryptBackup,
  encryptBackup,
  importPrivateKey,
  isEncryptedBackup,
  lockWithPasskey,
  lockForMember,
  openForMember,
  safetyCode,
  unlockWithPasskey,
  unlockWithPassphrase,
  unlockWithRecoveryCode,
  withNewDataKey,
  withNewPassphrase,
  withNewRecoveryCode,
} from './crypto';

const PASS = 'correct horse battery';

test('a private key opens with the passphrase or recovery code, and nothing else', async () => {
  const { keyring, recoveryCode, pkcs8 } = await createKeyring(PASS);
  expect(await unlockWithPassphrase(keyring, PASS)).toEqual(pkcs8);
  expect(await unlockWithRecoveryCode(keyring, recoveryCode.toLowerCase())).toEqual(pkcs8);
  await expect(unlockWithPassphrase(keyring, 'wrong passphrase')).rejects.toThrow();
  await expect(unlockWithRecoveryCode(keyring, 'AAAA-BBBB')).rejects.toThrow();
  expect(JSON.stringify(keyring)).not.toContain(PASS);
});

test('changing the passphrase or recovery code retires the old one', async () => {
  const { keyring, recoveryCode, pkcs8 } = await createKeyring(PASS);
  const changed = await withNewPassphrase(keyring, pkcs8, 'a brand new passphrase');
  expect(await unlockWithPassphrase(changed, 'a brand new passphrase')).toEqual(pkcs8);
  await expect(unlockWithPassphrase(changed, PASS)).rejects.toThrow();
  const renewed = await withNewRecoveryCode(changed, pkcs8);
  expect(await unlockWithRecoveryCode(renewed.keyring, renewed.recoveryCode)).toEqual(pkcs8);
  await expect(unlockWithRecoveryCode(renewed.keyring, recoveryCode)).rejects.toThrow();
});

test('household keys open only for the member they were locked to', async () => {
  const secret = createHouseholdSecret();
  const member = await createKeyring(PASS);
  const stranger = await createKeyring(PASS);
  const locked = await lockForMember(secret, member.keyring.publicKey, 'home', 'm');
  const key = await importPrivateKey(member.pkcs8);
  expect(await openForMember(locked, key, 'home', 'm')).toEqual(secret);
  const other = await importPrivateKey(stranger.pkcs8);
  await expect(openForMember(locked, other, 'home', 'm')).rejects.toThrow();
  await expect(openForMember(locked, key, 'other', 'm')).rejects.toThrow();
});

test('both people see the same safety code, and a swapped key shows a different one', async () => {
  const a = await createKeyring(PASS);
  const b = await createKeyring(PASS);
  const code = await safetyCode('home', a.keyring.publicKey);
  expect(code).toMatch(/^\d{4} \d{4} \d{4}$/);
  expect(await safetyCode('home', a.keyring.publicKey)).toBe(code);
  expect(await safetyCode('home', b.keyring.publicKey)).not.toBe(code);
});

test('a passkey secret opens the private key, and another one does not', async () => {
  const { pkcs8 } = await createKeyring(PASS);
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const locked = await lockWithPasskey(pkcs8, { id: 'a', salt: 'b', secret });
  expect(await unlockWithPasskey(locked, secret)).toEqual(pkcs8);
  const other = crypto.getRandomValues(new Uint8Array(32));
  await expect(unlockWithPasskey(locked, other)).rejects.toThrow();
});

describe('records', () => {
  const secret = createHouseholdSecret();
  const refresh = () => Promise.resolve(secret);
  const codec = createCodec('home', secret, refresh);

  test('round-trip, without readable text or the natural key', async () => {
    const id = await codec.documentId('monthlyBalances', '2026-03');
    expect(id).not.toContain('2026');
    expect(id).toMatch(/^[\w-]+$/);
    expect(await codec.documentId('monthlyBalances', '2026-03')).toBe(id);
    const value = { month: '2026-03', startBalance: 123_456 };
    const stored = await codec.seal('monthlyBalances', id, value);
    expect(JSON.stringify(stored)).not.toContain('123456');
    expect(await codec.open('monthlyBalances', id, stored)).toEqual(value);
  });

  test('a record moved to another place will not open', async () => {
    const stored = await codec.seal('income', 'a', { amount: 1 });
    await expect(codec.open('income', 'b', stored)).rejects.toThrow();
    await expect(codec.open('expenses', 'a', stored)).rejects.toThrow();
  });

  test('a changed record will not open', async () => {
    const stored = await codec.seal('income', 'a', { amount: 1 });
    const tampered = { ...stored, c: `${stored.c.slice(0, -4)}AAA=` };
    await expect(codec.open('income', 'a', tampered)).rejects.toThrow();
  });

  test('a newer key is fetched when needed, and older records stay readable', async () => {
    const newer = withNewDataKey(secret);
    const old = await codec.seal('income', 'a', { amount: 1 });
    const writer = createCodec('home', newer, () => Promise.resolve(newer));
    const fresh = await writer.seal('income', 'b', { amount: 2 });
    expect(fresh.k).toBe(2);
    const reader = createCodec('home', secret, () => Promise.resolve(newer));
    expect(await reader.open('income', 'b', fresh)).toEqual({ amount: 2 });
    expect(await writer.open('income', 'a', old)).toEqual({ amount: 1 });
  });

  test('someone without the newer key cannot read it', async () => {
    const newer = withNewDataKey(secret);
    const writer = createCodec('home', newer, () => Promise.resolve(newer));
    const fresh = await writer.seal('income', 'b', { amount: 2 });
    const removed = createCodec('home', secret, () => Promise.resolve(secret));
    await expect(removed.open('income', 'b', fresh)).rejects.toThrow();
  });
});

test('encrypted backups hide their contents and need the passphrase', async () => {
  const text = JSON.stringify({ salary: 987_654 });
  const file = await encryptBackup(text, PASS);
  expect(file).not.toContain('987654');
  expect(isEncryptedBackup(file)).toBe(true);
  expect(isEncryptedBackup(text)).toBe(false);
  expect(await decryptBackup(file, PASS)).toBe(text);
  await expect(decryptBackup(file, 'wrong passphrase')).rejects.toThrow(/passphrase/);
});

test('a backup of any size opens again, and large records can be saved', async () => {
  const text = 'x'.repeat(2_000_000);
  expect(await decryptBackup(await encryptBackup(text, PASS), PASS)).toBe(text);

  const secret = createHouseholdSecret();
  const codec = createCodec('home', secret, () => Promise.resolve(secret));
  const record = { id: 'tracker', photos: { a: 'y'.repeat(300_000) } };
  const sealed = await codec.seal('settings', 'doc', record);
  expect(await codec.open('settings', 'doc', sealed)).toEqual(record);
});
