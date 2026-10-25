# Staged improvement work

Existing production baseline: 2026.10.25.7.

1. Work protection — device/account-scoped draft recovery in implementation. Must test refresh, discard, account switching, offline and quota failures before release.
2. Foundation — automate the complete unit and browser checks in CI and extract shared calculation modules without changing results.
3. Sync/recovery — durable dated restore points; record-level three-way conflict review. Never merge competing edits without a choice.
4. Experience — consistent compact status, focus/keyboard/safe area checks, remembered page context across layouts.
5. Financial workflow — reconciliation parity, scheduled/confirmed contributions, valuation dates, guided monthly close.
6. Planning — inflation-adjusted projections and recorded-data-driven retirement/commitment insights.

Do not mark a stage complete based only on new UI or helper tests. Verify the persisted state, reload behaviour, account isolation and financial totals in browser scenarios. Production deployment is the final action after validation. Existing records require migration fixtures if schema changes.
