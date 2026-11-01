import { create } from 'zustand';
import {
  COLLECTION_NAMES,
  emptyTrackerData,
  type CollectionName,
  type RecordWrite,
  type TrackerData,
  type TrackerRepository,
} from '../data/repository';

interface TrackerState {
  data: TrackerData;
  loaded: boolean;
  invalidRecords: number;
  error: string | null;
  repository: TrackerRepository | null;
  connect(repository: TrackerRepository): () => void;
  commit(writes: RecordWrite[]): void;
  report(message: string): void;
}

export const useTracker = create<TrackerState>((set, get) => ({
  data: emptyTrackerData(),
  loaded: false,
  invalidRecords: 0,
  error: null,
  repository: null,

  connect(repository) {
    set({ repository, data: emptyTrackerData(), loaded: false, invalidRecords: 0, error: null });
    const ready = new Set<CollectionName>();
    const invalid = new Map<CollectionName, number>();
    const fail = (error: Error) => set({ error: error.message });

    function watch<Name extends CollectionName>(name: Name) {
      return repository.subscribe(
        name,
        (rows, invalidCount) => {
          ready.add(name);
          invalid.set(name, invalidCount);
          set((state) => ({
            data: { ...state.data, [name]: rows },
            loaded: ready.size === COLLECTION_NAMES.length,
            invalidRecords: [...invalid.values()].reduce((sum, count) => sum + count, 0),
          }));
        },
        fail,
      );
    }

    const stops = COLLECTION_NAMES.map((name) => watch(name));
    return () => stops.forEach((stop) => stop());
  },

  // Screens update from the subscription, including while offline, so this never blocks them.
  commit(writes) {
    set({ error: null });
    get()
      .repository?.commit(writes)
      .catch((error: unknown) => {
        set({ error: error instanceof Error ? error.message : 'The change could not be saved.' });
      });
  },

  report(message) {
    set({ error: message });
  },
}));
