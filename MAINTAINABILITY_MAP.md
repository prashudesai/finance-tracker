# Finance Tracker maintainability map

> **Status:** A read-only map of the existing architecture, based on the repository at
> `fa9a5b3645c0aa44c6d07ad36482ee0990b57298` (release 2026.10.27.10).
> This is a guide to navigating and safely changing the current implementation,
> **not** a refactor proposal, new financial specification, or approval to deploy.
> Re-check `main` and the open PRs before working: another development session
> may have changed the baseline.

## Non-negotiable behavior

1. Financial records are **local-first**. A device save and a successful cloud
   publication are different outcomes. Never report "synced" merely because a
   local write succeeded.
2. Do not silently merge or replace competing financial snapshots. Device/cloud
   conflicts and record recovery require explicit review; the writer's cloud
   revision must not be advanced by a read-only inspection.
3. Preserve **owner/editor/viewer** permissions in the UI, client API, and
   `firestore.rules`. Family viewers must not gain write access through a new
   button or code path.
4. Protect existing record IDs, dates, contribution histories, loan splits and
   monthly balances. A calculation change must be supported by independent
   regression cases and historical-record validation.
5. Distinguish **real entries** from forecasts and verification metadata.
   Payment/statement confirmation must not create a second contribution.
6. Keep an installed PWA on a consistent asset release. Do not activate a partly
   installed worker or discard pending/unsaved device records during update.
7. Preserve current responsive appearance styles and the original form handlers.
   Mobile presentation may move existing form nodes; it must not fork finance logic.
8. Avoid a framework or module-system rewrite. The classic core is deliberately
   ordered and shares global bindings.

## Source ownership: where to edit

| Responsibility | Canonical editable files | Important boundary |
| --- | --- | --- |
| Shell and startup wiring | `src/index.html`, `src/boot.js`, `src/core/17-startup.js` | Sign-in/loading readiness, initial page render, navigation and cross-module globals |
| Core execution order | `src/core-order.json`, `src/core/*.js` | Assembled into one **classic-script** runtime; file order and function hoisting matter |
| State, member profiles, selectors | `src/core/01-state.js` | Combined household vs individual views; owner/editor restrictions |
| Validation, schedules, shared entry controls | `src/core/00-entry-controls.js` | Also owns schema-2 validation and automatic retirement/investment contribution catch-up |
| Device persistence and save queue | `src/core/03-storage.js` | `saveData`, `commitFinance`, IndexedDB, local revisions and pending cloud envelope |
| Income and expenses | `src/core/05-income.js`, `src/core/06-expenses.js` | Save outcomes, monthly history, linked loan/EMI recalculation |
| Loan operations | `src/core/04-debts.js`, `dist/loan-ledger.js` | Pure loan model vs mutable repayment histories and UI |
| Investments and retirement | `src/core/07-investments.js` through `11-pms.js` | Dated contributions, returns, interest credits, EPS/PF, NPS/PPF, PMS |
| Cash flow and balances | `src/core/12-balances.js`, `dist/finance-model.js`, `dist/cash-flow.js`, `dist/cash-flow.css` | Distinguish household month close from on-screen member filters |
| Dashboard, analytics, projections | `src/core/13-dashboard.js`, `14-analytics.js`, `15-projections.js`, `dist/finance-insights-model.js` | Charts/forecasts should consume validated state, not invent transactions |
| Export/import and refreshed views | `src/core/16-backup.js` | Complete backup, review metadata and validated import coordination |
| Firebase identity and cloud access | `dist/firebase-client.js`, `dist/firebase-store.js`, `dist/family-access.js`, `firestore.rules` | Verified auth, immutable chunks, revision-checked pointer, Firestore rules |
| Shared reviews and recovery | `dist/review-model.js`, `dist/review-sync.js`, `dist/record-recovery.js` | Separate review document, durable offline operations, atomic restore publication |
| Recurring transactions | `dist/recurring.js`, `dist/recurring-ui.js` | Pure recurrence planning and explicit posting; guard against duplicate installments |
| Device-only draft safety | `dist/work-protection.js` | Draft inputs are not financial records or shared backup contents |
| PWA and offline updates | `src/service-worker.js`, `dist/pwa-client.js` | Cache shell, update consent, pending-save guard |
| Appearance/layout | `src/legacy-*.css`, `dist/app-style.css`, `dist/app-style.js`, `dist/workbench.css` | CSS cascade, all appearance styles, 320–1440+ px layouts |
| Build and Hosting | `tools/build.cjs`, `tools/css-partition.cjs`, `firebase.json`, CI workflow | Deterministic assets; Firestore rules deployed before Hosting |

