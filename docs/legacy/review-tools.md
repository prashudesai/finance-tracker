# Financial review tools — 2026.10.26.1

- Monthly close: household opening/closing balances, residual house expense, review marks and automatically posted contribution checks. Marking reviewed does not lock a month or change money.
- Amount correction: retirement, fund and PMS editors return to the selected payment review after a successful save. Failed saves retain the editor, and payment confirmation never posts twice.
- Valuation freshness: shared statement dates are tied to the recorded balance. A changed balance needs confirmation again.
- Portfolio goal planner: stress/base/optimistic scenarios, editable inflation and a target in today's rupees. It uses the existing projection model and excludes debt and gratuity.
- Sync details: financial and review status, exports, retries, financial conflict selection and explicit backup-review conflict choices.
- Search: a compact bottom control available from every workspace. It sits above mobile navigation, hides during form input/dialogs and follows the selected family profile.
- Backup: one current complete JSON file includes financial data and shared reviews; device drafts remain local. Restore coordinates local persistence and atomic cloud publication.

Review reads are cached between changes; callers receive isolated group values. Month review reads payment markers once per render, and obsolete localStorage mirrors no longer serialize all reviews on every update. Ordinary financial saves avoid unnecessary restore-journal reads.

Prelaunch cleanup removes device-review migration, financial-only backup import, obsolete P2P ROI controls and investment-name guesses, unused zero-override repair, and the implicit daily-loan statement cutoff. Daily-loan calculations receive an explicit as-of date from current callers. Active Classic, Modern and Emerald Flow themes use the same current financial records.

Automated coverage includes calculation parity, permission/transaction checks, offline installed-PWA reload/update, backups, editor failures and responsive layouts. Physical Android/iPhone keyboard, screen reader and timing checks still require actual devices.
