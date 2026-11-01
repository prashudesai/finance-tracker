# Encryption

Records are encrypted on the device, so Firebase stores only unreadable data. The aim is that nobody can read a family's records without a member's passphrase or recovery code, including anyone with admin access to this Firebase project.

The code is in `src/data/crypto.ts` (Web Crypto only) and `src/data/vault.ts` (keys in Firestore).

## Keys

- **Data keys:** AES-256-GCM keys that lock records. A household's newest key locks new writes, and older ones stay available to read older records.
- **ID key:** an HMAC-SHA-256 key that scrambles document IDs, so natural keys such as a month aren't visible.
- **Personal key pair:** ECDH P-256. Each person has one per sign-in.
- **Keyring:** the private key, locked twice with PBKDF2-SHA-256 at 600,000 iterations, once by the passphrase and once by the recovery code. The public key sits beside it.
- **Household secret:** the data keys and ID key, locked to each member's public key in `households/{id}/keys/{uid}`.

Each stored record is tied to its household, collection and document ID as authenticated data, so records can't be swapped or moved without failing to open.

## Flows

**First use.** A person creates a passphrase and saves a recovery code. An owner's first entry creates the household secret, unless encrypted records already exist. In that case it stops rather than orphan them.

**This device.** The private key is imported as non-extractable and kept in IndexedDB until sign-out, so the passphrase isn't needed each visit and offline use keeps working. Firestore's local cache holds only encrypted data.

**Face ID or fingerprint.** Someone can add a passkey with the WebAuthn PRF extension. The device turns a biometric check into a secret, which locks another copy of the private key in the keyring. A device with this on keeps no key, so each visit needs the check, and returning after 5 minutes away reloads the app. Devices without PRF support keep using the passphrase.

**Family.** An invited member accepts, creates a keyring and writes their public key to `requests`. Both people compare a safety code derived from that key, outside the app, and the owner approves. The comparison stops someone with database access swapping in their own key. Approval re-reads the key and refuses if the code no longer matches.

**Removal.** The owner's device adds a new data key, shares it with everyone else, re-encrypts every record and then removes the membership. If that fails partway, removing them again finishes the job. Other members pick up the new key the first time they meet a record that needs it.

**Lost secrets.** A passphrase can be replaced with the recovery code. Without either, the records can't be opened, and the only way forward is to delete them and start again.

## Roles

Encryption can't make a viewer read-only, because all members hold the same keys. The security rules still enforce roles. They also refuse any record that isn't in the sealed `{ k, iv, c }` form.

## What stays visible

Anyone with admin access can still see email addresses, who belongs to which household, the number of records in each collection, and when documents changed.

## The limit of this design

This protects stored data. Whoever controls the hosted code could ship a version that captures passphrases, so people still have to trust the app they load.

## Records from before encryption

There's no automatic move. Records saved in readable form are ignored by the app and stay in Firestore until they're deleted. Deleting an account removes them. A backup exported from the earlier version can be imported, which stores its records encrypted.
