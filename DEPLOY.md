# Deploy v2026.10.24.5 from this new folder

1. Export a JSON backup from the currently working v.7 under Settings → Data & backup.
2. Extract this ZIP and open Terminal in its Project folder, the folder containing firebase.json. Do not run from the folder above it or from dist.
3. If Firebase login is needed, run:

```bash
npx firebase-tools login
```

4. Since v.7 is already live, deploy hosting only:

```bash
npx firebase-tools deploy --only hosting --project finance-tracker-bc7c9
```

Wait for Deploy complete. This complete project contains its own dist, firebase.json, .firebaserc, firestore.rules and Functions source. No old project folder is required. Rules and Functions have not changed, so do not run a plain deploy that deploys everything.

5. Open the app. If Settings → App & updates says an update is ready, apply it. Verify installed version 2026.10.24.5. Check sign-in, refresh on a different page, records and profile placement. You can delete the earlier extracted project folder after verifying this version; retain your JSON backup and working v.7 ZIP for rollback.

Do not clear browser storage or import a backup as part of this update. Existing Firebase records remain in the same project. The app still waits for Google identity, family access verification and cloud loading; slower real network responses may still delay refresh.
