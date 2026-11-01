# Rewrite status

Last updated 2026-11-01. The rewrite is in progress and doesn't yet replace the older app.

## Done

| Area | State |
|---|---|
| Project setup | TypeScript, ESLint, Prettier, Vitest and build all pass |
| Loan ledger | Monthly and daily loans, quotes, statements. Parity with legacy across 3,000 seeded scenarios |
| Recurring schedules | Planning, posting, matching, stopping. Parity with legacy on sample schedules |
| Cash flow | Monthly totals and month close |
| Data layer | Repository interface, Firestore and in-memory implementations |
| Security rules | Written, with 13 tests passing on the emulator |
| App shell | Routing, responsive navigation, error and invalid-record notices |
| Screens | Dashboard, Income, Expenses, Loans (basic versions) |

## Not verified

- The Firestore repository and Google sign-in haven't been run end to end. Tests and the preview use the in-memory repository.
- Rules for `app/` aren't deployed, so sign-in against the real project would be refused data access.
- Offline behaviour is expected from Firestore's local cache, but nothing tests it yet.
- There are no Playwright tests yet. Screens were checked by hand at phone and desktop widths.

## Remaining

### Calculations and records

- [ ] Investments, including contributions and valuation checks (`src/core/07-investments.js`)
- [ ] NPS, PPF, PF and gratuity (`src/core/08-nps.js`, `09-ppf.js`, `10-pf.js`)
- [ ] PMS, then add its contributions to cash flow (`src/core/11-pms.js`)
- [ ] Scheduled contribution accruals, as explicit commands rather than during rendering
- [ ] Projections and goal planner (`src/core/15-projections.js`)
- [ ] Analytics and finance insights (`src/core/14-analytics.js`, `dist/finance-insights-model.js`)
- [ ] Attention items and review model (`dist/attention.js`, `dist/review-model.js`)
- [ ] First EMI and short first-period rules: port the expected values from `tests/first-emi.cjs`, `tests/short-first-interest.cjs`, `tests/revised-emi.cjs` and `tests/sbi-daily.cjs` as named tests

### Screens

- [ ] Loan details: changes, part payments, first EMI, statements, edit and delete
- [ ] Record editing for income and expenses, plus filters and pagination
- [ ] Recurring schedule management, including adding rules
- [ ] Family members and profile filtering
- [ ] Monthly balances and month close
- [ ] Investments and retirement accounts
- [ ] Analytics and Projections, with charts loaded on demand
- [ ] Monthly review
- [ ] Search
- [ ] Settings, appearance, invites and accepting an invite
- [ ] Onboarding and tour
- [ ] Backup, restore and PDF exports

### Platform

- [ ] PWA install and app shell caching, with a prompt before updating
- [ ] Content Security Policy and security headers
- [ ] Bundle budgets, and more code splitting (the Firebase chunk is about 187 KB gzipped)
- [ ] Playwright tests at phone and desktop widths
- [ ] CI for `app/`

### Cutover

- [ ] Save the parity tests' legacy results as fixtures, because those tests read `dist/*.js`
- [ ] Deploy rules and the new app
- [ ] Promote `app/` to the repo root
- [ ] Delete `src/`, `dist/`, `tools/`, `functions/`, `tests/` and `docs/legacy/`

## Decisions

- **Vault dropped.** The encrypted vault won't return.
- **Fresh start for data.** Existing data is throwaway, so there's no migration.
- **One document per record.** Replaces the chunked snapshot and custom sync.
- **Derived loan figures.** Loans store history only.
- **Recovery generation, chunk verification and draft fixes not ported.** They guarded the snapshot format, which no longer exists.

## Deliberate differences from legacy

- A loan whose history can't be replayed shows an error on that loan. Legacy rejected the whole backup instead.
- Record EMI on the Loans screen always uses the ledger's quote, so the last instalment can't overpay.
- Loan and recurring validation is split between Zod schemas (one record) and domain validators (links between records).
- `monthClose` doesn't include PMS contributions yet, so it isn't at parity until PMS is ported.
