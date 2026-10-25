# Emerald Flow workspace layout

Select **Settings → Appearance → Page style → Style 3 · Emerald Flow**.
The choice is saved per account on this device. Light and dark modes both work.

This layout builds separate workspaces for the dashboard, income and expenses,
investments, debts, analytics, projections, reports, and Settings. It moves the
existing working controls rather than copying records or duplicating forms.
Switching to Modern or Classic restores those controls to their original pages.

The dashboard includes grouped income/expense bars with keyboard and tap details,
horizontal allocation bars, portfolio comparison, debt summary and monthly context.
Income and expenses, investments, and analytics use focused workspace tabs.

Validation for v2026.10.25.6: 36 unit suites and 115 browser checks passed locally.
Browser checks cover navigation, form saves, loan history, investment forms, reports,
style switching, light mode, and ten widths from 320 to 1598 pixels, including empty accounts, large balances, workspace tabs, settings dialogs and assumption dialogs.
The browser tests use synthetic records and local Firebase stubs.

To run the redesign browser checks:

```sh
npm install
npx playwright install chromium
npm run test:emerald
```

An existing Chromium executable can be selected with
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`.
