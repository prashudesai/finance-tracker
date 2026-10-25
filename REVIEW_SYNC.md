# Shared reviews and complete backup restore — 2026.10.26.1

Monthly review marks, valuation dates, planner inputs and payment confirmations live in `users/{ownerUid}/reviews/current`. IndexedDB holds the last shared version and durable offline operations. Independent review edits merge; competing edits to one item stop for explicit review. Owners and editors can edit ordinary reviews; viewers can read them.

## Complete backups

Settings → Export creates a single JSON file with the financial schema-2 records, audit history, owner/export information, `backupFormat: "finance-tracker"`, `backupVersion: 1`, and `reviewMetadata: {format: 1, values: ...}`. Review data includes unsynced changes saved on this device. Export rejects a stale device revision or a financial change during preparation instead of creating an inconsistent snapshot. Draft form inputs are not financial records and stay device-only.

Only the current versioned backup format can be imported. Current device-recovery exports use the same wrapper with an explicit device-recovery kind; if shared reviews were unavailable at export, import preserves the current shared reviews. Unversioned financial-only JSON files and unsupported review formats are rejected before records change. Obsolete device-review migration and localStorage review mirrors have been removed.

Import previews financial replacements and explicitly says that shared reviews will also be replaced. The owner confirms before saving. Financial records, their pending cloud envelope and a review-restore journal commit in one IndexedDB transaction. The journal survives offline reloads and supplies the restored review view while sync is pending. Ordinary review editing waits for that restore to finish.

The cloud publisher uploads immutable financial chunks, then uses one Firestore transaction to publish the financial pointer and replace shared reviews. A changed financial revision or review revision/epoch aborts both writes. A stable restore ID makes retries safe. A new epoch rejects review operations queued before the restore. A failed device commit creates neither a financial replacement nor a review journal.

Sync details → Resolve backup review sync shows the backup and latest cloud reviews. The owner can explicitly use the backup reviews or keep the latest cloud reviews alongside the imported financial records. Financial revision checks still apply. Completed restore descriptors are removed from the pending financial envelope so later saves cannot replay an import.

## Payment review

In Monthly close, expand automatically posted entries and choose Edit amount. Retirement, fund and PMS editors use their established balance corrections. Save & return to review waits for a successful device save, then reopens the relevant month and entry. A failed save leaves the editor open; Cancel returns without confirming payment. Mark paid records a statement check and never posts another contribution. Amount/date changes invalidate the earlier confirmation; EPS changes also invalidate a PF payment check.

Automatic contributions are still posted by the existing scheduling behavior. Statement confirmation verifies an already-posted entry.

Clear Dashboard resets shared reviews after the financial clear succeeds. Account deletion removes the owner's subtree. Ordinary per-record cloud conflicts and dated financial restore points retain their existing explicit-choice behavior.
