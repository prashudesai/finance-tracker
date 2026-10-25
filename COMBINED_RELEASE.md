# Combined release — 2026.10.26.1

## Delivered

- Retirement, fund and PMS amount correction returns to the relevant month/entry after a successful save. Cancel returns without payment confirmation; a failed save leaves the editor open. Existing balance-difference corrections remain authoritative.
- One complete backup includes financial records, audit history, shared month reviews, valuations, planner inputs and payment confirmations. Current emergency recovery exports use an explicit versioned kind; a missing review snapshot preserves existing reviews.
- Local financial import and its review journal commit together. Offline restore survives reload. The cloud financial pointer and review replacement publish in one transaction with revision/epoch checks. Conflicts offer explicit backup-versus-cloud review choices.
- Import only discards the review operations captured for that confirmed import. A device transaction guard blocks another tab from appending reviews while the restore journal exists. Newer operations are preserved instead of silently deleted on acknowledgement.
- Search is a compact bottom control in all workspaces. It sits above Modern/Emerald mobile navigation, keeps a 48px tap target, hides during mobile form input and open dialogs, and is omitted from print.
- Removed obsolete device-review migration and localStorage mirrors, unversioned financial-only import, hidden P2P ROI controls/type guesses, unused projection repair, the old monolithic performance fixture, and implicit daily-loan statement cutoffs. Current daily-loan callers provide an explicit as-of date.
- Review reads cache the shared view between changes and clone only the requested group. Payment marks are read once per monthly render. Ordinary saves avoid unnecessary review-journal reads.

## Validation and deployment

The automated release checks cover financial parity, browser layouts across all active styles, failed editor saves, complete/current emergency backup files, invalid/aborted imports, offline recovery, multi-window review guards, explicit cloud conflicts and installed-PWA update behavior. The Firestore emulator exercises actual SDK permissions and atomic transaction rollback.

Performance uses two run orders, 18 samples per version, a real service worker and synthetic records. The 100-entry monthly review median improved from 34.95ms to 27.4ms (21.6%). Startup and page-switch results are mixed; no general speedup is claimed. See PERFORMANCE.md for raw methodology and limits.

GitHub main retains the existing test → rules → Hosting deployment pipeline. Apply the update notice and confirm 2026.10.26.1. Export a new complete backup from this version. Physical Android/iPhone validation remains a manual-device item.
