import { create } from 'zustand';
import { dueContributions } from '../domain/holdings';
import {
  COLLECTION_NAMES,
  emptyTrackerData,
  type CollectionName,
  type RecordWrite,
  type TrackerData,
  type TrackerRepository,
} from '../data/repository';
import { defaultSettings, type TrackerSettings } from '../schema/records';

interface TrackerState {
  data: TrackerData;
  loaded: boolean;
  invalidRecords: number;
  error: string | null;
  canEdit: boolean;
  /** Family member the personal figures follow. Null shows the whole household. */
  profile: string | null;
  repository: TrackerRepository | null;
  connect(repository: TrackerRepository, canEdit: boolean): () => void;
  commit(writes: RecordWrite[]): void;
  report(message: string): void;
  setProfile(profile: string | null): void;
  /** Posts scheduled contributions that are due. Safe to run from every device. */
  runSchedules(today: string): void;
}

export const useTracker = create<TrackerState>((set, get) => ({
  data: emptyTrackerData(),
  loaded: false,
  invalidRecords: 0,
  error: null,
  canEdit: true,
  profile: null,
  repository: null,

  connect(repository, canEdit) {
    set({
      repository,
      canEdit,
      data: emptyTrackerData(),
      loaded: false,
      invalidRecords: 0,
      error: null,
    });
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
    if (!get().canEdit) {
      set({ error: 'Viewer access can look at records but not change them.' });
      return;
    }
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

  setProfile(profile) {
    set({ profile });
  },

  runSchedules(today) {
    const { canEdit, data, commit } = get();
    if (!canEdit) return;
    const due = dueContributions(data.holdings, data.contributions, today);
    if (due.length === 0) return;
    commit(
      due.map((row) => ({ type: 'set', collection: 'contributions', id: row.id, value: row })),
    );
  },
}));

export const useSettings = (): TrackerSettings =>
  useTracker((state) => state.data.settings[0]) ?? defaultSettings();

/** Personal records follow the selected profile. Household expenses stay shared. */
export function selectView(data: TrackerData, profile: string | null): TrackerData {
  if (!profile) return data;
  const mine = <Row extends { member: string }>(rows: Row[]) =>
    rows.filter((row) => row.member === profile);
  const holdings = mine(data.holdings);
  const ids = new Set(holdings.map((row) => row.id));
  return {
    ...data,
    income: mine(data.income),
    loans: mine(data.loans),
    holdings,
    gratuityAccounts: mine(data.gratuityAccounts),
    contributions: data.contributions.filter((row) => ids.has(row.holdingId)),
    valuations: data.valuations.filter((row) => ids.has(row.holdingId)),
  };
}

export function useView() {
  const data = useTracker((state) => state.data);
  const profile = useTracker((state) => state.profile);
  return selectView(data, profile);
}
