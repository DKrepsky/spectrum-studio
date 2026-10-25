/**
 * Typed wrappers around the backend IPC commands. All backend access goes through this module so
 * components can be tested with it mocked.
 */
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

import type { DeviceDescriptor } from '../bindings/DeviceDescriptor';
import type { DisplayPreferences } from '../bindings/DisplayPreferences';
import type { DriverInfo } from '../bindings/DriverInfo';
import type { Preferences } from '../bindings/Preferences';
import type { ProcessingSettings } from '../bindings/ProcessingSettings';
import type { SavedSource } from '../bindings/SavedSource';
import type { SessionStatus } from '../bindings/SessionStatus';
import type { SettingsPatch } from '../bindings/SettingsPatch';
import type { SourceConfig } from '../bindings/SourceConfig';
import type { SourceSettings } from '../bindings/SourceSettings';

export const STATUS_EVENT = 'session-status';

/** Extracts the user-facing message from a rejected command. */
export function errorMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    if (typeof error.message === 'string') return error.message;
  }
  return 'An unexpected error occurred.';
}

export interface ExportResult {
  path: string;
  points: number;
}

export const api = {
  getStatus: () => invoke<SessionStatus>('get_status'),
  listDrivers: () => invoke<DriverInfo[]>('list_drivers'),
  discoverDevices: (driverId: string) =>
    invoke<DeviceDescriptor[]>('discover_devices', { driverId }),
  connectSource: (config: SourceConfig) => invoke<SessionStatus>('connect_source', { config }),
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
  listSavedSources: () => invoke<SavedSource[]>('list_saved_sources'),
  saveSource: (id: string | null, name: string, config: SourceConfig) =>
    invoke<SavedSource>('save_source', { id, name, config }),
  deleteSavedSource: (id: string) => invoke<null>('delete_saved_source', { id }),
  /** Opens a native save dialog in the backend; `null` when cancelled. */
  exportCsv: () => invoke<ExportResult | null>('export_csv'),
  onStatus: (handler: (status: SessionStatus) => void): Promise<UnlistenFn> =>
    listen<SessionStatus>(STATUS_EVENT, (event) => handler(event.payload)),
};

export type Api = typeof api;
