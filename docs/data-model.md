# Data model

Record types are defined in `src/schema/records.ts`. That file is the source of truth, and this page explains the layout and the reasoning.

## Firestore layout

```text
memberships/{email}                   Invite: householdId, role, accepted
households/{ownerUid}/
  income/{id}
  expenses/{id}
  loans/{id}
  recurringRules/{id}
  recurringOccurrences/{ruleId_month}
  monthlyBalances/{month}
  holdings/{id}
  contributions/{id}
  valuations/{id}
  gratuityAccounts/{id}
  projectionAdjustments/{id}
  settings/tracker
  monthReviews/{id}
  changes/{id}
  interestCredits/{id}
  epsUpdates/{id}
  statementChecks/{id}
```

Email addresses in `memberships` are lowercase.

## Records

| Collection | Holds | Notes |
|---|---|---|
| `income` | Date, member, source, amount | |
| `expenses` | Date, category, amount | EMI and part payments are expenses with a `loanId` |
| `loans` | Opening terms and dated changes | Current figures are never stored |
| `recurringRules` | Monthly income, expense or EMI schedules | A rule's `kind` decides its fields |
| `recurringOccurrences` | What happened to a rule in a month | `posted`, `matched` or `skipped` |
| `monthlyBalances` | Opening household balance for a month | Next month's opening is this month's closing |
| `holdings` | Opening position of an investment, PF, PPF or NPS account | Current figures are never stored |
| `contributions` | Dated money added to a holding | Scheduled ones use `auto_<holdingId>_<yyyymm>` IDs |
| `valuations` | Dated value of a holding | The latest sets its current value |
| `gratuityAccounts` | Joining date and basic salary | The estimate is calculated |
| `projectionAdjustments` | Planned additions and withdrawals | |
| `settings` | Custom values and projection assumptions | One document, `tracker` |
| `monthReviews` | Months someone has reviewed | Holds a signature, so later changes ask for review again |
| `interestCredits` | Annual PF and PPF interest | One per account per financial year |
| `epsUpdates` | EPS balance corrections | Signed amounts |
| `statementChecks` | Balances compared with statements | Changes no money |
| `changes` | The change log | Newest 200, with earlier values for undo |

## Loans

A loan stores its start date, principal, opening rate, opening EMI and a list of dated changes. `rebuildLoan` replays those changes and the loan's payments in date order to produce the balance, current rate, current EMI, interest paid and the principal and interest split of each payment. Same-day order is changes, then part payments, then EMIs.

There are two calculation modes:

- **Monthly:** interest on the balance per EMI. A mid-cycle top-up or part payment weights interest by principal-days.
- **Daily (`dailyInterestBasis`):** interest accrues daily and joins the balance at month end. This needs an as-of date.

## Recurring schedules

`pendingOccurrences` lists what is due from the rules and existing occurrences. `applyOccurrences` returns new data without changing its input. It matches a suitable manual record if one exists, otherwise it posts a record with the ID `rec_<ruleId>_<yyyymm>`. EMI months must post in order, and each amount comes from the loan ledger's quote.

Deleting a rule with history archives it, so its records stay explained.

## Holdings

Invested is the opening amount plus contributions. Current is the latest valuation, or the opening value, plus contributions and interest dated after it. A removed scheduled contribution stays as a `skipped` record, so the schedule doesn't post it again.
