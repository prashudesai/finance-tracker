# Rewrite status

Last updated 2026-11-01. The rewrite is on `rewrite/react-typescript` and isn't deployed, so the older app is still what runs in production.

## Done

All pages from the older app's navigation exist and follow its layouts.

| Area | State |
|---|---|
| Dashboard | Net worth, expense snapshot, monthly overview, income vs expenses, what changed, portfolio, debt summary, attention bar |
| Income & Expense | Month picker, totals, recurring commitments, add forms, history with edit and delete, monthly balances |
| Investment | Portfolio value, allocation, PMS, category cards, retirement accounts, gratuity, valuations, contributions |
| Debts | Loan table, add and edit, payments, part payments, rate changes, top-ups, revised EMIs, daily statements |
| Analytics & Reports | Analytics, Growth Projection and Date range reports tabs |
| Settings | App info, account, family access, appearance, custom values, data and backup, app and updates |
| Calculations | Loans, recurring, XIRR, gratuity and projections match legacy in seeded parity tests |
| Search | All records, following the selected family profile |
| Reviews | Month review, statement checks, record freshness and the attention list |
| Planning | Goal planner and planned changes |
| Data layer | Firestore repository tested on the emulator with the real rules |
| Security rules | Written for all collections and tested on the emulator |
| Change log | Saved changes with who made them, and undo that refuses to overwrite later edits |
| Family | Invite, change access and remove members |
| Exports | CSV, print, and generated PDFs for reports and loan history |
| Onboarding | Guided setup and an app tour |
| PWA | Installable, app shell works offline, updates wait for acceptance, security policy applied |

## Not verified

- Google sign-in and family management haven't run against real Firebase. The security policy allows the sign-in hosts, but no real sign-in has exercised it.
- Rules for `app/` aren't deployed, so sign-in against the real project would be refused data access.
- Offline data and queued writes are expected from Firestore's local cache, but only the app shell has been tested offline.
- There are no Playwright tests in the repo yet. Main flows and PWA behaviour were checked with throwaway browser scripts.
- Styled dropdown menus need a recent Chromium browser. Others show the native list.
- Phone keyboards and screen readers need checking on real devices.

## Remaining

### Features

All features from the older app are built, apart from the deliberate differences listed below.

### Platform

- [ ] Bundle budgets, and more code splitting (the Firebase chunk is about 187 KB gzipped)
- [ ] Playwright tests at phone and desktop widths

### Cutover

- [ ] Save the parity tests' legacy results as fixtures, because those tests read `dist/*.js` and `src/core`
- [ ] Deploy rules and the new app
- [ ] Promote `app/` to the repo root
- [ ] Delete `src/`, `dist/`, `tools/`, `tests/` and `docs/legacy/`

## Decisions

- **Vault dropped.** The encrypted vault won't return.
- **Fresh start for data.** Existing data is throwaway, so there's no migration.
- **One document per record.** Replaces the chunked snapshot and custom sync.
- **Derived figures.** Loans and holdings store history only.
- **The older app is the design template.** Pages keep its sections, order and labels.
- **Recovery generation, chunk verification and draft fixes not ported.** They guarded the snapshot format, which no longer exists.

## Deliberate differences from legacy

- A loan whose history can't be replayed shows an error on that loan. Legacy rejected the whole backup instead.
- Record EMI on the Loans screen always uses the ledger's quote, so the last instalment can't overpay.
- Loan and recurring validation is split between Zod schemas (one record) and domain validators (links between records).
- Holdings derive invested and current values from contributions and valuations, instead of keeping running totals.
- A contribution dated the same day as a valuation, or earlier, is treated as already included in that valuation.
- PF and PPF interest credits are recorded as a new valuation rather than a separate credit list.
- Dated restore points are replaced by the change log, which undoes single changes. A whole-tracker rollback uses a backup.
- The change log is shared across the family, and changes of more than 50 records keep a summary only.
- The app tour is a short walk through each page, not element-by-element highlights.
- PDFs use plain amounts marked INR, because the standard PDF fonts have no rupee sign.
- A restore larger than 400 writes is sent in batches, so an interrupted restore can be partial. Restoring the backup again fixes it.
- Scheduled contributions post once after records load, with fixed IDs, so two devices can't post the same month twice.
- The expenses series is amber, not rose, because rose fails the colour-blindness check against mint.
