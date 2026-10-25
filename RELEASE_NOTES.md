# v2026.10.26.1

- Save & return to review keeps retirement, fund and PMS corrections in one flow. Failed saves retain the editor; confirmation never posts twice.
- Complete backups include shared reviews and payment confirmations. Imports commit a durable device journal and publish financial records/reviews in one Firestore transaction, with explicit conflict choices.
- Current emergency recovery exports use an explicit versioned wrapper and preserve shared reviews when no review snapshot was available.
- Search is now a compact bottom control available across workspaces, with mobile-navigation spacing and input/dialog hiding.
- Prelaunch cleanup removes obsolete device-review migration, raw financial-only backup imports, unused P2P ROI controls/name guesses, unused zero-override repair and implicit daily-loan statement cutoffs. Current financial records and active themes remain supported.
- Two benchmark orders (18 samples per version) show monthly review rendering 21.6% faster for the 100-entry fixture; other timings are mixed. See PERFORMANCE.md.
- Physical phone validation is still manual. Automated coverage includes responsive layouts, calculation parity, offline PWA update/reload, atomic restore failures and multi-window guards.

# v2026.10.25.14

- Monthly review marks, valuations, planning and payment checks sync across devices with durable offline operations and explicit same-item conflicts.
- Automatically posted contributions show unverified/paid status. Edit amount opens the established correction editor; payment confirmation never posts another contribution.
- A successful direct form save clears only unchanged drafts from that form and retains unrelated work.
- New Firestore review rules are tested with owner/editor/viewer and concurrent SDK transactions. CI deploys rules before Hosting.
- Validation: 44 unit suites, 129 browser checks, 9 installed-PWA checks, 6 focused edit/sync/draft checks, and Firestore emulator security/concurrency/reset checks passed locally. Browser fixtures use synthetic data and an adapter; rules checks use the real SDK and emulator.

# v2026.10.24.5

- Current page renders first at startup. Other workspaces prepare one group at a time during browser idle time; navigating early renders the needed group immediately.
- Growth projections calculate when opened instead of on every reload. Removed duplicate startup portfolio drawing and drawing dashboard insights before data loads.
- Local data and pending-sync reads start together. Full owner sessions skip unnecessary permission button scans; viewer/editor restrictions remain unchanged.
- Table sorting observes relevant table changes rather than every page mutation.
- Optional App info metadata is validated before Settings builds, preventing the supplied non-iterable-sections startup failure. Complete guide retained.
- CSS places the profile selector left in Modern desktop/mobile; no DOM relocation.
- All v.7 financial engines, cloud and family authorization code retained. No new periodic timers or network requests. This targets rendering; it does not bypass authentication or cloud loading.
