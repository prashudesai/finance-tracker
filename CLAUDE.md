# Personal Finance Tracker

A family finance PWA built with React, TypeScript, Vite and Firebase, live at https://finance-trackerp.web.app.

Read [docs/rewrite-status.md](docs/rewrite-status.md) before starting a feature, and [docs/architecture.md](docs/architecture.md) before changing how data flows.

## Current situation

- This project is `finance-trackerp`, pinned in `.firebaserc`. The older app is a separate project, `finance-tracker-bc7c9`. Never deploy this repo to it.
- The older app's code was removed from this repo. It remains in git history, up to commit `d34c2af`.
- The older app's encrypted vault was dropped on purpose. Don't restore it from git history. Encryption today is the end-to-end design in [docs/encryption.md](docs/encryption.md).

## Commands

```bash
npm install --ignore-scripts
```

```bash
npm run dev:preview
```

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm test
```

```bash
npm run test:rules
```

```bash
npm run build
```

- `dev:preview` runs the app on sample in-memory data with no Firebase or sign-in, on port 5173. The sign-in screen is at `/signin`.
- `test:rules` covers the security rules and Firestore repository on the emulator, and needs Java 17 or later.

Before calling work done, run typecheck, lint, tests and build. Run `test:rules` too if `firestore.rules` or the data layer changed. For UI changes, also check the running app at phone and desktop widths.

## Rules

**Layers.** Dependencies point one way: `features` → `store` → `data`, and anything may use `domain` and `schema`.

- `src/domain`: pure functions only, with no React, Firebase, DOM or current-time access. Pass `today` in.
- `src/schema`: Zod schemas are the single source of record types. Derive types with `z.infer`.
- `src/data`: the only place that touches Firestore, behind `TrackerRepository`.
- Every record is encrypted on the device by `RecordCodec` in `src/data/crypto.ts`. Never write a readable record, and don't add a way to read one on the server. The security rules refuse them.
- `src/features/<page>`: one folder per screen.
- `src/ui`: shared styles, formatting and small components.

**Store facts, derive the rest.** Never save a value that can be calculated. A loan stores opening terms and dated changes, and a holding stores its opening position, contributions and valuations. Balances always come from `rebuildLoan` and `holdingPosition`. Don't add cached totals to a record.

**Rendering never writes.** Changes happen in event handlers through `commit`.

**Don't lose user-visible failures.** When a domain function returns errors, show them. Use plain language in messages shown to users, not library defaults.

**Money and dates.** Dates are `YYYY-MM-DD` strings and months are `YYYY-MM`, compared as strings and calculated in UTC through `domain/calendar.ts`. Round money with `roundMoney`. Display with `formatMoney`.

**Financial results.** `src/domain/reference` holds the older app's formulas, frozen, for parity tests. Don't edit it. A deliberate change to a calculation updates the tests and is recorded in the status doc. After porting or changing a calculation, confirm its test can fail by breaking the code on purpose, then restore it.

**Styling.** Use CSS Modules and the tokens in `ui/tokens.css`. Design for phone width first, with no horizontal page scroll. No inline event attributes or `innerHTML`. Dropdowns are styled once, in `ui/tokens.css`.

**Design.** The brand is deep teal surfaces with mint accents, large rounded cards and the logo in `src/assets`. Icons come from `lucide-react`. Lead each screen with its most useful number. Check both themes.

## Version pins

- `typescript` stays on 6.x because `typescript-eslint` doesn't support 7 yet.
- `firebase-tools` stays on 13.x because 15 needs Java 21, and this machine and CI use Java 17.

## Git

Commit, push or deploy only when asked.
