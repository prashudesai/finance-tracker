# Encrypted finance vault

The browser creates a random 256-bit AES-GCM vault key. It encrypts tracker snapshots, shared review content, and custom account photos before Firestore writes. Each encryption uses a fresh 96-bit nonce and a purpose-specific authenticated scope. Firestore stores ciphertext, revision metadata, account IDs, invitation emails and timestamps. Firebase administrators can see those metadata and control availability, but cannot decrypt the financial content or custom photos from Firestore alone.

The owner chooses a passphrase (at least 12 characters). PBKDF2-SHA256 with 600,000 iterations and a random salt derives a wrapping key; Firestore stores only the encrypted vault key. A separately generated 256-bit recovery key wraps the same vault key. The original passphrase and recovery key are never uploaded in readable form. Only the owner can replace the shared passphrase or recovery key. If the passphrase, recovery key and all unlocked devices are lost, the data cannot be recovered.

Members sign in through an accepted family invitation and enter the shared passphrase on a new device. “Remember this device” is opt-in and stores a non-extractable browser key and a locally wrapped vault key in IndexedDB. An unlocked family device can approve another authorized device with a random, five-minute pairing code. The code is transferred by the people involved; Firestore holds only the vault key encrypted with the secret part of the code.

The optional “Email to myself” button opens the user's email app with the recovery key in a draft. The user reviews and sends it. Mail providers and anyone with access to that inbox can then read the recovery key; a password manager or offline copy is safer. Firebase does not send that email.

The encrypted release intentionally has no migration from plaintext cloud snapshots. Before deploying it to existing users, they must export any backup they want, delete their old tracker account using the existing account-deletion flow, and create a fresh account. Deleting the account recursively removes its cloud documents. The encrypted release uses a new browser database name so an old plaintext device cache cannot be uploaded automatically.

Encryption does not protect against a compromised device, malicious browser extension, injected script running on the app origin, or someone who obtains the passphrase or recovery key. Downloaded JSON backups and browser-local financial records are not encrypted by this cloud feature. Family invitation emails and Google identity metadata remain visible to the cloud service.
