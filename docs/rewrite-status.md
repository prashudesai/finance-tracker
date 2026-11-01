# Rewrite status

Last updated 2026-11-01. The rewrite is in progress and doesn't yet replace the older app.

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
| Security rules | Written for all collections, with 14 tests passing on the emulator |

## Not verified

- The Firestore repository, Google sign-in and invites haven't been run end to end. Tests and the preview use the in-memory repository.
- Rules for `app/` aren't deployed, so sign-in against the real project would be refused data access.
- Offline behaviour is expected from Firestore's local cache, but nothing tests it yet.
- There are no Playwright tests in the repo yet. Main flows were checked with a throwaway browser script.
- Styled dropdown menus need a recent Chromium browser. Others show the native list.

## Remaining

### Features still missing from the older app

- [ ] Record search
- [ ] Onboarding and guided tour
- [ ] Month review, statement checks and valuation freshness
- [ ] Portfolio goal planner
- [ ] Archived accounts, change log and restore points
- [ ] Loan fields for extra first-EMI interest and short first-period interest
- [ ] Recurring item editing and dated amount changes
- [ ] Removing family members from access, and shared payment confirmations
- [ ] Generated PDF exports (reports use the browser's print to PDF for now)
- [ ] Named tests from `tests/first-emi.cjs`, `tests/short-first-interest.cjs`, `tests/revised-emi.cjs` and `tests/sbi-daily.cjs`

### Platform

- [ ] PWA install and app shell caching, with a prompt before updating
- [ ] Content Security Policy and security headers
- [ ] Bundle budgets, and more code splitting (the Firebase chunk is about 187 KB gzipped)
- [ ] Playwright tests at phone and desktop widths
- [ ] CI for `app/`

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
- Scheduled contributions post once after records load, with fixed IDs, so two devices can't post the same month twice.
- The expenses series is amber, not rose, because rose fails the colour-blindness check against mint.
