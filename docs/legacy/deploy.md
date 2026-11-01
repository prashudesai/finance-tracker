# Deployment — 2026.10.26.3

## Fast, risk-based release validation (October 2026)

The repository now uses two safe validation lanes so routine styling fixes do not repeat every financial test:

- **Pure stylesheet / static image changes** (only CSS and image files under `src/` or `dist/`): build, check generated files, and run targeted Cash Flow and Finance Insights mobile browser regressions before production deployment.
- **Every other change** (JavaScript, HTML, Firestore rules, cloud/data handling, tests, build tooling, dependencies and unknown changes): the complete browser, installed-PWA, Firestore rules, and financial tests.
- The classification **fails closed**: manual deployments and unknown Git commit ranges get full regression tests and the rules deployment.
- The automated **Validate proposed finance changes** pull-request workflow provides feedback before merging. The old full staging workflow is available manually via **Actions → Validate staged finance release (full, on demand)** for significant releases.
- Production CI uses npm and Chromium caching, checks a deterministic build and deploys Firestore rules only when `firestore.rules` or Firebase configuration changed (or a manual / unknown-range run requires a full release).
- Changes confined to `.github/**` or Markdown docs do not start a redundant Firebase production deployment; they are covered by PR validation.
- GitHub and Firebase execution time can vary; these are optimizations, not deployment-time guarantees.

When applying a small visual fix, keep changes confined to the stylesheet if possible. If any functionality or stored data is affected, keep its JS/HTML/config changes and allow the full lane to run. Do not bypass failing tests or use force-pushes to skip financial checks.

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
