# Gmail recovery-key delivery (PR #45)

The encrypted tracker generates recovery keys **in the browser**. A new vault owner can choose **Email recovery key to my Gmail** while saving the key, and can email a new replacement key from **Settings → Account → Encrypted vault** after rotating a lost key.

## Required project configuration

1. The owner of Firebase/Google Cloud project `finance-tracker-bc7c9` must enable **Gmail API**: https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=finance-tracker-bc7c9
2. Configure the OAuth consent screen for the Google sign-in client and add `https://www.googleapis.com/auth/gmail.send`. This is a **sensitive scope** and may require Google app verification, publishing, or test-user allowlisting before external users can authorize it.
3. The actual Gmail mailbox of the signed-in Google account must be available. OAuth sign-in alone doesn't guarantee that an account has Gmail.
4. Test with a non-production account before launch. The browser must allow Google sign-in popups.

## How this is secured

- The app requests only `gmail.send` and only when the owner actively presses the email button, so ordinary Google sign-in doesn't request Gmail permissions.
- The Gmail OAuth access token is used only in memory and is never placed in Firestore, browser storage or application telemetry.
- Before sending, the app checks the result is the same signed-in Firebase UID **and** Google email as the owner, and sends only to that address.
- The recovery key is sent directly from the browser to `gmail.googleapis.com/gmail/v1/users/me/messages/send`. There is no own server, mail relay, or logging of the key.
- If Gmail rejects the request or the user declines consent, the vault remains accessible and the user can save the key securely offline. The app never claims email was sent unless Gmail reports a message ID.
- **Important security tradeoff:** Email delivery puts a usable recovery key in the owner's mailbox. Anyone with access to the mailbox may recover the encrypted tracker. Encourage offline backup and two-factor authentication. This is not end-to-end encrypted against the email provider.

## Test commands

```sh
npm ci --ignore-scripts
npm run build
node tests/recovery-email.cjs
node tests/vault-device-approval.cjs
npm run test:rules
npm test
npm run test:emerald
npm run test:pwa
```

Run manual device pairing approval and denial using distinct authenticated browsers and an already-unlocked owner desktop. Confirm a request expires after 5 minutes and that a non-owner cannot approve requests. Pairing code and recovery-key unlock remain available as fallback.

## Release dependency

The Gmail send feature can be deployed as browser code without any Cloud Functions. **It cannot successfully send until the Gmail API and OAuth consent are configured.** This release does not silently enable Google Cloud services or create OAuth credentials.
