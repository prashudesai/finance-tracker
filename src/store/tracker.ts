import { create } from 'zustand';
import { buildChange, pruneWrites, undoWrites } from '../domain/changes';
import { dueContributions } from '../domain/holdings';
import { plainError } from '../data/errors';
import {
  COLLECTIONS,
  COLLECTION_NAMES,
  emptyTrackerData,
  type CollectionName,
  type RecordWrite,
  type TrackerData,
  type TrackerRepository,
} from '../data/repository';
import {
  defaultSettings,
  TRACKER_SETTINGS_ID,
  type ChangeRecord,
  type TrackerSettings,
} from '../schema/records';
import type { AccessRequest } from '../data/vault';

interface TrackerState {
  data: TrackerData;
  loaded: boolean;
  invalidRecords: number;
  error: string | null;
  canEdit: boolean;
  /** Family member the personal figures follow. Null shows the whole household. */
  profile: string | null;
  /** Who the change log names. */
  actor: string;
  tourOpen: boolean;
  /** People waiting for the owner's approval. */
  accessRequests: AccessRequest[];
  /** The latest saved change, for a short confirmation. */
  toast: { message: string; change?: ChangeRecord } | null;
  /** Saves not yet confirmed by the server. They wait here while offline. */
  pendingSaves: number;
  syncedAt: Date | null;
  repository: TrackerRepository | null;
  connect(repository: TrackerRepository, canEdit: boolean, actor?: string): () => void;
  /** Saves writes. Scheduled and housekeeping writes pass `log: false`. */
  commit(writes: RecordWrite[], options?: { log?: boolean }): void;
  setTourOpen(open: boolean): void;
  setAccessRequests(requests: AccessRequest[]): void;
  dismissToast(): void;
  /** Takes back the change the current toast confirmed. */
  undoLast(): void;
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
  actor: '',
  tourOpen: false,
  accessRequests: [],
  toast: null,
  pendingSaves: 0,
  syncedAt: null,
  repository: null,

  connect(repository, canEdit, actor = '') {
    set({
      repository,
      canEdit,
      actor,
      data: emptyTrackerData(),
      loaded: false,
      invalidRecords: 0,
      error: null,
    });
    const ready = new Set<CollectionName>();
    const invalid = new Map<CollectionName, number>();
    const fail = (error: Error) =>
      set({ error: plainError(error, 'Your records could not be loaded. Please try again.') });

    function watch<Name extends CollectionName>(name: Name) {
      return repository.subscribe(
        name,
        (rows, invalidCount) => {
          ready.add(name);
          invalid.set(name, invalidCount);
          set((state) => ({
            data: { ...state.data, [name]: rows },
            loaded: ready.size === COLLECTION_NAMES.length,
            syncedAt: state.syncedAt ?? new Date(),
            invalidRecords: [...invalid.values()].reduce((sum, count) => sum + count, 0),
          }));
        },
        fail,
      );
    }

    const stops = COLLECTION_NAMES.map((name) => watch(name));
    return () => {
      stops.forEach((stop) => stop());
      // Nothing from this session may show in the next, such as after signing out.
      set({ data: emptyTrackerData(), loaded: false, syncedAt: null });
    };
  },

  // Screens update from the subscription, including while offline, so this never blocks them.
  commit(writes, options = {}) {
    const { canEdit, data, actor, repository } = get();
    if (!canEdit) {
      set({ error: 'Viewer access can look at records but not change them.' });
      return;
    }
    // Saved anyway, a record like this would come back hidden, and could hide a whole loan.
    const refused = writes.some(
      (write) =>
        write.type === 'set' && !COLLECTIONS[write.collection].safeParse(write.value).success,
    );
    if (refused) {
      set({ error: "That wasn't saved, because a date, amount or name is missing or too large." });
      return;
    }
    set({ error: null });
    const change =
      options.log === false
        ? null
        : buildChange(data, writes, {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            actor,
          });
    const logged: RecordWrite[] = change
      ? [
          ...writes,
          { type: 'set', collection: 'changes', id: change.id, value: change },
          ...pruneWrites(data.changes),
        ]
      : writes;
    if (!repository) return;
    if (change) set({ toast: { message: change.summary, change } });
    set((state) => ({ pendingSaves: state.pendingSaves + 1 }));
    repository
      .commit(logged)
      .then(() => set({ syncedAt: new Date() }))
      .catch((error: unknown) => {
        set({
          toast: null,
          error: plainError(error, 'The change could not be saved. Please try again.'),
        });
      })
      .finally(() => set((state) => ({ pendingSaves: state.pendingSaves - 1 })));
  },

  setAccessRequests(accessRequests) {
    set({ accessRequests });
  },

  dismissToast() {
    set({ toast: null });
  },

  undoLast() {
    const { toast, data, commit, report } = get();
    if (!toast?.change) return;
    try {
      commit(
        [
          ...undoWrites(data, toast.change),
          {
            type: 'set',
            collection: 'changes',
            id: toast.change.id,
            value: { ...toast.change, undone: true },
          },
        ],
        { log: false },
      );
      set({ toast: { message: 'Undone' } });
    } catch (error) {
      set({ toast: null });
      report(error instanceof Error ? error.message : 'This change could not be undone.');
    }
  },

  setTourOpen(open) {
    set({ tourOpen: open });
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
      { log: false },
    );
  },
}));

export const useSettings = (): TrackerSettings =>
  useTracker((state) => state.data.settings[0]) ?? defaultSettings();

export function useSaveSettings() {
  const commit = useTracker((state) => state.commit);
  const settings = useSettings();
  return (patch: Partial<TrackerSettings>) =>
    commit([
      {
        type: 'set',
        collection: 'settings',
        id: TRACKER_SETTINGS_ID,
        value: { ...settings, ...patch, id: TRACKER_SETTINGS_ID },
      },
    ]);
}

/** Personal records follow the selected profile. Household expenses stay shared. */
export function selectView(data: TrackerData, profile: string | null): TrackerData {
  // A name removed from the family, with its profile still selected, shows everyone.
  if (!profile || !data.settings[0]?.familyMembers.includes(profile)) return data;
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
    withdrawals: data.withdrawals.filter((row) => ids.has(row.holdingId)),
  };
}

export function useView() {
  const data = useTracker((state) => state.data);
  const profile = useTracker((state) => state.profile);
  return selectView(data, profile);
}
