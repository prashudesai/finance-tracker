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
