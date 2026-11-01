import { emptyTrackerData, type TrackerData } from '../data/repository';
import type { Income } from '../schema/records';
import { buildChange, MAX_CHANGES, pruneWrites, undoWrites } from './changes';

const income = (id: string, amount: number): Income => ({
  id,
  date: '2026-01-01',
  member: 'A',
  source: 'Salary',
  amount,
});
const data = (rows: Income[] = []): TrackerData => ({ ...emptyTrackerData(), income: rows });
const meta = { id: 'c', at: '2026-01-01T00:00:00Z', actor: 'a@example.test' };
const set = (row: Income) =>
  ({ type: 'set', collection: 'income', id: row.id, value: row }) as const;

function change(state: TrackerData, writes: Parameters<typeof buildChange>[1]) {
  const result = buildChange(state, writes, meta);
  if (!result) throw new Error('Expected a change.');
  return result;
}

test('summaries say what happened', () => {
  const row = income('a', 5);
  expect(change(data(), [set(row)]).summary).toBe('Added income · Salary');
  expect(change(data([row]), [set({ ...row, amount: 6 })]).summary).toBe('Changed income · Salary');
  expect(change(data([row]), [{ type: 'delete', collection: 'income', id: 'a' }]).summary).toBe(
    'Deleted income · Salary',
  );
});

test('settings and log writes are not logged', () => {
  const writes = [{ type: 'set', collection: 'settings', id: 'tracker', value: {} }] as const;
  expect(buildChange(data(), [...writes], meta)).toBeNull();
});

test('undo removes an addition', () => {
  const row = income('a', 5);
  const record = change(data(), [set(row)]);
  expect(undoWrites(data([row]), record)).toEqual([
    { type: 'delete', collection: 'income', id: 'a' },
  ]);
});

test('undo restores an edited or deleted record', () => {
  const row = income('a', 5);
  const edited = { ...row, amount: 6 };
  const editRecord = change(data([row]), [set(edited)]);
  expect(undoWrites(data([edited]), editRecord)).toEqual([set(row)]);
  const deleted = change(data([row]), [{ type: 'delete', collection: 'income', id: 'a' }]);
  expect(undoWrites(data(), deleted)).toEqual([set(row)]);
});

test('undo refuses when the record has changed since', () => {
  const row = income('a', 5);
  const record = change(data([row]), [set({ ...row, amount: 6 })]);
  expect(() => undoWrites(data([{ ...row, amount: 7 }]), record)).toThrow(/has changed since/);
});

test('very large changes keep a summary only', () => {
  const writes = Array.from({ length: 51 }, (_, index) => set(income(`i${index}`, 1)));
  const record = change(data(), writes);
  expect(record).toMatchObject({ summary: 'Changed 51 records', count: 51, entries: [] });
});

test('the log keeps its newest entries', () => {
  const rows = Array.from({ length: MAX_CHANGES + 1 }, (_, index) => ({
    ...change(data(), [set(income('a', 1))]),
    id: `c${index}`,
    at: new Date(index * 1000).toISOString(),
  }));
  expect(pruneWrites(rows).map((row) => row.id)).toEqual(['c1', 'c0']);
});
