import { vi } from 'vitest';

import type { ParamValue } from '../bindings/ParamValue';
import type { SavedSource } from '../bindings/SavedSource';
import type { SessionState } from '../bindings/SessionState';
import type { SourceConfig } from '../bindings/SourceConfig';
import type { SourceTestResult } from '../bindings/SourceTestResult';
import type { SourceUpdate } from '../bindings/SourceUpdate';
import type { Api } from '../ipc/commands';
import { sameIdentity } from '../state/sourceConfig';
import { OTHER_SA430_SERIAL, SA430_SERIAL, sa430Driver } from './fixtures';

/** Backend's per-port outcome table (same as the design prototype). */
export function testResultFor(
  driverId: string,
  connection: Record<string, ParamValue>,
  session: { state: SessionState; active: SourceConfig | null } = {
    state: 'disconnected',
    active: null,
  },
): SourceTestResult {
  const fail = (message: string, inUse = false): SourceTestResult => ({
    ok: false,
    message,
    deviceId: null,
    label: null,
    inUse,
  });
  if (session.state === 'connecting' || session.state === 'disconnecting')
    return fail('Busy: a connection is in progress. Try again in a moment.');
  const busyActive =
    session.active != null && ['connecting', 'connected', 'acquiring'].includes(session.state);
  if (busyActive) {
    const used = Object.values(session.active!.connection);
    const clash = Object.values(connection).find((v) => typeof v === 'string' && used.includes(v));
    if (clash !== undefined)
      return fail(
        `${String(clash)} is in use by the active source. Stop and disconnect it first.`,
        true,
      );
  }
  const port = String(connection['port'] ?? '');
  const ok = (deviceId: string): SourceTestResult => ({
    ok: true,
    message: `Connection OK. ${sa430Driver.name} found.`,
    deviceId,
    label: `SA430 ${deviceId}`,
    inUse: false,
  });
  if (driverId === 'sa430') {
    if (port === '/dev/ttyACM0' || port === '/dev/ttyACM1') return ok(SA430_SERIAL);
    if (port === '/dev/ttyACM2') return ok(OTHER_SA430_SERIAL);
    if (port === '/dev/ttyUSB9')
      return fail(`Could not open ${port}: No such file or directory (os error 2)`);
  }
  return fail('The device did not answer in time.');
}

/**
 * In-memory stand-in for the backend's source store with the same validation rules as the Rust
 * commands. `install()` points the list/add/update/forget/restore mocks at it, so component tests
 * can drive every dialog state.
 */
export class FakeBackend {
  sources: SavedSource[] = [];
  activeId: string | null = null;
  /** Session facts the lock and in-use rules look at. */
  session: { state: SessionState; active: SourceConfig | null } = {
    state: 'disconnected',
    active: null,
  };
  private nextId = 1;

  reset(sources: SavedSource[] = [], activeId: string | null = null) {
    this.sources = [...sources];
    this.activeId = activeId;
    this.session = { state: 'disconnected', active: null };
    this.nextId = 1;
  }

  private list() {
    return { sources: [...this.sources], activeId: this.activeId };
  }

  private checkName(raw: string, selfId: string | null): string {
    const name = raw.trim();
    if (name === '') throw new Error('Enter a name.');
    if (Array.from(name).length > 60) throw new Error('The name must be 60 characters or fewer.');
    const lower = name.toLowerCase();
    const clash = this.sources.find(
      (e) =>
        e.id !== selfId &&
        (e.name.trim().toLowerCase() === lower || e.label.toLowerCase() === lower),
    );
    if (clash) throw new Error('That name is already used by another source.');
    return name;
  }

  private shown = (e: SavedSource) => e.name.trim() || e.label;

  add = (name: string, config: SourceConfig): SavedSource => {
    const clean = this.checkName(name, null);
    if (config.driverId === 'simulator') throw new Error('The simulator is built in.');
    if (config.driverId === 'iq-file' || config.driverId === 'trace-csv')
      throw new Error('Use Open file… to add a recording.');
    if (config.driverId === sa430Driver.id && config.deviceId == null) {
      const port = config.connection['port'];
      if (typeof port !== 'string' || port.trim() === '') throw new Error('Enter the serial port.');
    }
    const dup = this.sources.find((e) => sameIdentity(e.config, config));
    if (dup) throw new Error(`This device is already in Your sources as "${this.shown(dup)}".`);
    const now = Date.now();
    const saved: SavedSource = {
      id: `fake-${this.nextId++}`,
      name: clean,
      label: '',
      config: { ...config, settings: { centerHz: null, spanHz: null, params: {} } },
      createdMs: now,
      updatedMs: now,
      lastUsedMs: now,
    };
    this.sources = [saved, ...this.sources];
    return saved;
  };

