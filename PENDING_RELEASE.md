# Combined release 2026.10.26.10

Prepared against 2026.10.26.9. Commit to main runs the normal test-and-deploy workflow; production activation depends on successful CI.

## Included

- Cash Flow: collapsed balance breakdown using the existing household cash-flow model. Links open the existing opening/closing bank-balance form. The profile headline and household breakdown are explicitly distinguished. PF/NPS payroll deductions are not deducted twice.
- Cash Flow: collapsed upcoming commitments, based on configured recurring income, expenses, EMIs, explicit investment schedules and PPF schedules. Expected income is not added to available funds. Missing opening balances or unknown payment amounts prevent a definitive remaining estimate; overdue unrecorded payments are included.
- Month end: an automatic-entry review prompt appears on the last calendar day only, for the selected month/profile's unconfirmed entries. It opens existing records, supports amount correction, and records confirmations through shared reviews without reposting entries. Includes recurring income/expenses and investment contributions.
- Investments: compact valuation dates within holding/category cards, targeted review/update actions, invalidation after balance changes, and a bounded account preview. Review thresholds: 45 days for market values, 366 days for PF/PPF. Invalid or missing confirmations are never presented as fresh.
- Bottom-centre sync: uses the same bottom visibility detection as record search; hidden when scrolling away and while editors/dialogs are active. Reports device saving, pending upload, offline, cloud verification and sync problems using existing state. Opens existing sync details.
- Dashboard: collapsed monthly changes with actual contributions, principal repaid, recorded spending comparison and PMS profit-snapshot changes. A previous-month snapshot is required for PMS gains; absent valuations are shown as unavailable rather than zero. Other assets' monthly gains are not fabricated.
- Earlier requested loading improvement: visible loading text and spinner, including “Signed in — loading your family’s financial data…” after authentication.

## Implementation notes

- Existing financial records, permissions, cloud schema and shared-review groups are reused.
- Rendering is scheduled for the active page only. Unchanged valuation footers and insight bodies are retained to preserve focus/menu stability and avoid unnecessary DOM updates.
- Theme colours inherit the active Appearance style; Cash Flow entry forms retain their desktop/mobile behaviour.
- Generated production assets, offline shell and content hashes are rebuilt by tools/build.cjs.

## Validation

- Full npm test chain passed, including new financial-insight model checks.
- Existing broad browser suite: 137 passed before the menu correction. The correction passed the formerly failing menu check; a later local rerun timed out in an unrelated navigation action. The normal CI suite must pass before deployment.
- Existing Cash Flow browser suite: 28 passed.
- New insight browser suite: 7 checks (including the menu regression), including all three Appearance styles at 320, 390, 701 and 1440 pixels.
- Browser checks use mocked Google/Firebase services and a local Chromium executable. Physical iOS/Android and real Google authentication were not exercised for this batch.
- No Firestore rules or authentication logic changes were introduced by the six-feature batch.

## Deployment correction

The first CI attempt stopped at the investment add-menu browser check, before any production deployment. The menu's existing capture-phase scroll listener dismissed it on every scroll, including layout/scroll anchoring events after valuation footers appeared. Keep an open menu anchored to its visible Add button, ignore scrolling inside the menu, and dismiss it when its anchor leaves the viewport. Outside click, Escape, and selection continue to dismiss it. Regression checks explicitly deliver document and internal-menu scroll events before choosing a type across Appearance styles and mobile/desktop widths.

## Compact follow-up: 2026.10.26.11

Reduce disclosure-card padding, label size and corner radius. Collapsed desktop disclosure rows use a 36px summary with 6px vertical card padding; mobile keeps a 44px summary tap target with 4px vertical card padding. Expanded bodies retain separate spacing. Financial logic, record storage and authentication are unchanged. Production remains governed by the full CI workflow.
