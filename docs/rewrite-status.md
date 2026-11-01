# Status

Last updated 2026-11-01. The app is live at https://finance-trackerp.web.app. The older app remains at its own address, in its own Firebase project.

## Done

All pages from the older app exist and follow its layouts.

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
| Themes | All eight colour themes from the older app, in light and dark, contrast-tested |
| Retirement detail | Interest credits, EPS history and statement checks |
| Phone layouts | Title-only headers, full-screen entry forms, and Investments and Retirement tabs |
| PWA | Installable, app shell works offline, check for updates, updates wait for acceptance, security policy applied |

## Verified on the test project

Checked by hand on https://finance-trackerp.web.app, with real accounts: Google sign-in, saving records, syncing between computer and phone, offline changes on a phone, and family invites with viewer limits.

## Not verified

- Removing a family member, and changing a member's access, on real Firebase.
- There are no Playwright tests in the repo yet. Main flows and PWA behaviour were checked with throwaway browser scripts.
- Styled dropdown menus need a recent Chromium browser. Others show the native list.
- Screen readers need checking on real devices.

## Remaining

### Features

The main features from the older app are built. These smaller details aren't yet:

- [ ] Cash flow: column sorting and filters in the history tables, and the balance explainers
- [ ] Analytics: View Details panels, the Family Split view and the fuller Investment Returns chart
- [ ] Settings: profile photo, account deletion, Sync now with sync details, and backup reminders

### Platform

- [ ] Bundle budgets, and more code splitting (the Firebase chunk is about 187 KB gzipped)
- [ ] Playwright tests at phone and desktop widths

## Decisions

- **Vault dropped.** The encrypted vault won't return.
- **Fresh start for data.** Existing data is throwaway, so there's no migration.
- **One document per record.** Replaces the chunked snapshot and custom sync.
- **Derived figures.** Loans and holdings store history only.
- **New address.** The app lives on `finance-trackerp`, so the older app and its data stay untouched at their old address.
- **The older app is the design template.** Pages keep its sections, order and labels.
- **Recovery generation, chunk verification and draft fixes not ported.** They guarded the snapshot format, which no longer exists.

## Deliberate differences from legacy

- A loan whose history can't be replayed shows an error on that loan. Legacy rejected the whole backup instead.
- Record EMI on the Loans screen always uses the ledger's quote, so the last instalment can't overpay.
- Loan and recurring validation is split between Zod schemas (one record) and domain validators (links between records).
- Holdings derive invested and current values from contributions and valuations, instead of keeping running totals.
- A contribution dated the same day as a valuation, or earlier, is treated as already included in that valuation.
- Dated restore points are replaced by the change log, which undoes single changes. A whole-tracker rollback uses a backup.
- The change log is shared across the family, and changes of more than 50 records keep a summary only.
- The app tour is a short walk through each page, not element-by-element highlights.
- PDFs use plain amounts marked INR, because the standard PDF fonts have no rupee sign.
- A restore larger than 400 writes is sent in batches, so an interrupted restore can be partial. Restoring the backup again fixes it.
- Scheduled contributions post once after records load, with fixed IDs, so two devices can't post the same month twice.
- The expenses series is amber, not rose, because rose fails the colour-blindness check against mint.
