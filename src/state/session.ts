import { create } from 'zustand';

import type { DriverInfo } from '../bindings/DriverInfo';
import type { ProcessingSettings } from '../bindings/ProcessingSettings';
import type { SavedSource } from '../bindings/SavedSource';
import type { SessionStatus } from '../bindings/SessionStatus';
import type { SettingsPatch } from '../bindings/SettingsPatch';
import type { SourceConfig } from '../bindings/SourceConfig';
import { api, errorMessage } from '../ipc/commands';
import { frameStore } from './frames';
import { persistDisplayPreferences, useView } from './view';

export const SIMULATOR_CONFIG: SourceConfig = {
  driverId: 'simulator',
  deviceId: null,
  connection: {},
  settings: { centerHz: null, spanHz: null, params: {} },
};

export type BusyOperation = 'connecting' | 'disconnecting' | 'starting' | 'stopping' | 'applying';

export interface SessionStore {
  /** Last status received from the backend; `null` until the first one arrives. */
  status: SessionStatus | null;
  drivers: DriverInfo[];
  /** Source the toolbar's Connect/Run buttons will use. */
  selectedConfig: SourceConfig;
  busy: BusyOperation | null;
  /** Error from the last failed command, shown until dismissed. */
  commandError: string | null;
  /** Confirmation of a completed action (e.g. an export), shown briefly. */
  info: string | null;
  savedSources: SavedSource[];

  init: () => Promise<() => void>;
  receiveStatus: (status: SessionStatus) => void;
  select: (config: SourceConfig) => void;
  connect: (config?: SourceConfig) => Promise<boolean>;
  disconnect: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** Connects the selected source if needed, then starts acquisition. */
  run: () => Promise<void>;
  applySettings: (patch: SettingsPatch) => Promise<boolean>;
  setProcessing: (change: Partial<ProcessingSettings>) => Promise<void>;
  resetHolds: () => Promise<void>;
  dismissNotice: () => Promise<void>;
  clearCommandError: () => void;
  showInfo: (message: string | null) => void;
  refreshSavedSources: () => Promise<void>;
  saveSource: (name: string, config: SourceConfig, id?: string) => Promise<SavedSource | null>;
  deleteSavedSource: (id: string) => Promise<void>;
  exportCsv: () => Promise<void>;
}

let infoTimer: ReturnType<typeof setTimeout> | undefined;

export const useSession = create<SessionStore>()((set, get) => {
  /** Runs a command, tracking busy state and surfacing errors. Returns false on failure. */
  const command = async (busy: BusyOperation | null, fn: () => Promise<unknown>) => {
    set({ busy, commandError: null });
    try {
      await fn();
      return true;
    } catch (error) {
      set({ commandError: errorMessage(error) });
      return false;
    } finally {
      set({ busy: null });
    }
  };

  return {
    status: null,
    drivers: [],
    selectedConfig: SIMULATOR_CONFIG,
    busy: null,
    commandError: null,
    info: null,
    savedSources: [],

    init: async () => {
      const unlisten = await api.onStatus((s) => get().receiveStatus(s));
      let stopPersisting: () => void = () => undefined;
      try {
        const [status, drivers, preferences, warnings, savedSources] = await Promise.all([
          api.getStatus(),
          api.listDrivers(),
          api.getPreferences(),
          api.storeWarnings(),
          api.listSavedSources(),
        ]);
        useView.getState().hydrate(preferences.display);
        set({
          drivers,
          savedSources,
          selectedConfig: preferences.lastSource ?? SIMULATOR_CONFIG,
          commandError: warnings.length ? warnings.join(' ') : null,
        });
        get().receiveStatus(status);
        stopPersisting = persistDisplayPreferences(api.saveDisplayPreferences, (e) =>
          set({ commandError: `Could not save display settings: ${errorMessage(e)}` }),
        );
      } catch (error) {
        set({ commandError: errorMessage(error) });
      }
      return () => {
        unlisten();
        stopPersisting();
      };
    },

    receiveStatus: (status) => {
      const previous = get().status;
      if (previous && status.revision <= previous.revision) return; // out of order
      const switched =
        status.state === 'connecting' ||
        (previous?.source != null &&
          status.source != null &&
          JSON.stringify(previous.source.config) !== JSON.stringify(status.source.config));
      if (switched) frameStore.clear();
      set({ status });
      // Follow the connected source only when the connection itself changes, so a selection
      // the user just made is not overwritten by unrelated status updates.
      const newConnection =
        status.source != null &&
        JSON.stringify(previous?.source?.config) !== JSON.stringify(status.source.config);
      if (newConnection) set({ selectedConfig: status.source!.config });
    },

    select: (config) => set({ selectedConfig: config }),

    connect: (config) =>
      command('connecting', () => api.connectSource(config ?? get().selectedConfig)),

    disconnect: async () => {
      await command('disconnecting', () => api.disconnectSource());
    },

    start: async () => {
      await command('starting', () => api.startAcquisition());
    },

    stop: async () => {
      await command('stopping', () => api.stopAcquisition());
    },

    run: async () => {
      const state = get().status?.state;
      if (state !== 'connected' && state !== 'acquiring') {
        if (!(await get().connect())) return;
      }
      await get().start();
    },

    applySettings: (patch) => command('applying', () => api.applySourceSettings(patch)),

    setProcessing: async (change) => {
      const current = get().status?.processing;
      if (!current) return;
      await command(null, () => api.setProcessing({ ...current, ...change }));
    },

    resetHolds: async () => {
      await command(null, () => api.resetHolds());
    },

    dismissNotice: async () => {
      await command(null, () => api.dismissNotice());
    },

    clearCommandError: () => set({ commandError: null }),

    showInfo: (info) => {
      clearTimeout(infoTimer);
      set({ info });
      if (info) infoTimer = setTimeout(() => set({ info: null }), 8000);
    },

    refreshSavedSources: async () => {
      await command(null, async () => set({ savedSources: await api.listSavedSources() }));
    },

    saveSource: async (name, config, id) => {
      let saved: SavedSource | null = null;
      const ok = await command(null, async () => {
        saved = await api.saveSource(id ?? null, name, config);
        set({ savedSources: await api.listSavedSources() });
      });
      return ok ? saved : null;
    },

    deleteSavedSource: async (id) => {
      await command(null, async () => {
        await api.deleteSavedSource(id);
        set({ savedSources: await api.listSavedSources() });
      });
    },

    exportCsv: async () => {
      await command(null, async () => {
        const result = await api.exportCsv();
        if (result) get().showInfo(`Exported ${result.points} points to ${result.path}`);
      });
    },
  };
});
