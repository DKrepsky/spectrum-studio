import { create } from 'zustand';

import type { Capabilities } from '../bindings/Capabilities';
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

/**
 * Start-up as the UI shows it (ADR 0017): `loading` until the first status, and while auto-connect
 * has not begun its connect; `unavailable` when the backend could not be asked at start-up.
 */
export type Startup = 'loading' | 'ready' | 'unavailable';

/** Pure start-up rule, see `Startup`. `failed` is set when the start-up commands failed. */
export function startupOf(status: SessionStatus | null, failed: boolean): Startup {
  if (status == null) return failed ? 'unavailable' : 'loading';
  if (status.launching && status.state === 'disconnected') return 'loading';
  return 'ready';
}

/** The start-up state of the store (`startupOf` of its status and failure flag). */
export function selectStartup(state: Pick<SessionStore, 'status' | 'startupFailed'>): Startup {
  return startupOf(state.status, state.startupFailed);
}

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
  /**
   * The capabilities each driver reported when one of its sources was open in this run, by driver
   * id. Kept while the source is closed, so its rows keep their kind (DESIGN.md 3.6).
   */
  capabilitiesByDriver: Record<string, Capabilities>;
  /** Set when the start-up commands failed (`init`); see `startupOf`. */
  startupFailed: boolean;
  /**
   * The identity of the live source whose missing entry already caused a list reload (see
   * `receiveStatus`). Cleared when the live source is known or gone, so a source reloads at most once.
   */
  listReloadedFor: string | null;

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
    capabilitiesByDriver: {},
    startupFailed: false,
    listReloadedFor: null,

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
        set({
          commandError: `Could not reach the backend: ${errorMessage(error)}`,
          commandErrorFrom: null,
          startupFailed: true,
        });
      }
      return () => {
        unlisten();
        stopPersisting();
      };
    },

    receiveStatus: (status) => {
      const previous = get().status;
      if (previous && status.revision <= previous.revision) return; // out of order
      const source = status.source;
      const switched =
        status.state === 'connecting' ||
        (previous?.source != null &&
          status.source != null &&
          JSON.stringify(previous.source.config) !== JSON.stringify(status.source.config));
      if (switched) frameStore.clear();
      set({
        status,
        ...(source
          ? {
              capabilitiesByDriver: {
                ...get().capabilitiesByDriver,
                [source.config.driverId]: source.capabilities,
              },
            }
          : {}),
      });
      // A connect in progress or a live source supersedes the last failure: a Failed marker and the
      // error of a failed UI connect are stale. Other command errors are not touched.
      if (
        status.state === 'connecting' ||
        status.state === 'connected' ||
        status.state === 'acquiring'
      ) {
        useSources.getState().setFailed(null);
        if (get().commandErrorFrom === 'connecting')
          set({ commandError: null, commandErrorFrom: null });
      }
      const sources = useSources.getState();
      // The config the backend is connecting to, or failed to connect to (auto-connect at launch, an
      // external reconnect): the selection follows it, and a failed one is marked Failed (R8).
      const failedConnect =
        status.state === 'disconnected' && status.lastNotice?.kind === 'connectFailed';
      const attempt = status.state === 'connecting' || failedConnect ? status.lastConfig : null;
      const target = source?.config ?? attempt;
      const entry = target ? sources.list.find((e) => sameIdentity(e.config, target)) : undefined;
      // While we are connecting ourselves the target is already the active entry.
      if (target && get().busy !== 'connecting' && !sameIdentity(sources.active?.config, target)) {
        sources.setActive(
          entry
            ? { id: entry.id, title: titleOf(entry), config: entry.config }
            : source
              ? { id: null, title: source.deviceLabel, config: source.config }
              : { id: null, title: fallbackTitle(target, sources.drivers), config: target },
        );
      }
      if (failedConnect && attempt) {
        sources.setFailed(entry ? rowKey(entry) : configKey(attempt));
      }
      // A live source the remembered list does not know yet (the backend remembers it just after
      // publishing it): reload the list once per source, so the selection can match its entry. A
      // status repeats the same source many times, and a store that never remembers it must not
      // reload on each of them; the mark is cleared once the source is known or gone.
      if (source && !sources.list.some((e) => sameIdentity(e.config, source.config))) {
        const key = JSON.stringify(source.config);
        if (get().listReloadedFor !== key) {
          set({ listReloadedFor: key });
          void sources.refresh();
        }
      } else if (get().listReloadedFor !== null) {
        set({ listReloadedFor: null });
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