**Two meanings of `dist/` are intentional:**

- Several root `dist/*.js` and `dist/*.css` files above are **hand-maintained
  feature sources**. Do not assume every file under `dist/` is disposable.
- Generated outputs include `dist/index.html`, `dist/runtime/*`,
  `dist/assets/*`, `dist/print.css`, `dist/asset-manifest.json`,
  `dist/boot.js`, and `dist/service-worker.js`. Their inputs live in
  `src/`, the editable root `dist/` modules, and the build tool. The build
  also copies/reconciles pinned browser Firebase vendor files.

Read `MODULAR_LAYOUT.md`, `README.md`, and `DEPLOY.md` before changing the
source/build boundary.

## How critical flows actually connect

### Financial save path

```text
Form / editor / recurring approval
 -> mutate state with the existing business rules
 -> saveData(): recalculate household expense, validate schema + references
 -> saveQueue -> commitFinance(): account-scoped IndexedDB transaction
    - current validated state + local revision
    - audit changes and pending cloud envelope
    - backup-review restore journal, when applicable
 -> syncCloud(): upload pending snapshot when allowed
 -> financeCloud.save(): immutable chunks + SHA-256 digest
 -> Firestore transaction: publish current pointer if revision matches
 -> mark local pending envelope acknowledged only for the matching token
```

The current implementation also has `lastAccepted`, in-memory dirty state,
revision checks for competing windows, retry states, and conflict flags.
**Do not** rearrange these writes without tests for failed IndexedDB
transactions, lost cloud acknowledgements, offline reload, and account switching.

### Shared review path

```text
Review action -> reviewPatch / reviewValues
 -> IndexedDB reviewOp journal and cached view
 -> Firestore reviews/current transaction
 -> independent fields can merge; a conflicting field stops for review
```

Backup restore coordinates the review replacement with the financial pointer
inside the **same Firestore transaction**, guarded by both revision and review
epoch. A local restore journal preserves the pending state during offline reload.
See `REVIEW_SYNC.md`.

### Financial calculation boundaries

- **Cash flow and monthly close:** `income`, `expenses`, and PMS
  contributions feed month totals. Household opening balance + inflows -
  expenses - PMS contributions - next month's opening balance derives house
  expense where both opening balances exist. PF/NPS payroll deductions must
  not be subtracted a second time. Financial years run April–March.
- **Debt/EMI:** `PFT_LOAN_LEDGER` handles amortization, rate/top-up/EMI
  changes, first EMI extra interest, interest overrides, part payments and
  daily-balance loans; expense records retain their principal/interest split.
  Historical pre-tracker repayment balances are preserved.
- **Recurrence:** `PFT_RECURRING` plans and validates occurrence records.
  A manually matching transaction or a previously skipped/posted occurrence
  must not be duplicated. EMI posting respects loan chronology and first
  payment date.
- **Investments:** invested and current balances are distinct. XIRR uses dated
  cash flows; CAGR and absolute return are not interchangeable. PF/EPS/PPF/NPS
  auto contributions, annual credited interest, and PMS profit snapshots are
  separately tracked.
- **Projections:** scenario assumptions, step-ups, planned flows, fiscal-year
  interest credits, and gratuity estimates are **forecasts**, not postings to
  financial accounts.
- **Dashboard side effect to watch:** `updateDashboard()` currently invokes
  `accrueScheduledRetirementContributions()` and
  `accrueScheduledInvestmentContributions()`, which can call `saveData()`.
  Thus a dashboard render is **not necessarily read-only**. Characterize the
  scheduling behavior before separating it from rendering.

### Firebase access and PWA boundaries

- `dist/family-access.js` selects and verifies family workspaces; shared
  access requires fresh server verification. `dist/firebase-client.js` gates
  feature installation after sign-in and tracker readiness.
- Firestore rules enforce verified users, owner/editor/viewer roles, immutable
  snapshot chunks, revision increments and review epochs. Client-only guards
  are insufficient.
- Service worker caches application assets, **not financial records**; records
  remain in IndexedDB. Existing clients activate a new worker after explicit
  approval and save checks. A worker update must use a coherent generated
  asset manifest.

