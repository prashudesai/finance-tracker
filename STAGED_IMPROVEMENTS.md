# Improvement delivery record

- 2026.10.25.8: recoverable device form drafts and browser deployment gate.
- 2026.10.25.9: bounded dated device restore points and explicit validated device/cloud record selection. Automatic merging is not enabled.
- 2026.10.25.10: shared cash-flow module, monthly close review, statement-check annotations for automatic entries, valuation dates and return-basis details, recorded recurring commitments, inflation-adjusted portfolio goal scenarios, financial parity checks, sync details, remembered navigation/filter context and accessible mobile dialogs.

The .10 unit suite includes original financial regression tests, 4,800 month comparisons against the previous calculations and model edge cases. The deployment gate runs the expanded unit suite and responsive browser checks. Database format and cloud access rules are preserved.

Device-only review metadata is explicitly labelled and does not alter financial balances. It is not synchronised or included in financial JSON backups. Legacy automatic contribution behaviour remains unchanged. A confirmed statement check is distinct from posting a contribution.

This is an incremental modularisation. The legacy main HTML and theme overrides remain; a complete framework rewrite and removal of all legacy renderers are not claimed. Native iPhone keyboard and screen-reader testing remains a manual-device validation item. See WORKBENCH_RELEASE.md for scope and limits.
