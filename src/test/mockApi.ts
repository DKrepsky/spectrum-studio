import { vi } from 'vitest';

import type { Api } from '../ipc/commands';

/** Mocked backend API; import this module before components under test. */
export const apiMock = {
  getStatus: vi.fn(),
  listDrivers: vi.fn(),
  discoverDevices: vi.fn<Api['discoverDevices']>(() => Promise.resolve([])),
  connectSource: vi.fn(),
  disconnectSource: vi.fn(() => Promise.resolve(null)),
  startAcquisition: vi.fn(() => Promise.resolve(null)),
  stopAcquisition: vi.fn(() => Promise.resolve(null)),
  applySourceSettings: vi.fn(),
  setProcessing: vi.fn(() => Promise.resolve(null)),
  resetHolds: vi.fn(() => Promise.resolve(null)),
  dismissNotice: vi.fn(() => Promise.resolve(null)),
  nextFrame: vi.fn(() => new Promise<ArrayBuffer>(() => undefined)),
  getPreferences: vi.fn(),
  storeWarnings: vi.fn(() => Promise.resolve([])),
  saveDisplayPreferences: vi.fn(() => Promise.resolve(null)),
  listSavedSources: vi.fn<Api['listSavedSources']>(() => Promise.resolve([])),
  saveSource: vi.fn(),
  deleteSavedSource: vi.fn(() => Promise.resolve(null)),
  exportCsv: vi.fn(),
  onStatus: vi.fn(() => Promise.resolve(() => undefined)),
};

vi.mock('../ipc/commands', async (importOriginal) => {
  const original = await importOriginal<typeof import('../ipc/commands')>();
  return { ...original, api: apiMock };
});

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(() => Promise.resolve(null)) }));
