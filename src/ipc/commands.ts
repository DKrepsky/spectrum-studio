/**
 * Typed wrappers around the backend IPC commands. All backend access goes through this module so
 * components can be tested with it mocked.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type { DeviceDescriptor } from '../bindings/DeviceDescriptor';
import type { DisplayPreferences } from '../bindings/DisplayPreferences';
import type { DiscoveryResult } from '../bindings/DiscoveryResult';
import type { DriverInfo } from '../bindings/DriverInfo';
import type { ParamValue } from '../bindings/ParamValue';
import type { Preferences } from '../bindings/Preferences';
import type { ProcessingSettings } from '../bindings/ProcessingSettings';
import type { SavedSource } from '../bindings/SavedSource';
import type { SessionStatus } from '../bindings/SessionStatus';
import type { SettingsPatch } from '../bindings/SettingsPatch';
import type { SourceConfig } from '../bindings/SourceConfig';
import type { SourceList } from '../bindings/SourceList';
import type { SourceSettings } from '../bindings/SourceSettings';
import type { SourceTestResult } from '../bindings/SourceTestResult';
import type { SourceUpdate } from '../bindings/SourceUpdate';

export const STATUS_EVENT = 'session-status';

/** Extracts the user-facing message from a rejected command. */
export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    if (typeof error.message === 'string') return error.message;
  }
  return 'An unexpected error occurred.';
}

export const api = {
  getStatus: () => invoke<SessionStatus>('get_status'),
  listDrivers: () => invoke<DriverInfo[]>('list_drivers'),
  discoverDevices: (driverId: string) =>
    invoke<DeviceDescriptor[]>('discover_devices', { driverId }),
  listSources: () => invoke<SourceList>('list_sources'),
  /** Scans every available discovery-capable driver; a failing driver reports its own error. */
  discoverAll: () => invoke<DiscoveryResult[]>('discover_all'),
  connectRemembered: (id: string) => invoke<SessionStatus>('connect_remembered', { id }),
  connectSource: (config: SourceConfig) => invoke<SessionStatus>('connect_source', { config }),
  /** Creates a remembered record without connecting; the UI refreshes the list afterwards. */
  addSource: (name: string, config: SourceConfig) =>
    invoke<SavedSource>('add_source', { name, config }),
  updateSource: (id: string, update: SourceUpdate) =>
    invoke<SavedSource>('update_source', { id, update }),
  /** Non-destructive probe of the typed parameters; expected failures are `ok: false` results. */
  testSource: (driverId: string, connection: Record<string, ParamValue>) =>
    invoke<SourceTestResult>('test_source', { driverId, connection }),
  forgetSource: (id: string) => invoke<SourceList>('forget_source', { id }),
  restoreSource: (source: SavedSource) => invoke<SourceList>('restore_source', { source }),
  disconnectSource: () => invoke<null>('disconnect_source'),
  startAcquisition: () => invoke<null>('start_acquisition'),
  stopAcquisition: () => invoke<null>('stop_acquisition'),
  applySourceSettings: (patch: SettingsPatch) =>
    invoke<SourceSettings>('apply_source_settings', { patch }),
  setProcessing: (settings: ProcessingSettings) => invoke<null>('set_processing', { settings }),
  resetHolds: () => invoke<null>('reset_holds'),
  dismissNotice: () => invoke<null>('dismiss_notice'),
  /** Long-polls for a binary frame newer than `afterSeq`; an empty buffer means none yet. */
  nextFrame: (afterSeq: number) => invoke<ArrayBuffer>('next_frame', { afterSeq }),
  getPreferences: () => invoke<Preferences>('get_preferences'),
  storeWarnings: () => invoke<string[]>('store_warnings'),
  saveDisplayPreferences: (display: DisplayPreferences) =>
    invoke<null>('save_display_preferences', { display }),
  /** Opens a native save dialog in the backend; `null` when cancelled. */
  onStatus: (handler: (status: SessionStatus) => void): Promise<UnlistenFn> =>
    listen<SessionStatus>(STATUS_EVENT, (event) => handler(event.payload)),
};

export type Api = typeof api;
