import type { TrackerSettings } from '../schema/records';
import { PMS_TYPE } from '../schema/records';

export const INCOME_SOURCES = [
  'Salary',
  'Bonus',
  'Rental income',
  'Dividends',
  'Interest',
  'Other',
];
export const EXPENSE_CATEGORIES = [
  'Groceries',
  'Healthcare',
  'House Rent',
  'Utilities',
  'Education',
  'Transport',
  'Insurance',
  'Dining out',
  'Entertainment',
  'Travel',
  'Other',
];
export const DEBT_TYPES = ['Home Loan', 'Vehicle Loan', 'Personal Loan', 'Education Loan', 'Other'];
export const INVESTMENT_TYPES = ['Mutual Funds', 'Bonds', 'Fixed Deposits', PMS_TYPE];

const merged = (defaults: string[], custom: string[]) => [...new Set([...defaults, ...custom])];

export const optionLists = (settings: TrackerSettings) => ({
  incomeSources: merged(INCOME_SOURCES, settings.incomeSources),
  expenseCategories: merged(EXPENSE_CATEGORIES, settings.expenseCategories),
  debtTypes: merged(DEBT_TYPES, settings.debtTypes),
  investmentTypes: merged(INVESTMENT_TYPES, settings.investmentTypes),
  familyMembers: settings.familyMembers,
});
