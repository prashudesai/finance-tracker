# Finance Tracker

A family finance PWA, mid-rewrite. All new work goes in `app/` (React, TypeScript, Vite, Firebase). `src/`, `dist/`, `tools/` and `tests/` are the legacy app.

Read [docs/rewrite-status.md](docs/rewrite-status.md) before starting a feature, and [docs/architecture.md](docs/architecture.md) before changing how data flows.

## Current situation

- Existing data is throwaway. Don't add migrations or compatibility with legacy formats.
- Legacy code is a reference only. Don't fix or extend it. It gets deleted once `app/` has parity.
- The encrypted vault was dropped on purpose. Don't restore it from git history.
- Nothing from `app/` is deployed. Its `firestore.rules` differ from the rules in production, so real sign-in won't work until they are deployed.

## Commands

Run from `app/`:

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
- `npm test` covers domain logic and UI. It reads `../dist/*.js` for the parity tests.
- `test:rules` runs against the Firestore emulator and needs Java 17 or later.

Before calling work done, run typecheck, lint, tests and build. Run `test:rules` too if `firestore.rules` changed. For UI changes, also check the running app at phone and desktop widths.

## Rules

**Layers.** Dependencies point one way: `features` → `store` → `data`, and anything may use `domain` and `schema`.

- `app/src/domain`: pure functions only, with no React, Firebase, DOM or current-time access. Pass `today` in.
- `app/src/schema`: Zod schemas are the single source of record types. Derive types with `z.infer`.
- `app/src/data`: the only place that touches Firestore, behind `TrackerRepository`.
- `app/src/features/<page>`: one folder per screen.
- `app/src/ui`: shared styles, formatting and small components.

**Store facts, derive the rest.** Never save a value that can be calculated. A loan stores opening terms and dated changes; balance, rate, EMI and interest always come from `rebuildLoan`. Don't add cached totals to a record.

**Rendering never writes.** Changes happen in event handlers through `commit`. Legacy accruals ran during render, and that must not come back.

**Don't lose user-visible failures.** When a domain function returns errors, show them. Use plain language in messages shown to users, not library defaults.

**Money and dates.** Dates are `YYYY-MM-DD` strings and months are `YYYY-MM`, compared as strings and calculated in UTC through `domain/calendar.ts`. Round money with `roundMoney`. Display with `formatMoney`.

**Styling.** Use CSS Modules and the tokens in `ui/tokens.css`, with no `!important`. Design for phone width first, with no horizontal page scroll. No inline event attributes or `innerHTML`.

**Design.** The brand is deep teal surfaces with mint accents, large rounded cards and the logo in `src/assets`. Compare new screens with the live app at https://finance-tracker-bc7c9.web.app and aim to beat it. Icons come from `lucide-react`. Lead each screen with its most useful number. Check both themes.

## Porting from legacy

1. Read the legacy code and its tests, and any spec in [docs/legacy/](docs/legacy/README.md).
2. Port the calculation into `domain/` as pure TypeScript.
3. Add unit tests, plus a seeded parity test against the legacy module where one can be loaded. See `domain/loan.test.ts`.
4. Confirm the parity test can fail by breaking the port on purpose, then restore it.
5. Build the screen, and update [docs/rewrite-status.md](docs/rewrite-status.md).

Financial results must match legacy exactly unless the difference is a deliberate fix recorded in the status doc.

## Version pins

- `typescript` stays on 6.x because `typescript-eslint` doesn't support 7 yet.
- `firebase-tools` stays on 13.x because 15 needs Java 21, and this machine and CI use Java 17.

## Git

Work happens on `rewrite/react-typescript`. Commit, push or deploy only when asked.
