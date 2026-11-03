import { emptyTrackerData } from '../data/repository';
import { searchRecords } from './search';

const income = (id: string, source: string, amount: number, date = '2026-01-01') => ({
  id,
  date,
  member: 'Sam',
  source,
  amount,
});

const data = {
  ...emptyTrackerData(),
  income: [income('a', 'Salary', 25_000), income('b', 'Bonus', 9000, '2026-02-01')],
  expenses: [
    {
      id: 'c',
      date: '2026-01-05',
      category: 'Groceries',
      subcategory: '',
      amount: 500,
      isAnnual: false,
    },
  ],
};
const search = (query: string, kind: Parameters<typeof searchRecords>[2] = 'all') =>
  searchRecords(data, query, kind, '2026-03-01');

test('short queries find nothing', () => {
  expect(search('s').total).toBe(0);
});

test('amounts match with or without Indian formatting', () => {
  expect(search('25000').results[0]?.id).toBe('a');
  expect(search('₹25,000').results[0]?.id).toBe('a');
});

test('every term must match', () => {
  expect(search('salary sam').total).toBe(1);
  expect(search('salary jo').total).toBe(0);
});

test('the kind filter narrows results and newest comes first', () => {
  expect(search('sam').results.map((row) => row.id)).toEqual(['b', 'a']);
  expect(search('2026', 'expense').results.map((row) => row.id)).toEqual(['c']);
});

test('results are capped while the total stays complete', () => {
  const many = {
    ...data,
    income: Array.from({ length: 50 }, (_, index) => income(`i${index}`, 'Salary', 100)),
  };
  const found = searchRecords(many, 'salary', 'all', '2026-03-01');
  expect(found.total).toBe(50);
  expect(found.results).toHaveLength(40);
});
