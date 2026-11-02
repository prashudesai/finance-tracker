import type { TrackerData } from '../data/repository';
import { categoryOf, isEmi } from './analytics';
import { summarizeLoans } from './summary';

export const SEARCH_KINDS = [
  { value: 'all', label: 'All records' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'investment', label: 'Investment' },
  { value: 'debt', label: 'Debt' },
] as const;

export type SearchKind = (typeof SEARCH_KINDS)[number]['value'];

export interface SearchResult {
  id: string;
  kind: Exclude<SearchKind, 'all'>;
  title: string;
  detail: string;
  amount: number;
  date: string;
  path: string;
  /** Tells the destination page which record to open. */
  state: SearchTarget;
}

export type SearchTarget =
  | { found: { kind: 'income' | 'expense'; id: string; month: string } }
  | { open: string }
  | { loan: string };

const MIN_QUERY_LENGTH = 2;
export const SEARCH_LIMIT = 40;

/** Drops the rupee sign and commas, so 25,000 and ₹25000 both find 25000. */
const normalize = (value: string | number | undefined) =>
  String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[₹,]/g, '')
    .trim();

/** Every search term must match. Results are newest first, capped, with the full count. */
export function searchRecords(data: TrackerData, query: string, kind: SearchKind, today: string) {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (normalize(query).length < MIN_QUERY_LENGTH) return { total: 0, results: [] };

  const candidates: (SearchResult & { fields: (string | number | undefined)[] })[] = [
    ...data.income.map((row) => ({
      id: row.id,
      kind: 'income' as const,
      title: row.source,
      detail: row.member,
      amount: row.amount,
      date: row.date,
      path: '/cash-flow',
      state: { found: { kind: 'income' as const, id: row.id, month: row.date.slice(0, 7) } },
      fields: [row.member, row.source, row.notes, row.date, row.amount, 'income'],
    })),
    ...data.expenses.map((row) => ({
      id: row.id,
      kind: 'expense' as const,
      title: row.subcategory || row.category,
      detail: isEmi(row) ? 'Loan repayment' : row.category,
      amount: row.amount,
      date: row.date,
      path: '/cash-flow',
      state: { found: { kind: 'expense' as const, id: row.id, month: row.date.slice(0, 7) } },
      fields: [row.category, row.subcategory, row.notes, row.date, row.amount, 'expense'],
    })),
    ...data.holdings.map((row) => ({
      id: row.id,
      kind: 'investment' as const,
      title: row.name,
      detail: `${categoryOf(row)} · ${row.member}`,
      amount: row.openingInvested,
      date: row.date,
      path: '/investments',
      state: { open: categoryOf(row) },
      fields: [
        row.name,
        row.type,
        row.member,
        row.notes,
        row.date,
        row.openingInvested,
        'investment',
      ],
    })),
    ...summarizeLoans(data, today).map((row) => ({
      id: row.id,
      kind: 'debt' as const,
      title: row.type,
      detail: row.member,
      amount: row.ledger?.remaining ?? 0,
      date: data.loans.find((loan) => loan.id === row.id)?.date ?? '',
      path: '/debts',
      state: { loan: row.id },
      fields: [row.type, row.member, row.ledger?.remaining, row.ledger?.emi, 'debt', 'loan'],
    })),
  ];

  const matches = candidates
    .filter((row) => kind === 'all' || row.kind === kind)
    .filter((row) => {
      const text = row.fields.map(normalize).join(' ');
      return terms.every((term) => text.includes(term));
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));

  return {
    total: matches.length,
    results: matches.slice(0, SEARCH_LIMIT) as SearchResult[],
  };
}
