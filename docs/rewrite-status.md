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
| Analysis & Planning | Analytics, Income, Growth Projection, Goal planning and Date range reports tabs. Called Planning in the phone tab bar   |
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
- Goals: named goals (education, house, retirement, wedding, car, emergency fund, vacation or custom) saved in the `goals` collection. A goal stores only its plan: the cost in today's rupees, the date, inflation, an optional expected return and the share of each holding set aside for it. Progress, the inflated cost, the projected value, the extra needed each month and the month it's reached are worked out by `domain/goals.ts` from the holdings' current values and planned monthly amounts. Without a chosen return it uses 7%, 9% or 11% by how far away the goal is (6% for an emergency fund). Retirement and emergency fund suggest a target from recorded spending. Goals have their own page, Planning › Goal planning (`/analytics/goals`), next to Growth Projection. Older `/investments?view=goals` links land there. Each goal has a what-if that changes nothing saved, a dashboard tile, insights for the goal furthest behind and a funded goal, and a celebration when a goal passes 25%, 50%, 75% or 100% during a visit. Goals for one person follow the selected profile; household goals always show.
- Retirement planner, at the top of Planning › Goal planning: `domain/retirement.ts` steps month by month from today's fund (all investments, or PF, PPF and NPS only), adding savings contributions, rising by a yearly step-up, until the retirement age, then paying monthly spending that rises with inflation, with separate growth rates before and after retiring (10% and 10% to start, the second for a mix of equity and safe debt). A "What you'll need" check uses 6% inflation and 10% growth before and after, or the plan's own rates where they're more cautious, so it is never rosier than the plan and its "on course for" matches the headline then: the fund needed at retirement for today's spending to last the plan, what the plan is on course for, and the monthly investing, rising by the step-up, that gets there. It says the fund at retirement, the monthly spend then, and the age the money runs out or what's left at the end of the plan. When it runs out, it gives three separate fixes: extra each month until retiring, a later retirement age, or a lower monthly spend in today's rupees. Ages come from a date of birth and a retirement date (the 60th birthday unless another is picked), each shown with the age it means. The plan runs month by month from today, since today's fund already holds everything put in so far, and retires in the month of the retirement date. Two charts, by year of age from the plan's month-by-month figures: the fund at the end of each year, with the retirement line labelled; and yearly spending after retiring, with the age it passes what the fund makes and the fund starts to shrink. They sit side by side on wide screens. The year-by-year table runs by financial year (the rest of this one, then April to March), split at the retirement month with a milestone row. The assumptions are saved in settings, while the fund, spending and contributions come from records each time.
- After retiring, the planner either grows the whole fund at one rate or takes each investment group (PF, PPF and NPS as one each) on its own, saved as `retirement.afterMode` and `retirement.after`: it grows at its own rate, pays income while keeping its value, either a yearly percentage of its value or a fixed amount paid each month, quarter or year (`payoutFixed`, spread evenly over its months and paid in full while what it held at retirement is kept, in part once some is sold), or both, can be marked as not sellable, and can move a share into an income investment at retirement. Each month payouts pay spending first; a shortfall sells what pays nothing, then what grows and pays, then what only pays, and a surplus is reinvested in what grows. Contributions until retiring are split by each group's share of savings contributions. "What you'll need" keeps the mix at retirement and each investment's own rates after it.
- EMI reminders in Needs attention (due today or tomorrow, until that month's EMI is recorded) have Mark as paid, which records the EMI at the loan's own quote on its due date or today if earlier, and Hide this month, kept on the device as `emiRemindersHidden`. An EMI whose due date passed with nothing recorded, last month's, or this month's on its last day, shows as not recorded from when the loan's EMIs began and tracking started (`missedEmis`), and can only be marked as paid, not hidden.
- Insights: the dashboard shows ten a day (`dailyInsights`): warnings scored 60 or more first, then a weighted draw from the rest, seeded by the date and each insight's id, so the picks hold all day on every device and change each morning, and See all lists every one. Eleven more kinds: months of spending the bank balance covers, regular payments over a year, market investments without a value for 45 days, the financial year's best and worst saving months, spending by family member, PPF room left (₹1.5 lakh an account), months in a row keeping 30% or more, the month the last loan is paid off, everyday spending a day against the 30 days before, no-spend days, and what the leftover each month would grow to by retirement at 10%.
- The dashboard's income chart shows six months on every screen, from when tracking began. On wide screens it sits beside the investment portfolio, half and half, with a pie of where the last complete month's income went: spending, EMIs, invested and left in the bank.
- Gratuity estimates open in a dialog from their card, showing basic salary and joining date, with Edit (basic salary changes over the years) and Delete, which asks first.
- Data health, a Settings tile (`domain/health.ts`): months without an opening balance once balances are in use, months whose closing balance is over ₹1,000 above the expected one, market investments without a value for 45 days, loans whose history doesn't replay, and records left from a deleted investment or loan, which it can remove. Each item links to where it's fixed.
- Repeating expenses (`domain/repeating.ts`), shown in Upcoming commitments: a category and description paid once a month, within 5% of its usual amount and 5 days of its usual day, in 3 of the last 4 complete months, and not on a schedule. Make recurring creates the schedule from the month after the latest one recorded; Not regular is remembered on the device.
- Year at a glance (`domain/yearSummary.ts`), in Date range reports when a whole financial year is chosen: income, spending with unrecorded and EMIs, investing from income, savings rate, net worth from the year's start, best and lowest months, the top three recorded categories, and PPF and NPS paid in, with a PDF.
- The built page preloads the Firebase chunk, so it downloads alongside the app instead of after it: on slow 4G it finished about 0.7 s sooner.
- Browser tests check the unrecorded-expense rules through review and a forgotten expense (`e2e/money.spec.ts`), and run axe's WCAG 2.1 AA checks on every page in both themes (`e2e/accessibility.spec.ts`). Date fields show the focus ring, and the privacy animation's later steps stay readable.
- Income analysis, its own tab at Planning › Income (`/analytics/income`), for the chosen financial year: `domain/income.ts` works out salary against other income a month (salary is any source with salary or pay in its name, unless sources are chosen, saved as `salarySources`), each source's monthly average and how many of the last 12 months it came, salary each month with raises (a rise of 2% or more that holds the next month), yearly salary growth over a year or more, this year against the same months last year by source, each member's salary and other income, how steady income is, where each ₹100 goes (spending, EMIs, savings contributions, left in the bank) and the savings rate each month. Months count from the financial year's start, or when tracking began, to the last complete month. Six matching insights reach the dashboard: income mix, a raise in the last six months, income against last year (3% or more), the top earner with two or more, steadiness and where each ₹100 goes.
- Lists that compare investments (a goal's funding, its Funded from list, and Analytics › Investment returns) merge accounts of one category into one row through `holdingGroups`, such as "PF · 2 accounts", with XIRR across them; a share given to a group is saved against each account. Lists of single accounts use `holdingLabel`, such as "PF · 100281757735".
- Goal and planner headline figures use `formatAmount`: rupees under ₹1 lakh, then lakhs and crores, such as ₹15.12L and ₹4.81 Cr.
- The older app's portfolio goal planner was removed: a portfolio target goal does the same job, with an optional date, actual investing pace and loans counted.
- Portfolio target: a goal kind that follows net worth (or all investments) instead of a share of holdings. Its date is optional; without one, it predicts the month it's reached from the savings contributions average, the same figure as the dashboard's tile (`averageContributions`: this financial year's contributions over the months with any, counted from the first month with income or spending recorded, with withdrawals not taken off), loan principal repaid each month (net worth only) and 8% growth unless another return is chosen. Money left after spending but not invested stays in the bank, which net worth doesn't count, so it isn't added; the detail and the insight say how much sooner investing it would get there. An insight on the dashboard says when, with each figure under Why?.
- Yearly budget at Planning › Future › Yearly budget (`/analytics/budget`, `domain/budget.ts`), one `budgets/fy-YYYY` record per financial year holding only the plan: lines paid every month, in chosen months (yearly is one month) or once, each optionally counting one expense category, and a kids count (0–4) that adds or removes a school fees line per kid. With no saved plan, a starter list is offered, filled from the last 12 complete months where only one line draws on a category, rounded to ₹100. Progress is worked out: set aside a month (a twelfth), heavy months (over 5% above that), spent against what's due by today, lines over pace (by more than ₹1,000 or 5%), payments in chosen months counted paid at 90% of the amount in that category and month, spending no line covers, and left to invest: the year's income as the family plans it, entered for a month or the year and stored yearly on the budget (never taken from recorded income), less the plan and EMIs (paid so far, then the current EMI each month left). Income is optional: with none planned, the Income vs budget card is marked Optional and offers to add it; with it, a bar and rows show the budget, EMIs and what's left as shares of income, and Budget only clears it. Unpaid payments due this month or next show in Needs attention. Copy to next year raises amounts by a chosen percent, school fees by their own, rounded to ₹100. EMIs and unrecorded house expenses don't count as budget spending.
- Planning has two sections, Insights (Analytics, Income, Date range reports) and Future (Growth projection, Goal planning, Yearly budget), each with its own tabs.
- Privacy page at `/privacy`, open without signing in and linked from sign-in and Settings. New accounts agree to it once at setup, and existing accounts aren't asked. Its statements must stay true, so update it when what's stored or visible changes.

## Verified on the test project

Checked by hand on https://finance-trackerp.web.app, with real accounts: Google sign-in, saving records, syncing between computer and phone, offline changes on a phone, and family invites with viewer limits.

## Not verified

- Saved device approval between two real devices, including with Face ID.
- Removing a family member, changing a member's access, and deleting an account, on real Firebase.
- Playwright tests in `e2e/` cover every page fitting the screen, adding income, a withdrawal, quick setup and the privacy animation, at phone and desktop widths, on sample data. PWA behaviour was checked with throwaway browser scripts.
- Styled dropdown menus need a recent Chromium browser. Others show the native list.
- Screen readers need checking on real devices. Automated checks (axe, keyboard focus and dialogs) pass on every page.

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
- A month's calculated balance takes off everything invested from income, PMS and PPF included, where the older app took off Stallion PMS alone. PF and NPS come out of salary before it's paid, so they stay out. The balance history shows that as an Invested from income column in place of Stallion PMS and NPS + PPF. Review signatures keep the older formula, so months already reviewed aren't marked as changed.
- Unrecorded house expense, what a closing balance falls short of the calculated one, counts as spending: `houseExpenses` adds it as a derived expense on the month's last day, worked out from the balances each time and never saved, through `useSpendingView` and `useSpendingHousehold` on the dashboard, Analytics, Income, reports, insights, goals and the retirement planner. Screens that list, edit or close records read the plain records. A closing balance above the calculated one adds nothing. Marking a month reviewed saves its house expense as a real expense, `unrecorded-YYYY-MM` on the month's last day, so it shows in the expense list; reviewing again after its figures change updates or removes it. The month close, the available balance and the review signature leave both the worked-out and the saved figure out, so reviewing changes none of them. Spending always counts the figure worked out from the balances as they are now, in place of the saved entry, so a forgotten expense or a corrected balance after review is never counted twice. The dashboard's Monthly Expenses and the Cash flow page show recorded and unrecorded the same before and after review; Cash flow lists the saved entry with the other records.
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
