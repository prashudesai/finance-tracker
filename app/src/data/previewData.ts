import { localDate } from '../ui/format';
import type { TrackerData } from './repository';

/** Sample records for the local preview. */
export function previewData(): Partial<TrackerData> {
  const today = localDate();
  const month = today.slice(0, 7);
  return {
    income: [
      {
        id: 'salary',
        date: `${month}-01`,
        member: 'Sam',
        source: 'Salary',
        amount: 180_000,
      },
    ],
    expenses: [
      {
        id: 'groceries',
        date: `${month}-01`,
        category: 'Groceries',
        subcategory: '',
        amount: 14_500,
        isAnnual: false,
      },
    ],
    loans: [
      {
        id: 'home',
        type: 'Home Loan',
        member: 'Sam',
        date: '2025-01-05',
        principal: 4_500_000,
        openingRate: 8.25,
        openingEmi: 42_000,
        changes: [],
      },
    ],
    recurringRules: [
      {
        id: 'rent',
        kind: 'expense',
        name: 'Rent',
        category: 'House Rent',
        subcategory: '',
        isAnnual: false,
        amount: 32_000,
        day: 1,
        startMonth: month,
        paused: false,
        amountChanges: [],
      },
    ],
  };
}
