# Compact dashboard attention

The dashboard shows a collapsed Needs attention section only when recorded data needs review. It groups items into at most four rows:

- Household months with recorded activity or an opening balance but missing required balances. The current month does not require a closing balance yet. The review opens the most recent incomplete month.
- Unverified valuations for the selected profile. Confirming an unchanged value and date clears its item. Changing the value invalidates that confirmation.
- This month's automatic entries in the selected profile that have not been checked against a statement on this device.
- Blocked cloud sync or a device save needing attention. Ordinary pending uploads and temporary offline state are not duplicated here.

Actions open existing review dialogs. Opening the list or a dialog does not change financial records. Review metadata remains account-scoped and device-only, matching the existing workbench. It is not a shared payment confirmation. No timers, polling or network reads are added; refreshes follow dashboard updates, navigation and review events.
