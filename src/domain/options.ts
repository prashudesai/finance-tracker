import type { TrackerSettings } from '../schema/records';
import { PMS_TYPE } from '../schema/records';

export const INCOME_SOURCES = ['Salary', 'Bonus', 'Investments', 'Rental Income', 'Other'];
export const EXPENSE_CATEGORIES = [
  'Healthcare',
  'Entertainment',
  'Insurance',
  'Maintenance',
  'House Rent',
  'Vacation',
  'Education',
  'EMI Payment',
  'Other',
];
export const DEBT_TYPES = [
  'Home Loan',
  'Personal Loan',
  'Vehicle Loan',
  'Credit Card',
  'Gold Loan',
  'Gold Loan OD',
  'Other',
];
export const INVESTMENT_TYPES = ['Mutual Funds', 'Bonds', 'Fixed Deposits', PMS_TYPE];
export const NPS_SCHEMES = [
  'Active Choice Pension Fund',
  'Auto Choice Pension Fund',
  'Aggressive Tier I',
  'Aggressive Tier II',
  'Other',
];

export const EXPENSE_SUBCATEGORIES: Record<string, string[]> = {
  Insurance: ['Term insurance', 'Health insurance', 'Car insurance', 'Bike insurance', 'Any other'],
  Maintenance: ['Car', 'Bike', 'House', 'Any other'],
};

/** These categories usually repeat yearly, so the form starts them as annual. */
export const ANNUAL_BY_DEFAULT = ['Insurance', 'Maintenance', 'Vacation'];

const merged = (defaults: string[], custom: string[]) => [...new Set([...defaults, ...custom])];

export const optionLists = (settings: TrackerSettings) => ({
  incomeSources: merged(INCOME_SOURCES, settings.incomeSources),
  expenseCategories: merged(EXPENSE_CATEGORIES, settings.expenseCategories),
  debtTypes: merged(DEBT_TYPES, settings.debtTypes),
  investmentTypes: merged(INVESTMENT_TYPES, settings.investmentTypes),
  familyMembers: settings.familyMembers,
});
