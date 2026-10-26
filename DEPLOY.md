# Deployment — 2026.10.26.3

Pushes to main run the test-and-deploy workflow. CI uses Node 22, Java 17, the npm lockfile and v5 checkout/setup actions. It verifies the deterministic build, browser regressions, installed-PWA offline/update behavior, Firestore security and concurrent transactions, and unit suites. It deploys rules before Firebase Hosting. This release does not require new Firestore rules or a Functions deployment.

The FIREBASE_SERVICE_ACCOUNT_FINANCE_TRACKER_BC7C9 secret supplies the existing deployment identity, with Hosting and Firebase Rules deployment permissions.

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

Apply the update notice in the browser or installed app. Confirm version 2026.10.26.3 under Settings → App & updates; the worker cache is v87 with a content-derived suffix. Export a new complete backup from this version. Unversioned financial-only or obsolete backup files are no longer imported.

Performance comparisons use tests/performance-browser.cjs with PFT_PERF_BASELINE_DIR pointing to the dist directory of baseline commit 0e25514490e49f0bd7de8558bed985364870c75b. Run once normally and once with PFT_PERF_ORDER=after-first. The benchmark uses synthetic records and an actual service worker; it is not a physical-device measurement.
