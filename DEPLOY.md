# Deployment — 2026.10.25.14

Pushes to `main` run the repository's test-and-deploy workflow. This release includes new rules for shared review metadata, so it requires a rules deployment before Hosting. No Functions deployment is needed.

CI uses Node 22, Java 17, the committed npm lockfile, deterministic application build checks, browser regressions, installed-PWA offline/update checks, unit suites and Firestore emulator security/concurrency checks. It then deploys Firestore rules and finally Hosting.

The existing `FIREBASE_SERVICE_ACCOUNT_FINANCE_TRACKER_BC7C9` secret must identify a service account authorized to deploy both Firebase Hosting and Firestore rules. A failed rules deployment blocks Hosting.

For manual deployment from the repository root:

```bash
npm ci --ignore-scripts
npm run build
npm test
npm run test:rules
npm run test:emerald
npm run test:pwa
npx firebase deploy --only firestore:rules --project finance-tracker-bc7c9
npx firebase deploy --only hosting --project finance-tracker-bc7c9
```

Apply the update notice in the browser or installed app and confirm version **2026.10.25.14** under Settings → App & updates. The worker cache is release 83. Verify the shared review state on a second signed-in device. See REVIEW_SYNC.md for migration, offline conflict handling and payment verification semantics.
