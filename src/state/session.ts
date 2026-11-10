import { create } from 'zustand';

import type { CaptureMode } from '../bindings/CaptureMode';
import type { DriverInfo } from '../bindings/DriverInfo';
import type { ProcessingSettings } from '../bindings/ProcessingSettings';
import type { SavedSource } from '../bindings/SavedSource';
import type { SessionStatus } from '../bindings/SessionStatus';
import type { SettingsPatch } from '../bindings/SettingsPatch';
import type { SourceConfig } from '../bindings/SourceConfig';
import { api, errorMessage } from '../ipc/commands';
import { frameStore } from './frames';
import { sameIdentity } from './sourceConfig';
import { configKey, fallbackTitle, rowKey, rowTitle } from './sourceEntries';
import { useSources } from './sources';
import { persistDisplayPreferences, useView } from './view';

export const SIMULATOR_CONFIG: SourceConfig = {
  driverId: 'simulator',
  deviceId: null,
  connection: {},
  settings: { centerHz: null, spanHz: null, params: {} },
};

/** What to connect to: a remembered entry (by id) or an ad hoc configuration. */
export type ConnectTarget =
  { type: 'remembered'; id: string } | { type: 'config'; config: SourceConfig; title?: string };

export type BusyOperation =
  'connecting' | 'disconnecting' | 'starting' | 'stopping' | 'applying' | 'settingMode';

export interface SessionStore {
  /** Last status received from the backend; `null` until the first one arrives. */
  status: SessionStatus | null;
  drivers: DriverInfo[];
  busy: BusyOperation | null;
  /** Error from the last failed command, shown until dismissed. */
  commandError: string | null;
  /** The operation whose failure produced `commandError` (null for other errors). */
  commandErrorFrom: BusyOperation | null;

  init: () => Promise<() => void>;
  receiveStatus: (status: SessionStatus) => void;
  /** Connects (replacing any connected source); tracks the target as the active entry. */
  connectTo: (target: ConnectTarget) => Promise<boolean>;
  disconnect: () => Promise<void>;
  start: () => Promise<void>;
  /** Resolves to false when the stop command failed (the error is in `commandError`). */
  stop: () => Promise<boolean>;
  /** Changes the capture mode; the store updates when the backend reports the new status. */
  setCaptureMode: (mode: CaptureMode) => Promise<void>;
  applySettings: (patch: SettingsPatch) => Promise<boolean>;
  setProcessing: (change: Partial<ProcessingSettings>) => Promise<void>;
  resetHolds: () => Promise<void>;
  dismissNotice: () => Promise<void>;
  clearCommandError: () => void;
}

function titleOf(entry: SavedSource): string {
  return rowTitle(entry, useSources.getState().drivers);
}