  update = (id: string, update: SourceUpdate): SavedSource => {
    const entry = this.sources.find((e) => e.id === id);
    if (!entry) throw new Error('That source no longer exists.');
    const name = this.checkName(update.name, id);
    const deviceId = update.deviceId ?? entry.config.deviceId;
    const same =
      deviceId === entry.config.deviceId && sameParams(update.connection, entry.config.connection);
    const driver = entry.config.driverId;
    if (!same && driver === 'simulator') throw new Error('The simulator has no settings.');
    if (!same && (driver === 'iq-file' || driver === 'trace-csv'))
      throw new Error('The file cannot be changed.');
    const next: SourceConfig = { ...entry.config, deviceId, connection: update.connection };
    const active = this.session.active;
    if (
      !same &&
      this.session.state !== 'disconnected' &&
      active != null &&
      sameIdentity(active, entry.config)
    )
      throw new Error('Disconnect first to change the connection settings.');
    const clash = this.sources.find((e) => e.id !== id && sameIdentity(e.config, next));
    if (clash) throw new Error(`This device is already in Your sources as "${this.shown(clash)}".`);
    const saved = { ...entry, name, config: next, updatedMs: Date.now() };
    this.sources = this.sources.map((e) => (e.id === id ? saved : e));
    return saved;
  };

  install() {
    apiMock.listSources.mockImplementation(() => Promise.resolve(this.list()));
    apiMock.addSource.mockImplementation((n, c) => run(() => this.add(n, c)));
    apiMock.updateSource.mockImplementation((id, u) => run(() => this.update(id, u)));
    apiMock.testSource.mockImplementation((d, c) =>
      Promise.resolve(testResultFor(d, c, this.session)),
    );
    apiMock.forgetSource.mockImplementation((id) => {
      this.sources = this.sources.filter((e) => e.id !== id);
      return Promise.resolve(this.list());
    });
    apiMock.restoreSource.mockImplementation((source: SavedSource) =>
      run(() => {
        if (this.sources.some((e) => e.id === source.id || sameIdentity(e.config, source.config)))
          throw new Error('That source already exists.');
        this.sources = [source, ...this.sources];
        return this.list();
      }),
    );
  }
}

function sameParams(a: Record<string, ParamValue>, b: Record<string, ParamValue>): boolean {
  return JSON.stringify(Object.entries(a).sort()) === JSON.stringify(Object.entries(b).sort());
}

function run<T>(fn: () => T): Promise<T> {
  try {
    return Promise.resolve(fn());
  } catch (e) {
    return Promise.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

export const fakeBackend = new FakeBackend();

/** Mocked backend API; import this module before components under test. */
export const apiMock = {
  getStatus: vi.fn(),
  listDrivers: vi.fn(),
  discoverDevices: vi.fn<Api['discoverDevices']>(() => Promise.resolve([])),
  listSources: vi.fn<Api['listSources']>(() => Promise.resolve({ sources: [], activeId: null })),
  discoverAll: vi.fn<Api['discoverAll']>(() => Promise.resolve([])),
  connectRemembered: vi.fn(),
  connectSource: vi.fn(),
  addSource: vi.fn<Api['addSource']>(),
  updateSource: vi.fn<Api['updateSource']>(),
  testSource: vi.fn<Api['testSource']>((driverId, connection) =>
    Promise.resolve(testResultFor(driverId, connection)),
  ),
  forgetSource: vi.fn(),
  restoreSource: vi.fn(),
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
  exportCsv: vi.fn(),
  onStatus: vi.fn(() => Promise.resolve(() => undefined)),
};

vi.mock('../ipc/commands', async (importOriginal) => {
  const original = await importOriginal<typeof import('../ipc/commands')>();
  return { ...original, api: apiMock };
});

vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(() => Promise.resolve(null)) }));