## Verification matrix for a change

| Change type | Minimum focused coverage | Full release gate |
| --- | --- | --- |
| Loan, EMI, or debt model | `tests/loan-ledger.cjs`, `first-emi.cjs`, `sbi-daily.cjs`, `state-loans.cjs`, `revised-emi.cjs` | `npm test` + browser suite |
| Recurring income/expense/EMI | `tests/recurring.cjs`, `recurring-orphans-ui.cjs`, `first-emi.cjs` | `npm test` + Cash Flow browser |
| Investments/returns/projections | `tests/pft_deep_regression.js`, `projection-parity.cjs` | `npm test` + relevant browser checks |
| Device/cloud save or backup | `tests/cloud-store.cjs`, `record-recovery.cjs`, `review-model.cjs` | `npm test`, `npm run test:rules`, `npm run test:pwa` |
| Auth or family roles | `tests/family-policy.cjs`, `auth-preload-browser.cjs`, `startup.cjs` | All tests including Firestore emulator |
| UI, theme or responsive layout | `tests/finance-insights-browser.cjs`, `emerald-flow-browser.cjs`, `cash-flow-browser.cjs` | `npm run test:emerald`, `npm run test:pwa` |
| Build, worker, cache or version | `tests/build-layout.cjs`, `pwa-worker.cjs`, `pwa-client.cjs` | Full tests + deterministic `dist` verification |

Use Node 22 and Java 17. For a production candidate:

```bash
npm ci --ignore-scripts
npm run build
git diff --exit-code -- dist
npm test
npm run test:emerald
npm run test:pwa
npm run test:rules
```

The `git diff --exit-code -- dist` check is meaningful **when regenerated
production outputs are committed alongside the edit**. At the snapshot pinned
above, the deployment workflow builds `dist` but **does not currently run
that committed-output drift check**, despite the documentation describing it.
Restore that CI invariant as a separate, fully regenerated, tested change—not
by weakening an assertion or bypassing a failing build.

The workflow on `main` runs tests and deploys Firestore rules before Hosting.
An Actions **success** is distinct from physical-device QA and does not
guarantee any particular user has activated the latest PWA worker. Verify
the exact commit SHA, release version and run before declaring deployment.

## Safe incremental maintainability roadmap (no automatic refactors)

1. **Document and characterize first.** For each desired behavior change,
   identify its current owner, called globals, write path, and regression
   fixture. Use a failing test when fixing a real bug.
2. **Pure computations next.** Extract a small deterministic helper with
   unchanged inputs/outputs only after pinning current behavior with fixtures;
   keep classic-script call sites and source order intact.
3. **Make mutations explicit last.** Splitting scheduled contributions from
   dashboard rendering could improve reasoning, but it changes lifecycle
   timing; require offline, multi-window, idempotence and financial-parity
   tests before and after.
4. **Reduce presentation complexity separately.** Group infrequent controls
   and standardize responsive styles while preserving focus, original form
   nodes, draft retention, accessibility and all financial actions.
5. **Harden release boundaries separately.** PR validation before merge,
   committed generated-file verification, isolated deploy permissions,
   screenshots/diagnostics on browser failures, and explicit version checks.
   Avoid large combined finance/UI/build PRs.

## Checklist for two concurrent development sessions

- Before any branch, read the **current** `main` SHA, open PR list and most
  recent Actions run. Do not assume a previously seen SHA is still current.
- Establish ownership: avoid editing the same feature/branch as the other
  session; do not force-push or overwrite its unfinished release candidate.
- Keep PRs scoped; do not silently change validation thresholds or finance
  logic to fix a CSS failure.
- After editing, build and include generated assets where required, run
  focused tests then the full gate, inspect the diff, and report what actually
  passed. Merge or deploy only after authorization and validation.
- If a new release candidate is being prepared elsewhere, **hold** unrelated
  code changes until that candidate has landed, then rebase and validate
  against its exact commit.

## Further reading

`MODULAR_LAYOUT.md`, `CLOUD_SYNC.md`, `REVIEW_SYNC.md`,
`RECORD_RECOVERY.md`, `COMBINED_RELEASE.md`, `CASH_FLOW_PENDING.md`,
`PERFORMANCE.md`, `DEPLOY.md`, and the corresponding tests.