export const useSession = create<SessionStore>()((set, get) => {
  /** Runs one command, surfacing its error as the failure of `busy`. Returns false on failure. */
  const attempt = async (busy: BusyOperation | null, fn: () => Promise<unknown>) => {
    try {
      await fn();
      return true;
    } catch (error) {
      set({ commandError: errorMessage(error), commandErrorFrom: busy });
      return false;
    }
  };

  /** Runs a command, tracking busy state and surfacing errors. Returns false on failure. */
  const command = async (busy: BusyOperation | null, fn: () => Promise<unknown>) => {
    set({ busy, commandError: null, commandErrorFrom: null });
    const ok = await attempt(busy, fn);
    set({ busy: null });
    return ok;
  };

  /** A Stop pressed while `start` is in flight, sent once the start has resolved. */
  let startInFlight = false;
  let queuedStop: { done: Promise<boolean>; settle: (ok: boolean) => void } | null = null;

  /** Queues one Stop behind the in-flight start; `busy` becomes 'stopping' at once, so no gap. */
  const queueStop = (): Promise<boolean> => {
    let settle: (ok: boolean) => void = () => undefined;
    const done = new Promise<boolean>((resolve) => (settle = resolve));
    queuedStop = { done, settle };
    set({ busy: 'stopping' });
    return done;
  };

  /** Sends the queued Stop, if any. Runs inside the start command, so `busy` never drops to null. */
  const sendQueuedStop = async () => {
    const queued = queuedStop;
    queuedStop = null;
    if (queued) queued.settle(await attempt('stopping', () => api.stopAcquisition()));
  };

  return {
    status: null,
    drivers: [],
    busy: null,
    commandError: null,
    commandErrorFrom: null,

    init: async () => {
      const unlisten = await api.onStatus((s) => get().receiveStatus(s));
      let stopPersisting: () => void = () => undefined;
      try {
        const [status, drivers, preferences, warnings] = await Promise.all([
          api.getStatus(),
          api.listDrivers(),
          api.getPreferences(),
          api.storeWarnings(),
        ]);
        useView.getState().hydrate(preferences.display);
        set({
          drivers,
          commandError: warnings.length ? warnings.join(' ') : null,
        });
        useSources.getState().setDrivers(drivers);
        await useSources.getState().init();
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
      // An external reconnect (or a connection we did not start) changes the connected source:
      // follow it. While we are connecting ourselves the target is already the active entry.
      const source = status.source;
      const { active, list } = useSources.getState();
      if (
        source != null &&
        get().busy !== 'connecting' &&
        !sameIdentity(active?.config, source.config)
      ) {
        const entry = list.find((e) => sameIdentity(e.config, source.config));
        useSources
          .getState()
          .setActive(
            entry
              ? { id: entry.id, title: titleOf(entry), config: entry.config }
              : { id: null, title: source.deviceLabel, config: source.config },
          );
      }
    },

    connectTo: async (target) => {
      const sources = useSources.getState();
      const entry =
        target.type === 'remembered' ? sources.list.find((e) => e.id === target.id) : undefined;
      if (target.type === 'remembered' && !entry) return false;
      const key = entry ? rowKey(entry) : configKey((target as { config: SourceConfig }).config);
      sources.setFailed(null);
      if (entry) {
        sources.setActive({ id: entry.id, title: titleOf(entry), config: entry.config });
      } else if (target.type === 'config') {
        sources.setActive({
          id: null,
          title: target.title ?? fallbackTitle(target.config, sources.drivers),
          config: target.config,
        });
      }
      const ok = await command('connecting', () =>
        target.type === 'remembered'
          ? api.connectRemembered(target.id)
          : api.connectSource(target.config),
      );
      await useSources.getState().refresh();
      if (ok) {
        const { list, activeId } = useSources.getState();
        const connected = list.find((e) => e.id === activeId);
        if (connected)
          useSources
            .getState()
            .setActive({ id: connected.id, title: titleOf(connected), config: connected.config });
      } else {
        useSources.getState().setFailed(key);
        // A merge may have removed the entry we targeted: follow the list's active id.
        const { list, activeId, active } = useSources.getState();
        const adopted = active?.id != null && !list.some((e) => e.id === active.id);
        const survivor = adopted ? list.find((e) => e.id === activeId) : undefined;
        if (survivor)
          useSources
            .getState()
            .setActive({ id: survivor.id, title: titleOf(survivor), config: survivor.config });
      }
      return ok;
    },

    disconnect: async () => {
      await command('disconnecting', () => api.disconnectSource());
    },

    start: async () => {
      startInFlight = true;
      await command('starting', async () => {
        try {
          await api.startAcquisition();
          startInFlight = false;
          await sendQueuedStop();
        } finally {
          // A start that failed leaves nothing to stop: a queued Stop resolves as not sent.
          startInFlight = false;
          queuedStop?.settle(false);
          queuedStop = null;
        }
      });
    },

    stop: () => {
      if (startInFlight) return queuedStop?.done ?? queueStop();
      return command('stopping', () => api.stopAcquisition());
    },

    setCaptureMode: async (mode) => {
      await command('settingMode', () => api.setCaptureMode(mode));
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

    clearCommandError: () => set({ commandError: null, commandErrorFrom: null }),
  };
});
