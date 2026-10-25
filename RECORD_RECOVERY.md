# Device restore points and explicit conflict resolution

Restore points are created before device records change, bounded to five snapshots and approximately 5 MB of JSON per account/browser. They are kept in the existing account-scoped IndexedDB records store. Clear all data clears restore history. These are device recovery points, not a replacement for exported backups.

Settings → Records → Restore points and cloud conflicts provides dated previews. Restoring requires owner permissions, revalidates the full candidate, checks the device revision and keeps the replaced records as another bounded restore point. Pending cloud conflicts are not bypassed by a normal restore.

Conflict resolution reads the cloud through a separate store, preserving the writer's revision until an explicit resolution. Every differing ID-based record or settings group requires a choice. Dependent records are validated together. Applying rebases the pending device snapshot to the inspected cloud revision; a subsequent concurrent cloud save is rejected by the existing revision transaction. There is no silent automatic merge.

Restore points are only available from changes after installing this release. Retention can be shorter for large snapshots. Only the owner can replace records; shared editors/viewers cannot use these operations.
