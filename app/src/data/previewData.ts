import { EMI_CATEGORY, type Expense, type Income, type Loan } from '../schema/records';
import { previousMonth } from '../domain/calendar';
import { localDate } from '../ui/format';
import type { TrackerData } from './repository';

const PREVIEW_MONTHS = 6;

const SPENDING: [category: string, amount: number][] = [
  ['Groceries', 18_400],
  ['Utilities', 6_200],
  ['Dining out', 7_800],
  ['Transport', 5_100],
  ['Health', 3_400],
  ['School fees', 12_000],
];

const loans: Loan[] = [
  {
    id: 'home',
    type: 'Home loan',
    member: 'Sam',
    date: '2024-06-05',
    principal: 1_850_000,
    openingRate: 8.65,
    openingEmi: 23_500,
    changes: [],
  },
  {
    id: 'car',
    type: 'Car loan',
    member: 'Alex',
    date: '2025-02-05',
    principal: 485_000,
    openingRate: 9.1,
    openingEmi: 11_200,
    changes: [],
  },
];

function expense(id: string, date: string, category: string, amount: number): Expense {
  return { id, date, category, subcategory: '', amount, isAnnual: false };
}

function emiPayments(loan: Loan, today: string) {
  const rows: Expense[] = [];
  for (let month = today.slice(0, 7); `${month}-05` > loan.date; month = previousMonth(month)) {
    if (`${month}-05` > today) continue;
    rows.push({
      ...expense(`emi-${loan.id}-${month}`, `${month}-05`, EMI_CATEGORY, loan.openingEmi),
      loanId: loan.id,
      repaymentType: 'emi',
    });
  }
  return rows;
}

/** Sample records for the local preview. Amounts vary by month so the trend reads naturally. */
export function previewData(): Partial<TrackerData> {
  const today = localDate();
  const current = today.slice(0, 7);
  const income: Income[] = [];
  const expenses: Expense[] = loans.flatMap((loan) => emiPayments(loan, today));

  let month = current;
  for (let index = 0; index < PREVIEW_MONTHS; index++, month = previousMonth(month)) {
    const swing = 1 + ((index * 37) % 23) / 100;
    income.push({
      id: `salary-${month}`,
      date: `${month}-01`,
      member: 'Sam',
      source: 'Salary',
      amount: 145_000,
    });
    income.push({
      id: `consulting-${month}`,
      date: `${month}-01`,
      member: 'Alex',
      source: 'Consulting',
      amount: 62_000 - index * 4_000,
    });
    SPENDING.forEach(([category, amount], position) => {
      expenses.push(
        expense(
          `${category.toLowerCase().replace(' ', '-')}-${month}`,
          `${month}-01`,
          category,
          Math.round((amount * swing) / 100) * 100 + position * 100,
        ),
      );
    });
  }

  return {
    income,
    expenses,
    loans,
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
        startMonth: current,
        paused: false,
        amountChanges: [],
      },
    ],
  };
}
