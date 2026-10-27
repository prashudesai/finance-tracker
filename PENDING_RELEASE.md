# Release 2026.10.27.4

- Align investment and retirement card headings and Add controls on mobile.
- Use compact icon-led empty states based on Option A.

- Move Obsidian Black into the Appearance style choices, preserving saved selections.

- Compact the mobile Debt overview, align Loan Summary with Add Loan, and refresh the empty state.

- Align the Settings Sync now icon and label inside the button.

- Use the Google profile photo in the header by default; custom photos override it.

- Shorten the header title to My finances.

- Show teal chevrons on native select controls and a muted teal calendar icon on date inputs.

- Default new income and expense dates to today, and restore today after each saved entry.

- Move the Cash Flow accent bar onto the Income & Expenses heading and add spacing between the bar and title.

- Use a single rounded, softly glowing hero card around the copy and three-arch graphic, following the supplied visual reference.

- Make the top cash-flow month pill open the glass popover and filter all three summary totals and both history tables on desktop and mobile.

- Color Add Income mint and Add Expense coral, with compact matching button padding.

Deployment is through the main-branch GitHub Actions workflow. It runs the full test, Firestore rules, and Hosting checks before publishing. No Functions changes are included.
