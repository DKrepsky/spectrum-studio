import { create } from 'zustand';

import type { DriverInfo } from '../bindings/DriverInfo';
import type { SavedSource } from '../bindings/SavedSource';
import type { SourceConfig } from '../bindings/SourceConfig';
import type { SourceList } from '../bindings/SourceList';
import type { SourceTestResult } from '../bindings/SourceTestResult';
import type { SourceUpdate } from '../bindings/SourceUpdate';
import type { ParamValue } from '../bindings/ParamValue';
import { api, errorMessage } from '../ipc/commands';
import type { DiscoveryState } from './sourceEntries';
import { rowTitle } from './sourceEntries';
import { useSession } from './session';

export const SCAN_INTERVAL_MS = 3000;
export const UNDO_FORGET_MS = 5000;

/** The source the toolbar button shows; `id` is null for a source that is not remembered. */
export interface ActiveEntry {
  id: string | null;
  title: string;
  config: SourceConfig;
}

export interface SourcesStore {
  list: SavedSource[];
  activeId: string | null;
  /** `null` means "Choose a source". */
  active: ActiveEntry | null;
  discovery: DiscoveryState & { error: string | null };
  /** Row key of the last failed pick; cleared on the next pick or success. */
  failed: string | null;
  /** Entry forgotten in the last 5 s, for the Undo toast. */
  forgotten: SavedSource | null;
  /** Error of the last list/forget/undo command (add/update/test report through their return). */
  error: string | null;
  /** Drivers used to derive titles; set by the session store on init. */
  drivers: DriverInfo[];

  setDrivers: (drivers: DriverInfo[]) => void;
  setActive: (active: ActiveEntry | null) => void;
  setFailed: (key: string | null) => void;
  /** Loads the remembered list and the last active entry. Never connects. */
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Scans now and every 3 s (one request at a time) until the returned function is called. */
  startScanning: () => () => void;
  /** Creates a record (no connect). Rejects with the backend message; state is untouched on failure. */
  addSource: (name: string, config: SourceConfig) => Promise<SavedSource>;
  /** Edits a record. Rejects with the backend message; state is untouched on failure. */
  updateSource: (id: string, update: SourceUpdate) => Promise<SavedSource>;
  /** Probes a connection without changing any state. */
  testSource: (
    driverId: string,
    connection: Record<string, ParamValue>,
  ) => Promise<SourceTestResult>;
  forget: (id: string) => Promise<void>;
  undoForget: () => Promise<void>;
}

let undoTimer: ReturnType<typeof setTimeout> | undefined;
let scanInFlight = false;

export const useSources = create<SourcesStore>()((set, get) => {
  const entryOf = (entry: SavedSource): ActiveEntry => ({
    id: entry.id,
    title: rowTitle(entry, get().drivers),
    config: entry.config,
  });

  /** Applies a fresh list; keeps the active entry's title in sync with its remembered record. */
  const applyList = (next: SourceList, adoptActive: boolean) => {
    const { active } = get();
    const current = active?.id != null ? next.sources.find((e) => e.id === active.id) : undefined;
    const adopted =
      adoptActive && next.activeId != null
        ? next.sources.find((e) => e.id === next.activeId)
        : undefined;
    set({
      list: next.sources,
      activeId: next.activeId,
      error: null,
      ...(adopted ? { active: entryOf(adopted) } : current ? { active: entryOf(current) } : {}),
    });
  };

  return {
    list: [],
    activeId: null,
    active: null,
    discovery: { results: [], scanned: false, scanning: false, error: null },
    failed: null,
    forgotten: null,
    error: null,
    drivers: [],

    setDrivers: (drivers) => set({ drivers }),
    setActive: (active) => set({ active }),
    setFailed: (failed) => set({ failed }),

    init: async () => {
      try {
        applyList(await api.listSources(), true);
      } catch (e) {
        set({ error: errorMessage(e) });
      }
    },

    refresh: async () => {
      try {
        applyList(await api.listSources(), false);
      } catch (e) {
        set({ error: errorMessage(e) });
      }
    },

    startScanning: () => {
      let stopped = false;
      const scan = async () => {
        if (scanInFlight) return;
        scanInFlight = true;
        if (!get().discovery.scanned) set({ discovery: { ...get().discovery, scanning: true } });
        try {
          const results = await api.discoverAll();
          const { discovery } = get();
          // Silent update: leave the state untouched when nothing changed, so the menu does not re-render.
          if (stopped) {
            set({ discovery: { ...discovery, scanning: false } });
          } else if (
            JSON.stringify(results) !== JSON.stringify(discovery.results) ||
            !discovery.scanned ||
            discovery.error != null ||
            discovery.scanning
          ) {
            set({ discovery: { results, scanned: true, scanning: false, error: null } });
          }
        } catch (e) {
          set({ discovery: { ...get().discovery, scanning: false, error: errorMessage(e) } });
        } finally {
          scanInFlight = false;
        }
      };
      void scan();
      const timer = setInterval(() => void scan(), SCAN_INTERVAL_MS);
      return () => {
        stopped = true;
        clearInterval(timer);
      };
    },

    addSource: async (name, config) => {
      const saved = await api.addSource(name, config);
      await get().refresh();
      return saved;
    },

    updateSource: async (id, update) => {
      const saved = await api.updateSource(id, update);
      await get().refresh(); // also re-titles the toolbar when the edited entry is the active one
      return saved;
    },

    testSource: (driverId, connection) => api.testSource(driverId, connection),

    forget: async (id) => {
      const entry = get().list.find((e) => e.id === id);
      if (!entry) return;
      try {
        applyList(await api.forgetSource(id), false);
      } catch (e) {
        set({ error: errorMessage(e) });
        return;
      }
      // Forgetting a connected source keeps the connection and its name until another source is
      // picked; a selected source that is not connected simply stops being selected.
      const sessionState = useSession.getState().status?.state ?? 'disconnected';
      if (get().active?.id === id && sessionState === 'disconnected') set({ active: null });
      clearTimeout(undoTimer);
      set({ forgotten: entry });
      undoTimer = setTimeout(() => set({ forgotten: null }), UNDO_FORGET_MS);
    },

    undoForget: async () => {
      const entry = get().forgotten;
      if (!entry) return;
      clearTimeout(undoTimer);
      set({ forgotten: null });
      try {
        applyList(await api.restoreSource(entry), false);
      } catch (e) {
        set({ error: errorMessage(e) });
      }
    },
  };
});
