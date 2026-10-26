# Cash Flow redesign — held for a combined release

Status: prepared for the `cash-flow-mobile-redesign` feature branch. Production deployment remains held for the combined release.

## Behavior

- One Income / Expenses history at a time across Classic, Modern and Emerald Flow.
- Original add controls move into a native dialog, full-screen on mobile, with Back/Cancel and focus restoration. The original financial handlers remain connected.
- Draft values stay in the original fields when cancelling or switching types.
- Successful saves return to history; failed device writes offer Retry save for the same pending record rather than inserting a duplicate. Typing the next entry while a write is in flight preserves it.
- Compact summary uses the selected history month. Balance after expenses is income minus household expenses, consistent with existing profile rules.
- Mint/gold balance bar uses income as the denominator. No income, no activity and deficit states use explanatory text instead of misleading percentages.
- Original family, source, annual-expense, subcategory, EMI / part-payment, notes, financial-year and month controls remain available.
- Monthly surplus / opening balance tools are collapsed into a secondary disclosure.

## Changed code

- New `dist/cash-flow.js` and `dist/cash-flow.css`.
- `dist/firebase-client.js` installs the module and stylesheet.
- `dist/app-style.js` lets the new module own Cash Flow instead of building a second composition. Dashboard Add actions open the new entry screen.
- `src/core/05-income.js`, `06-expenses.js`, `12-balances.js` connect save outcomes, record IDs, selected-month summary and balance bar. Rebuilt `dist/runtime/app-core.js`.
- `dist/service-worker.js` stages cache v86 and both new assets. Assign a release version with the combined release; current app metadata still reads 2026.10.26.2.
- Browser suite updated for opening and closing the dedicated entry form. New focused suite: `npm run test:cash-flow`.

## Validation

- 44 unit/regression suites passed after initial implementation.
- 21 focused browser checks passed across 320, 390, 700 and 1440px in all three Appearance styles.
- Mobile history and entry screenshots inspected and header/spacing adjusted.
- All 137 broader browser regression checks passed.
- All 10 installed-PWA offline/update checks passed with the new cached assets.
- Historical summaries, edit actions and loan/EMI validation passed in the focused suite.
- Inspected the final mobile screenshots, including compact record action menus and gold icons.
- Physical phone keyboard behavior remains manual QA.

Before combined deployment: run build, all browser/PWA checks, update package/app metadata and release notes, and regenerate SHA256.json.
