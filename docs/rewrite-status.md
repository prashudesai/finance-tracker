# Status

Last updated 2026-11-01. The app is live at https://finance-trackerp.web.app. The older app remains at its own address, in its own Firebase project.

## Done

All pages from the older app exist and follow its layouts.

| Area                | State                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Dashboard           | Net worth, expense snapshot, monthly overview, income vs expenses, what changed, portfolio, debt summary, attention bar |
| Income & Expense    | Month picker, totals, recurring commitments, add forms, history with edit and delete, monthly balances                  |
| Investment          | Portfolio value, allocation, PMS, category cards, retirement accounts, gratuity, valuations, contributions              |
| Debts               | Loan table, add and edit, payments, part payments, rate changes, top-ups, revised EMIs, daily statements                |
| Analytics & Reports | Analytics, Growth Projection and Date range reports tabs                                                                |
| Settings            | App info, account, family access, appearance, custom values, data and backup, app and updates                           |
| Calculations        | Loans, recurring, XIRR, gratuity and projections match legacy in seeded parity tests                                    |
| Search              | All records, following the selected family profile                                                                      |
| Reviews             | Month review, statement checks, record freshness and the attention list                                                 |
| Planning            | Goal planner and planned changes                                                                                        |
| Data layer          | Firestore repository tested on the emulator with the real rules                                                         |
| Security rules      | Written for all collections and tested on the emulator                                                                  |
| Change log          | Saved changes with who made them, and undo that refuses to overwrite later edits                                        |
| Family              | One form adds a name, with an optional invite. Change access and remove members. Dropdowns hide with one member         |
| Forms               | Old fields, lists and + Add new… options, including tenure-based EMI                                                    |
| Exports             | CSV, print, and generated PDFs for reports and loan history                                                             |
| Onboarding          | Guided setup and an app tour                                                                                            |
| Themes              | All eight colour themes from the older app, in light and dark, contrast-tested                                          |
| Retirement detail   | Interest credits and EPS history                                                                                        |
| Phone layouts       | Title-only headers, full-screen entry forms, and Investments and Retirement tabs                                        |
| PWA                 | Installable, app shell works offline, check for updates, updates wait for acceptance, security policy applied           |

- Features page at `/features`, public, for sharing the app. Keep it in step with what the app does.
- Send feedback, in Settings › App info, as a feature suggestion or a problem report. Feedback can only be added, holds no name or email, and is read in the Firebase console under `feedback`.
- Privacy page at `/privacy`, open without signing in and linked from sign-in and Settings. New accounts agree to it once at setup, and existing accounts aren't asked. Its statements must stay true, so update it when what's stored or visible changes.

## Verified on the test project

Checked by hand on https://finance-trackerp.web.app, with real accounts: Google sign-in, saving records, syncing between computer and phone, offline changes on a phone, and family invites with viewer limits.

## Not verified

- Saved device approval between two real devices, including with Face ID.
- Removing a family member, changing a member's access, and deleting an account, on real Firebase.
- There are no Playwright tests in the repo yet. Main flows and PWA behaviour were checked with throwaway browser scripts.
- Styled dropdown menus need a recent Chromium browser. Others show the native list.
- Screen readers need checking on real devices.

## Remaining

### Features

A scripted comparison of the visible text on every old page, at phone and desktop widths, found no remaining gaps. It didn't cover what's inside dialogs and forms. The older app's retirement tables are shown as cards here, so those accounts can't be sorted, and the loan table scrolls sideways on phones.

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
- A holding's value on a past date uses the newest valuation on or before that date. The first version of the rewrite always used the newest valuation, which made PMS gain change and the PMS trend wrong. This matches the older app's snapshots. A future-dated valuation doesn't count until its date.
- A contribution dated the same day as a valuation, or earlier, is treated as already included in that valuation.
- Investments can record withdrawals, which the older app didn't have. Each is saved with a valuation of what's left on the same date. The invested amount goes down by average cost, the same share as the value taken out, and the rest of what was received is booked profit, shown on the holding and by financial year. Returns count the money received. PF, PPF and NPS have no withdrawals yet.
- Dated restore points are replaced by the change log, which undoes single changes. A whole-tracker rollback uses a backup.
- Archiving was removed, so deleting is the only way to retire an account.
- Records are end-to-end encrypted, as a new design. See [encryption.md](encryption.md).
- Net worth history is worked out from records, with no stored snapshots. Months where a market holding has no value update are marked as estimates.
- Growth Projection follows the older app's layout at both widths, from one view.
- The balance history's NPS + PPF column shows contributions recorded that month, not the older app's scheduled amount.
- The change log is shared across the family, and changes of more than 50 records keep a summary only.
- History rows open a modal with Edit and Delete, in place of an Actions column. Phones show only the key columns.
- Search and sync status show only at the end of a page, and search sits in a modal, as in the older app.
- The profile photo comes from the Google account, in place of an upload.
- The app tour is a short walk through each page, not element-by-element highlights.
- PDFs use plain amounts marked INR, because the standard PDF fonts have no rupee sign.
- A restore larger than 400 writes is sent in batches, so an interrupted restore can be partial. Restoring the backup again fixes it.
- Scheduled contributions post once after records load, with fixed IDs, so two devices can't post the same month twice.
- The expenses series is amber, not rose, because rose fails the colour-blindness check against mint.
- A record posted by a recurring schedule stays in its month. Its day and amount can still be edited.
- Saving refuses a record that wouldn't pass its schema when read back, instead of storing it hidden.
- The loan form fills in principal and interest paid before tracking from the EMIs due since the first EMI date, as if each was paid on time, and shows the working. It counts up to today or the first payment recorded here, updates when the terms change, and stops once someone types their own figures. Daily-interest loans aren't estimated. Both boxes only show once an EMI is due, or when a saved loan already has figures. The older app always showed them, for people to fill in.
