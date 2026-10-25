# Emerald Flow layout audit — v2026.10.25.6

| Area | Defect corrected |
| --- | --- |
| Growth Projection | Inherited named grid areas and a minimum-width settings grid caused overlapping controls and clipped scenario cards. Controls now occupy a full-width responsive section; forecast cards are separate. |
| Loan cards | Mobile table grid areas remained active in the new card layout. Fixed minimum table widths and a visually hidden heading row could extend the panel. |
| Report builder | The filter grid used automatic minimum track sizes that exceeded the narrow sidebar. |
| Portfolio totals | The horizontal totals strip could exceed its panel with large balances at tablet widths. |
| Cash-flow metrics | Large currency values could exceed a narrow metric card. Values now wrap within their containers. |

Browser audit: 115 checks passed using local Firebase stubs and synthetic records.
Covered Dashboard, Income & Expense, Investments, Debts, Analytics, Growth Projection,
Reports and Settings at 1598, 1440, 1280, 1024, 800, 768, 700, 600, 390 and 320 pixels.
Every workspace tab was inspected. Settings and assumption dialogs were inspected
at 1280 and 390 pixels. Empty accounts were checked at 1280 and 390 pixels.

Internal checks cover hidden text clipping, children outside their grids, overlapping
controls, forecast-card containment, horizontal overflow, and mobile navigation.
Decorative pseudo elements and intentional scrolling tables are excluded from hidden
clipping failures. Rendered projection screenshots were also inspected.
