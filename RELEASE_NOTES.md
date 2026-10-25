# v2026.10.24.5

- Current page renders first at startup. Other workspaces prepare one group at a time during browser idle time; navigating early renders the needed group immediately.
- Growth projections calculate when opened instead of on every reload. Removed duplicate startup portfolio drawing and drawing dashboard insights before data loads.
- Local data and pending-sync reads start together. Full owner sessions skip unnecessary permission button scans; viewer/editor restrictions remain unchanged.
- Table sorting observes relevant table changes rather than every page mutation.
- Optional App info metadata is validated before Settings builds, preventing the supplied non-iterable-sections startup failure. Complete guide retained.
- CSS places the profile selector left in Modern desktop/mobile; no DOM relocation.
- All v.7 financial engines, cloud and family authorization code retained. No new periodic timers or network requests. This targets rendering; it does not bypass authentication or cloud loading.
