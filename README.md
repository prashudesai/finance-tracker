# Personal Finance Tracker — 2026.10.26.1

Family income, household expenses, investments, retirement accounts and loan ledgers in a Google-authenticated web app and installable PWA. Owners, editors and viewers share the same tracker with role-specific access.

The current release combines contribution amount editing with return-to-review, complete financial/review backup restore, explicit sync conflict choices, and compact bottom Search. See COMBINED_RELEASE.md, REVIEW_SYNC.md and RECORD_SEARCH.md.

Only current versioned backup files import. Complete exports include shared review marks and payment confirmations; explicitly marked current device-recovery files can preserve existing reviews if a review snapshot was unavailable. Obsolete raw financial-only files are rejected before records change. No existing tracker data is reset by deployment.

Use Node 22 and Java 17 for development and emulator checks:

```bash
npm ci --ignore-scripts
npm run build
npm test
npm run test:rules
npm run test:emerald
npm run test:pwa
```

Edit application source under src/core and src/index.html, or the independent feature modules in dist. Build-generated HTML/runtime assets must match their source. GitHub main runs validation and deploys Firebase rules before Hosting. See DEPLOY.md.

PERFORMANCE.md and PERFORMANCE_RESULTS.json contain reproducible measurements and limitations. Actual phone timing, keyboard and assistive-technology validation requires physical devices.
