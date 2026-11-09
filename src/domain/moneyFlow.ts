import type { TrackerData } from '../data/repository';
import { isAnyHouseExpense, isRepayment } from './analytics';
import { roundMoney } from './calendar';

export interface FlowNode {
  key: string;
  label: string;
  amount: number;
}

export interface MoneyFlow {
  /** Where money came from: each income source, and the bank balance when more went out. */
  sources: FlowNode[];
  /** Everything in: income, plus any drawn from the bank balance. */
  total: number;
  /** Where it went, in a fixed order: spending, unrecorded, loan EMIs, invested, left. */
  outcomes: FlowNode[];
  /** Recorded spending by category, largest first, the smallest folded into Other. */
  categories: FlowNode[];
}

const CATEGORIES = 5;

/**
 * A month's money from where it came to where it went, for the Cash flow chart. It uses the
 * same figures as the month's summary: recorded spending without loan repayments, the
 * unrecorded house expense, repayments, what was invested from income, and what's left.
 */
export function moneyFlow(
  data: Pick<TrackerData, 'income' | 'expenses' | 'loans'>,
  month: string,
  { unrecorded, invested }: { unrecorded: number; invested: number },
): MoneyFlow {
  const inMonth = (row: { date: string }) => row.date.startsWith(month);
  const income = data.income.filter(inMonth);
  // Name the person only when more than one earned this month.
  const people = new Set(income.map((row) => row.member));
  const bySource = new Map<string, FlowNode>();
  for (const row of income) {
    const key = `${row.source}|${people.size > 1 ? row.member : ''}`;
    // First names keep labels short: "Salary · Alex".
    const person = row.member.split(' ')[0] ?? row.member;
    const label = people.size > 1 && person ? `${row.source} · ${person}` : row.source;
    const node = bySource.get(key) ?? { key: `in-${key}`, label, amount: 0 };
    node.amount += row.amount;
    bySource.set(key, node);
  }

  const expenses = data.expenses.filter((row) => inMonth(row) && !isAnyHouseExpense(row));
  const repaid = expenses
    .filter((row) => isRepayment(row, data.loans))
    .reduce((sum, row) => sum + row.amount, 0);
  const spending = expenses.filter((row) => !isRepayment(row, data.loans));
  const spent = spending.reduce((sum, row) => sum + row.amount, 0);

  const totalIn = income.reduce((sum, row) => sum + row.amount, 0);
  const totalOut = spent + unrecorded + repaid + invested;
  const left = totalIn - totalOut;

  const sources = [...bySource.values()]
    .map((node) => ({ ...node, amount: roundMoney(node.amount) }))
    .sort((a, b) => b.amount - a.amount);
  if (left < 0) {
    sources.push({ key: 'in-bank', label: 'From bank balance', amount: roundMoney(-left) });
  }

  const outcomes: FlowNode[] = [
    { key: 'spent', label: 'Spending', amount: spent },
    { key: 'unrecorded', label: 'Unrecorded', amount: unrecorded },
    { key: 'emis', label: 'Loan EMIs', amount: repaid },
    { key: 'invested', label: 'Invested', amount: invested },
    { key: 'left', label: 'Balance', amount: Math.max(0, left) },
  ]
    .map((node) => ({ ...node, amount: roundMoney(node.amount) }))
    .filter((node) => node.amount > 0);

  const byCategory = new Map<string, number>();
  for (const row of spending) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount);
  }
  const sorted = [...byCategory].sort((a, b) => b[1] - a[1]);
  const shown = sorted.length > CATEGORIES ? sorted.slice(0, CATEGORIES - 1) : sorted;
  const rest = sorted.slice(shown.length).reduce((sum, [, amount]) => sum + amount, 0);
  const categories = [
    ...shown.map(([label, amount]) => ({ key: `cat-${label}`, label, amount: roundMoney(amount) })),
    ...(rest > 0 ? [{ key: 'cat-other', label: 'Other', amount: roundMoney(rest) }] : []),
  ];

  return {
    sources,
    total: roundMoney(Math.max(totalIn, totalOut)),
    outcomes,
    categories,
  };
}
