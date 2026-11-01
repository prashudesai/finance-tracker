# Architecture

Finance Tracker is a client-only app. The browser talks directly to Firebase Authentication and Firestore, and security rules enforce access. There is no application server, which is why the app uses Vite rather than a server-rendering framework like Next.js.

## Stack

| Concern | Choice |
|---|---|
| UI | React, TypeScript in strict mode |
| Build | Vite |
| Routing | React Router |
| Client state | Zustand |
| Validation and record types | Zod |
| Forms | React Hook Form |
| Backend | Firebase Auth and Firestore |
| Styling | CSS Modules and design tokens, Inter, Lucide icons |
| PWA | `vite-plugin-pwa`, app files only, updates wait for acceptance |
| Tests | Vitest, Testing Library, Firestore emulator |

## Layers

```text
features/<page>   Screens and forms
      |
store/tracker     Live data, commit, error state
      |
data/repository   TrackerRepository interface
      |
      +-- data/firestoreRepository  Firestore, used in the real app
      +-- data/memoryRepository     In-memory, used in tests and the preview

domain/   Pure calculations, usable from any layer
schema/   Zod record schemas, usable from any layer
```

## How data moves

1. Sign-in resolves the household: an accepted invite joins that household, otherwise the user owns their own.
2. `connect` subscribes to each collection. Rows are validated on the way in, and a record that fails validation is hidden and counted, so one bad document can't blank the app.
3. Screens read from the store and call domain functions to work out balances and totals.
4. An edit calls `commit` with a list of writes, which are applied together.
5. Firestore updates the local cache straight away, so the screen updates through the same subscription, online or offline. Queued writes upload on reconnection.

## Why it differs from the older app

The older app saved all data as one large chunked snapshot, with its own IndexedDB store, sync queue, digest checks, revision pointer and conflict screens. This design drops all of that:

| Older app | This app |
|---|---|
| Whole-state snapshot on every save | One document per record |
| Custom offline store and sync | Firestore's local cache |
| Conflicts on the whole tracker | Last write wins per record, so only edits to the same record compete |
| Cached loan balances, checked by validators | Balances always derived from history |
| Global `state`, about 400 shared functions | Typed modules with one-way dependencies |
| Accruals ran during rendering | Rendering never writes |
| Tests carved functions out of source text | Tests import modules directly |

**Trade-off:** when two people edit the same record while offline, the later write wins with no prompt. Records are small and edited rarely, so this is much less likely than the whole-tracker conflicts it replaces. Recurring runs use deterministic IDs, so two devices posting the same month produce one record.

## Security

- Firestore rules in `firestore.rules` are the access boundary, and every Firestore path is denied unless a rule allows it.
- A household's ID is its owner's UID.
- The owner creates an invite, and only the invited person can accept it. Without that step, anyone could push a stranger into their household.
- Editors and viewers get access only through an accepted membership. Viewers can't write.
- `firebase.json` sets a Content Security Policy for hosting.
- Rules can't validate record contents in depth, so schemas protect the client from bad rows rather than protecting the database from a hostile editor.
