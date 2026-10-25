# Improvement delivery record

- 2026.10.25.8: recoverable device form drafts and browser deployment gate.
- 2026.10.25.9: bounded dated device restore points and explicit validated device/cloud record selection. Automatic merging is not enabled.
- 2026.10.25.10: shared cash-flow module, monthly close review, statement-check annotations for automatic entries, valuation dates and return-basis details, recorded recurring commitments, inflation-adjusted portfolio goal scenarios, financial parity checks, sync details, remembered navigation/filter context and accessible mobile dialogs.

The .10 unit suite includes original financial regression tests, 4,800 month comparisons against the previous calculations and model edge cases. The deployment gate runs the expanded unit suite and responsive browser checks. Database format and cloud access rules are preserved.

Device-only review metadata is explicitly labelled and does not alter financial balances. It is not synchronised or included in financial JSON backups. Legacy automatic contribution behaviour remains unchanged. A confirmed statement check is distinct from posting a contribution.

This is an incremental modularisation. The legacy main HTML and theme overrides remain; a complete framework rewrite and removal of all legacy renderers are not claimed. Native iPhone keyboard and screen-reader testing remains a manual-device validation item. See WORKBENCH_RELEASE.md for scope and limits.

- 2026.10.25.11: extracted HTML/CSS/runtime assets, feature-organised source fragments and deterministic build gate. Classic runtime and theme cascade preserved; no framework rewrite or visual redesign claimed.

Installed-PWA-style benchmarks for .11 use a real service worker and offline cached reloads, two run orders and 18 samples per version. Rendering changes are validated by dirty-page/coalescing tests, the full browser suite and offline update tests. Physical-iPhone timing remains unmeasured.

- 2026.10.25.12–14: compact attention view, on-device search, shared reviews/payment verification and selective draft clearing.
- 2026.10.26.1: combined edit/confirm, complete backup/restore, bottom Search control, prelaunch compatibility removal and measured review-render optimization. Current details are in COMBINED_RELEASE.md and REVIEW_SYNC.md; historical device-only notes above describe earlier releases.
