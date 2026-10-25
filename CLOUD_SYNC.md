# Cloud changes and app updates

Cloud records save locally first. Pending saves upload immediately while connected and retry after roughly 2, 5, 15, 30, 60 and 120 seconds, with a small random spread. Offline devices wait for reconnection. Conflicts and access errors stop automatic overwrites.

A Firestore listener observes the small current-snapshot pointer while the app is visible and online. Another device's revision displays a notice; it never replaces records or unfinished inputs automatically. The notice offers an explicit reload when this device has no pending changes. A confirmation explains that unfinished entries will be cleared. When this device also has changes, the actions are read-only comparison and a device backup. Resolution remains manual; automatic merging is not enabled.

The listener disconnects when hidden or offline, reconnects on return, ignores this device's own mutation IDs, and retries transient listener failures with a capped delay. Account reset disposes the listener and status timer.

Service worker update checks also run on focus, visibility return and reconnection, at most once per five minutes. Applying an update still requires the existing explicit confirmation and local-save checks.

Validation: unit tests cover pointer revisions, own writes, hidden tabs, stale callbacks, transient recovery, permission errors and capped save retry delays. The browser audit includes a simulated remote revision while an input is unfinished, no forced reload, and pending-save protection, followed by the existing responsive and save checks.
