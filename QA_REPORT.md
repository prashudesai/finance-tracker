# v2026.10.24.5 QA and performance

## Baseline and changes
Built directly from the complete working v.7 ZIP. Financial modules, Firebase client/store, family access and account photo JavaScript are byte-equivalent after normalizing asset URL version suffixes. Rules and Functions are identical. Whole-state validation remains enabled.

Current-page-first startup replaces blocking rendering of every workspace. Idle callbacks prepare remaining page groups; an early navigation renders its group immediately. Full refresh clears pending groups, so already queued callbacks cannot duplicate that work. Growth projection remains computed on opening the projection page. The broad post-save full refresh is retained in this release to avoid introducing record-consistency risk.

## Browser verification
Actual HTML/UI ran locally with synthetic cloud adapter and IndexedDB. No production account or data was used. Deliberately replaced PFT_APP_INFO with an object missing sections: startup completed, onboarding saved, dashboard appeared, and the App info fallback opened without a Console exception. All main pages navigated; refresh restored Settings. Final release App & updates displayed installed/latest 2026.10.24.5. Full guide had 24 section headings. Desktop profile x=61px precedes brand x=121px; mobile profile x=17px at 390px; no document horizontal overflow in that mobile check.

With 10,000 synthetic income rows and the remaining multi-account fixture, local startup from mock cloud adapter execution through showApp measured v.7 [511.0,408.6,534.9] ms and candidate [390.7,371.5,395.4] ms. Medians 511.0 vs 390.7 ms, about 24% less time in this small comparison. This is not end-to-end Google sign-in/Firebase network time, a controlled hardware benchmark, or a guarantee for a user's device. Remaining pages prepare after display. Real latency was deliberately excluded. A test-only randomUUID shim handled the local HTTP preview; production HTTPS code is unchanged.

## Automated checks
All original regression suites, eight audit scenarios and 500 recurring differential scenarios passed. Added App info metadata startup cases and render scheduler tests covering readiness, current-page-first, no duplicate dashboard, early navigation, one render per group, and full-refresh invalidation. Tests and output included. Modules/inline scripts parse. ZIP CRC and every manifest checksum verified.

## RCA and limits
The supplied Console error confirms Settings startup aborted on PFT_APP_INFO.sections not being iterable. The shipped source contains complete sections; why the browser received an incomplete object remains unconfirmed. This release validates optional metadata before iteration and tests the reported condition in a full local browser flow. Real Google OAuth, real Firebase data/permissions, PWA update activation and physical iPhone Safari have not been exercised in this environment. This release does not claim to eliminate network-related startup delays. No deployment performed.
