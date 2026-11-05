# Status

Last updated 2026-11-05. The app is live at https://finance-trackerp.web.app. The older app remains at its own address, in its own Firebase project.

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
| Planning            | Goals, a portfolio target and planned changes                                                                           |
| Data layer          | Firestore repository tested on the emulator with the real rules                                                         |
| Security rules      | Written for all collections and tested on the emulator                                                                  |
| Change log          | Saved changes with who made them, and undo that refuses to overwrite later edits                                        |
| Family              | One form adds a name, with an optional invite. Change access and remove members. Dropdowns hide with one member         |
| Forms               | Old fields, lists and + Add new… options, including tenure-based EMI                                                    |
| Exports             | CSV, print, and generated PDFs for reports and loan history                                                             |
| Onboarding          | Quick setup opens each form in place, including appearance, then an app tour                                            |
| Themes              | All eight colour themes from the older app, in light and dark, contrast-tested                                          |
| Retirement detail   | Interest credits and EPS history                                                                                        |
| Phone layouts       | Title-only headers, full-screen entry forms, and Investments and Retirement tabs                                        |
| PWA                 | Installable, app shell works offline, check for updates, updates wait for acceptance, security policy applied           |

- Features page at `/features`, public, for sharing the app. Keep it in step with what the app does.
- Send feedback, in Settings › App info, as a feature suggestion or a problem report. Feedback can only be added, holds no name or email, and is read in the Firebase console under `feedback`.
- First login opens with "We know what you're thinking.": people type something private and see it locked for real with a throwaway key (`createDemoLock`), then opened again as family would. Nothing typed is saved. The same box is on the privacy page.
- Installing: an animated guide for iPhone, Android and computers. A dashboard card offers it once after setup until the app is installed or set aside, phones get a reminder bar a week after Not now, and Settings › App & updates always has How to install. What was set aside is kept on each device.
- Sharing and install: link previews (`og-image.png`, and per-page HTML for `/features` and `/privacy` written at build), an install pop-up with a description and screenshots, long-press shortcuts (`?add=` opens a form), a one-colour icon for Android themed icons, and iPhone launch screens. Screenshots and previews use the sample family.
- Hide amounts: the eye in the header masks every figure the screen formats, kept per device. Exports format their own figures, so they're never hidden.
- Dashboard greeting, a celebration when a loan seen owing this visit is paid off, page transitions where the browser supports them, and a light buzz on Android when saving.
- Share invite for invited or pending family, and Share the app for friends, through the phone's share menu or by copying.
- Insights and monthly recap: `domain/insights.ts` finds patterns (a category well above its usual, savings rate, EMI load, a prepayment's saving, net worth change or milestone, allocation shift, recurring total, weekend spending, a quiet week, a payment due soon) and `domain/recap.ts` sums a month. Both run on the device from records only; wording is in `features/insights`, so hidden amounts stay hidden. The dashboard shows them in a tile that opens on a tap, with the top one as a preview, and offers last month's recap for the first ten days of a month. A running month isn't compared with the one before.
- Goals: named goals (education, house, retirement, wedding, car, emergency fund, vacation or custom) saved in the `goals` collection. A goal stores only its plan: the cost in today's rupees, the date, inflation, an optional expected return and the share of each holding set aside for it. Progress, the inflated cost, the projected value, the extra needed each month and the month it's reached are worked out by `domain/goals.ts` from the holdings' current values and planned monthly amounts. Without a chosen return it uses 7%, 9% or 11% by how far away the goal is (6% for an emergency fund). Retirement and emergency fund suggest a target from recorded spending. Goals have their own page, Reports › Goal planning (`/analytics/goals`), next to Growth Projection. Older `/investments?view=goals` links land there. Each goal has a what-if that changes nothing saved, a dashboard tile, insights for the goal furthest behind and a funded goal, and a celebration when a goal passes 25%, 50%, 75% or 100% during a visit. Goals for one person follow the selected profile; household goals always show.
- The older app's portfolio goal planner was removed: a portfolio target goal does the same job, with an optional date, actual investing pace and loans counted.
- Portfolio target: a goal kind that follows net worth (or all investments) instead of a share of holdings. Its date is optional; without one, it predicts the month it's reached from what's invested each month on average (contributions less withdrawals) over up to six recent complete months since tracking began, the first month with income or spending recorded, counting only months with income or spending so investments entered for earlier months don't inflate it, loan principal repaid each month (net worth only) and 8% growth unless another return is chosen. Money left after spending but not invested stays in the bank, which net worth doesn't count, so it isn't added; the detail and the insight say how much sooner investing it would get there. An insight on the dashboard says when, with each figure under Why?.
- Privacy page at `/privacy`, open without signing in and linked from sign-in and Settings. New accounts agree to it once at setup, and existing accounts aren't asked. Its statements must stay true, so update it when what's stored or visible changes.

## Verified on the test project

Checked by hand on https://finance-trackerp.web.app, with real accounts: Google sign-in, saving records, syncing between computer and phone, offline changes on a phone, and family invites with viewer limits.

## Not verified

- Saved device approval between two real devices, including with Face ID.
- Removing a family member, changing a member's access, and deleting an account, on real Firebase.
- Playwright tests in `e2e/` cover every page fitting the screen, adding income, a withdrawal, quick setup and the privacy animation, at phone and desktop widths, on sample data. PWA behaviour was checked with throwaway browser scripts.
- Styled dropdown menus need a recent Chromium browser. Others show the native list.
- Screen readers need checking on real devices.

## Remaining

### Features

A scripted comparison of the visible text on every old page, at phone and desktop widths, found no remaining gaps. It didn't cover what's inside dialogs and forms. The older app's retirement tables are shown as cards here, so those accounts can't be sorted, and the loan table scrolls sideways on phones.

### Platform

- [ ] Bundle budgets, and more code splitting (the Firebase chunk is about 187 KB gzipped)
- [x] Playwright tests at phone and desktop widths

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
- Investments can record withdrawals, which the older app didn't have. Each is saved with a valuation of what's left on the same date. The invested amount goes down by average cost, the same share as the value taken out, and the rest of what was received is booked profit, shown on the holding and by financial year. Returns count the money received. PF, PPF and NPS work the same way, and a PF withdrawal leaves the EPS balance as it is.
- Dated restore points are replaced by the change log, which undoes single changes. A whole-tracker rollback uses a backup.
- Archiving was removed, so deleting is the only way to retire an account.
- Records are end-to-end encrypted, as a new design. See [encryption.md](encryption.md).
- Net worth history is worked out from records, with no stored snapshots. Months where a market holding has no value update are marked as estimates.
- Growth Projection follows the older app's layout at both widths, from one view.
- The balance history's NPS + PPF column shows contributions recorded that month, not the older app's scheduled amount.
- The change log is shared across the family, and changes of more than 50 records keep a summary only.
- History rows open a modal with Edit and Delete, in place of an Actions column. Phones show only the key columns.
- The dashboard's "What changed" tile was removed. Contributions, principal repaid and PMS gain change this month became insights, and its spending comparison was dropped, because it compared a running month with a whole one.
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
