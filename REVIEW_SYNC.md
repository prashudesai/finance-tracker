# Shared reviews and payment verification — 2026.10.25.14

Monthly review marks, valuation dates, planner inputs and payment checks now use a separate shared Firestore document at `users/{ownerUid}/reviews/current`. Financial snapshot storage and totals keep their existing format. Older app versions cannot erase these review fields when saving financial snapshots.

Owners and editors can change reviews; viewers can read them. A single realtime listener receives changes. IndexedDB stores the last shared revision and individual pending operations for offline use. Independent entries merge; competing changes to the same entry stop with a visible conflict. Sync details can export pending review changes or explicitly discard them and reload shared reviews. Financial records are untouched by either action.

Existing device review marks are imported after the first server snapshot. Existing shared entries take precedence. Payment checks imported from the older version remain review marks, and are not relabelled as confirmed payments.

In Monthly close, expand **automatically posted entries**. These entries are already included in balances. **Edit amount** opens the existing contribution editor for retirement accounts, investment contributions or PMS contributions. Save the corrected amount, reopen Monthly close and mark it paid from the statement. The editor adjusts financial balances by the difference; payment confirmation only stores review metadata and never posts another contribution. Editing the amount/date invalidates the previous confirmation. PF EPS changes also invalidate payment confirmation.

Payment verification does not postpone existing automatic posting. This release adds explicit unverified/paid states to that established behavior.

Clear Dashboard resets shared reviews with a new epoch after the financial clear is saved. Old offline review operations cannot restore marks from before the reset. Account deletion continues to remove the owner's entire subtree. Review changes have a separate JSON export in Sync details; financial snapshot backups retain their existing format.

Drafts remain device-only. A successful direct form save removes only draft fields captured from that form, and only if their values and edit versions have not changed while saving. Failed saves, unrelated forms and newly typed work retain drafts. Secondary asynchronous dialogs conservatively retain drafts rather than guessing which save completed them.

Deployment requires the new Firestore rules before the new Hosting release. CI checks security rules with the Firestore emulator, including actual concurrent owner/editor transactions, then deploys rules before Hosting. If rules deployment fails, Hosting does not publish.
