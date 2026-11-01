# Data model

Record types are defined in `app/src/schema/records.ts`. That file is the source of truth, and this page explains the layout and the reasoning.

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

## Loans

A loan stores its start date, principal, opening rate, opening EMI and a list of dated changes. `rebuildLoan` replays those changes and the loan's payments in date order to produce the balance, current rate, current EMI, interest paid and the principal and interest split of each payment. Same-day order is changes, then part payments, then EMIs.

There are two calculation modes:

- **Monthly:** interest on the balance per EMI. A mid-cycle top-up or part payment weights interest by principal-days.
- **Daily (`dailyInterestBasis`):** interest accrues daily and joins the balance at month end. This needs an as-of date.

## Recurring schedules

`pendingOccurrences` lists what is due from the rules and existing occurrences. `applyOccurrences` returns new data without changing its input. It matches a suitable manual record if one exists, otherwise it posts a record with the ID `rec_<ruleId>_<yyyymm>`. EMI months must post in order, and each amount comes from the loan ledger's quote.

Deleting a rule with history archives it, so its records stay explained.

## Not modelled yet

Investments, NPS, PPF, PF, gratuity, PMS, projections, reviews and family member lists. See [rewrite-status.md](rewrite-status.md).
