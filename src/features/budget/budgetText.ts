import type { BudgetLine } from '../../schema/records';

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Calendar months in financial-year order, April to March. */
export const FY_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3];

export const GROUP_LABELS: Record<BudgetLine['group'], string> = {
  home: 'Home',
  insurance: 'Insurance',
  kids: 'Kids',
  health: 'Health',
  vehicles: 'Vehicles',
  lifestyle: 'Lifestyle',
  other: 'Other',
};

/** When a line is paid, in words: "Every month", "Jun", "Apr, Jul and Dec", "Once, in Oct". */
export function scheduleText(line: BudgetLine) {
  if (line.every === 'month') return 'Every month';
  const list = listText(line.months.map((month) => MONTH_NAMES[month - 1] ?? ''));
  return line.every === 'once' ? `Once, in ${list}` : `Every year in ${list}`;
}

/** Names in a sentence: "Milk", "Milk and Fruits", "Grocery, Milk and Fruits". */
export const listText = (names: string[]) =>
  names.length > 1
    ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
    : (names[0] ?? '');
