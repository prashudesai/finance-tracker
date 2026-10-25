# Financial review and planning tools

This release introduces an independently tested shared cash-flow model and uses it for monthly totals, indexed totals and recalculated house expense. Existing month calculations are compared against 4,800 generated month fixtures. The projection engine is reused without changing investment growth assumptions.

## Controls

- Income & Expenses → Month review: opening/closing balance checklist, residual house expense, automatic-entry statement review, and pending recurring items over the next 60 days. Marking reviewed does not lock the month or change money.
- Investments → Record freshness: confirm a valuation date against the current balance, inspect gain and XIRR availability. Changing a balance invalidates its confirmation.
- Growth Projection → Goal planning: compare stress/base/optimistic portfolio scenarios in nominal and today's rupees, with an editable inflation assumption and goal. Debt and gratuity are excluded; this is not a retirement-income withdrawal model.
- Settings → Records → Calculation checks: reconcile shared monthly totals and available dashboard figures, inspect sync status, retry or export.

Review marks, valuation dates, goal inputs, filter choices and scroll positions are account-scoped on this device/browser. They are not financial records and are not synced or included in JSON backups. Automatic entries are labelled separately from statement checks; legacy contribution posting behaviour is preserved.

The UI adds collapsed tools rather than permanent informational cards. Native modal dialogs have accessible headings and mobile scrolling. Mobile controls avoid small-text zoom, and reduced-motion preferences are respected.

Existing database schema, Firestore rules, Hosting and Functions stay compatible. The GitHub workflow runs browser checks and the expanded unit suite before deployment.

## Remaining architectural work

The legacy main HTML and theme CSS have not been fully replaced. This release extracts household cash-flow calculations and adds independent modules; it is not a complete application framework rewrite. Device-only review metadata would require a separately tested schema migration to sync across devices. Native iOS keyboard and assistive-technology behaviour still needs testing on actual devices.
