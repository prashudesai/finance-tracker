import { createMemoryRepository } from '../data/memoryRepository';
import { selectView, useTracker } from './tracker';
import { defaultSettings } from '../schema/records';
import type { TrackerRepository } from '../data/repository';

afterEach(() => useTracker.setState({ error: null, repository: null, profile: null }));

const contribution = (amount: number) => ({
  id: 'c',
  holdingId: 'h',
  date: '2026-01-05',
  amount,
  automatic: false,
});

test('a record the app could not read back is refused, with a reason', () => {
  const repository = createMemoryRepository();
  const commit = vi.spyOn(repository, 'commit');
  useTracker.getState().connect(repository, true);
  useTracker.getState().commit([
    { type: 'set', collection: 'contributions', id: 'c', value: contribution(2e13) },
  ]);
  expect(commit).not.toHaveBeenCalled();
  expect(useTracker.getState().error).toMatch(/wasn't saved/);
  expect(useTracker.getState().data.contributions).toEqual([]);
});

test('valid records still save', async () => {
  const repository = createMemoryRepository();
  useTracker.getState().connect(repository, true);
  useTracker.getState().commit([
    { type: 'set', collection: 'contributions', id: 'c', value: contribution(5000) },
  ]);
  await vi.waitFor(() => expect(useTracker.getState().data.contributions).toHaveLength(1));
  expect(useTracker.getState().error).toBeNull();
});
test('a failed save and a failed load show plain language, not the library error', async () => {
  const failure = Object.assign(new Error('Missing or insufficient permissions.'), {
    code: 'permission-denied',
  });
  const repository: TrackerRepository = {
    ...createMemoryRepository(),
    commit: () => Promise.reject(failure),
  };
  useTracker.getState().connect(repository, true);
  useTracker.getState().commit([
    { type: 'set', collection: 'contributions', id: 'c', value: contribution(5000) },
  ]);
  await vi.waitFor(() => expect(useTracker.getState().error).toBeTruthy());
  expect(useTracker.getState().error).not.toContain('insufficient permissions');

  const failing: TrackerRepository = {
    ...createMemoryRepository(),
    subscribe(_name, _rows, onError) {
      onError(failure);
      return () => undefined;
    },
  };
  useTracker.getState().connect(failing, true);
  expect(useTracker.getState().error).not.toContain('insufficient permissions');
});
test('a profile that no longer exists shows the whole household', () => {
  const base = useTracker.getState().data;
  const income = { id: 'i', date: '2026-01-01', member: 'Alex', source: 'Salary', amount: 5 };
  const settings = { ...defaultSettings(), familyMembers: ['Alex'] };
  const data = { ...base, income: [income], settings: [settings] };
  expect(selectView(data, 'Jamie').income).toEqual([income]);
  expect(selectView(data, 'Alex').income).toEqual([income]);
  expect(selectView({ ...data, income: [{ ...income, member: 'Sam' }] }, 'Alex').income).toEqual(
    [],
  );
});
