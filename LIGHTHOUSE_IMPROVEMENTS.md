# Lighthouse improvements — release 2026.10.26.3

The supplied Lighthouse reports measured Desktop performance 91 and Mobile 73. Mobile simulated LCP was 6.9s, with 40ms total blocking time. Both runs included extension scripts and warned about IndexedDB and an incomplete/time-limited run. Their observed LCP breakdown and simulated headline timings are different measurement types and must not be added together.

## Implemented

1. **Owner startup from validated device records.** A restored, verified owner identity may open its own clean IndexedDB snapshot before a full cloud download. A lightweight server revision check runs afterward. Explicit Refresh stores a durable metadata hint to bypass a clean cached copy and clears the hint only after a fresh snapshot is saved. Startup reads the records, sync envelope and hint in one IndexedDB transaction. Cloud publishing waits until that check passes; a newer server revision blocks publication and uses the existing explicit conflict/review flow. New accounts and shared trackers retain their fresh server checks. Pending/offline writes retain their existing atomic, revision-checked publication path.
2. **Family access work leaves the owner startup path.** Returning owners refresh invitation/member lists after choosing their own tracker. Shared permissions are still checked against the server before exposing the workspace.
3. **Readiness is established before asynchronous scripts run.** The small early boot file creates auth and tracker readiness promises. Layout, theme and Cash Flow composition run before revealing records. Draft/recovery/review tools wait for the actual completed startup, including after reload.
4. **PDF and charts load on demand.** Chart.js is requested by analytics/projection rendering, and jsPDF by the loan export or App info guide action. Requests are deduplicated and failures can be retried. Loan PDF export cancels if its selected loan changes or the history closes while the library is loading. The service worker still caches these libraries for offline use, after the first view has been revealed.
5. **Minified, content-addressed production assets.** Readable canonical sources remain available for tests and debugging. Generated production scripts/styles live in `dist/assets/` with content hashes. Classic-script global names are preserved. Pre-minified vendor output is kept when re-minifying would increase its compressed size.
6. **Reliable cache/update boundaries.** Only hashed assets receive one-year immutable HTTP caching. HTML, metadata and the worker remain refreshable. The worker identity includes the complete asset graph and static shell bytes, including HTML/icons/images. The existing explicit update approval and save guards remain in place. Apply update stays disabled until the registration identifies a waiting worker.
7. **Print styles are separated.** Print-only CSS loads with print media rather than blocking screen rendering. Shared/page/theme styles remain available. CSS is not deleted based only on one page's coverage.
8. **Accessibility fixes.** The tracker has a main landmark; navigation accessible names include their visible desktop/mobile labels.
9. **Authentication dependency setup.** `initializeAuth` preserves IndexedDB, local and session persistence, while the popup resolver is supplied explicitly to user-initiated sign-in. A real-SDK mobile smoke check verifies that signed-out startup does not fetch Google popup frames. Google cookies may still be used during an actual Google sign-in.
10. **Source maps and timing marks.** Production JS/CSS has reachable maps. Application maps target readable canonical sources; already-minified vendors may use line-level mappings to their distributed source, not missing upstream TypeScript maps. Anonymous timing marks record auth/access/device-read/layout/view milestones in memory; no analytics service or personal data collection was added.

## Controlled local startup comparison

| Scenario | Before median | After median | Reduction |
|---|---:|---:|---:|
| Cold load | 11.42s | 7.76s | 32.0% |
| Signed-in return navigation | 1.89s | 1.40s | 25.9% |

Five samples per condition in alternating order, clean browser contexts without extensions, 390×844 mobile viewport, CPU throttled 4×, 100ms latency, 1.6Mbps download. Assets were served uncompressed with HTTP caching. Both versions used the same fake Firebase SDK/transport and real IndexedDB. Cold contexts start without device records; warm navigation retains records and HTTP cache. The baseline is the Cash Flow branch at `6bc2453`, not the older supplied Lighthouse release.

These figures compare the local implementation under controlled conditions. They exclude real Firebase SDK download/authentication and production server latency, are not installed-phone measurements, and do not establish a new Lighthouse score. The real Firebase SDK is covered by a separate signed-out smoke test. Raw samples and asset-size estimates are in `STARTUP_PERFORMANCE_RESULTS.json`.

## Verification

- 44 existing regression suites passed.
- 137 broad browser checks passed (including backups, offline reviews, conflicts, layout and draft recovery).
- 21 focused Cash Flow checks passed across all three styles and 320/390/700/1440px viewports.
- Seven startup/library checks passed: cached view and gated concurrent edits; explicit refresh to a newer snapshot; newer cloud revision conflict; shared-access denial; PDF failure/retry; chart demand loading; real Firebase auth startup.
- Ten installed-PWA checks passed with a distinct asset graph for the simulated next release, explicit activation and offline reopen after updating.
- Deterministic build, generated imports, source maps, asset coverage, print extraction and Hosting cache policy checked.

## Release

Included alongside Cash Flow in combined release 2026.10.26.3. The existing npm-ci/build/test/Firebase workflow is sufficient. No separate infrastructure, Firestore rule or Cloud Function deployment is required. Re-run signed-in mobile and desktop Lighthouse after deployment, plus a physical phone keyboard/PWA check.
