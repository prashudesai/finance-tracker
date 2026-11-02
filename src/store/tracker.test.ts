import { createMemoryRepository } from '../data/memoryRepository';
import { useTracker } from './tracker';

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
