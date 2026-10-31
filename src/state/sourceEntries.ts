/** Pure helpers behind the source menu: titles, grouping, presence and parameter splitting. */
import type { DeviceDescriptor } from '../bindings/DeviceDescriptor';
import type { DiscoveryResult } from '../bindings/DiscoveryResult';
import type { DriverInfo } from '../bindings/DriverInfo';
import type { ParamSpec } from '../bindings/ParamSpec';
import type { ParamValue } from '../bindings/ParamValue';
import type { SavedSource } from '../bindings/SavedSource';
import type { SourceConfig } from '../bindings/SourceConfig';
import type { SessionState } from '../bindings/SessionState';
import type { Transport } from '../bindings/Transport';

export const TRANSPORT_LABEL: Record<Transport, string> = {
  usb: 'USB',
  serial: 'Serial',
  network: 'Network',
  file: 'File',
  internal: 'Built-in',
};

export const SIMULATOR_ID = 'simulator';
const TRACE_EXTENSIONS = ['csv', 'txt'];

/** Picks the file driver for a path by its extension. */
export function fileDriverFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return TRACE_EXTENSIONS.includes(ext) ? 'trace-csv' : 'iq-file';
}

/** Drivers that may be connected; Planned ones are never exposed to the user. */
export function visibleDrivers(drivers: readonly DriverInfo[]): DriverInfo[] {
  return drivers.filter((d) => d.status === 'available');
}

/** Drivers offered by the Add source dialog: not file/simulator, with connection params. */
export function dialogDrivers(drivers: readonly DriverInfo[]): DriverInfo[] {
  return visibleDrivers(drivers).filter(
    (d) => d.transport !== 'internal' && d.transport !== 'file' && d.connectionParams.length > 0,
  );
}

/** Former name of `dialogDrivers`. */
export const otherDrivers = dialogDrivers;

/** Name suggested for a detected device: its label (which already carries the serial). */
export function defaultName(device: Pick<DeviceDescriptor, 'label'>): string {
  return device.label.trim();
}

/** Row key of a remembered entry. */
export function rowKey(entry: SavedSource): string {
  return `source-entry-${entry.id}`;
}

/** Row key of a detected device (also used for ad hoc configs, see `configKey`). */
export function detectedKey(device: Pick<DeviceDescriptor, 'driverId' | 'deviceId'>): string {
  return `${device.driverId}/${device.deviceId}`;
}

/** Key for a source that is not (yet) remembered. */
export function configKey(config: SourceConfig): string {
  return config.deviceId == null ? config.driverId : `${config.driverId}/${config.deviceId}`;
}

function basename(path: string): string {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path;
}

function str(value: ParamValue | undefined): string {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
}

/** Detail that distinguishes one source of a driver from another: file name, device id or host:port. */
function connectionDetail(config: SourceConfig): string {
  const path = str(config.connection['path']);
  if (path) return basename(path);
  if (config.deviceId) return config.deviceId;
  const host = str(config.connection['host']);
  if (host) {
    const port = str(config.connection['port']);
    return port ? `${host}:${port}` : host;
  }
  return '';
}

/** Fallback title for a source with no name or label (migrated entries, ad hoc configs). */
export function fallbackTitle(config: SourceConfig, drivers: readonly DriverInfo[]): string {
  const name = drivers.find((d) => d.id === config.driverId)?.name ?? config.driverId;
  const detail = connectionDetail(config);
  return detail ? `${name} · ${detail}` : name;
}

/** Name shown for a remembered entry: user override, else the automatic label, else a fallback. */
export function rowTitle(entry: SavedSource, drivers: readonly DriverInfo[]): string {
  return entry.name.trim() || entry.label.trim() || fallbackTitle(entry.config, drivers);
}

/** `unknown` renders like idle; only a successful scan of the entry's driver can say `absent`. */
export type Presence = 'present' | 'absent' | 'unknown';

export interface YourRow {
  entry: SavedSource;
  key: string;
  title: string;
  transport: Transport;
  presence: Presence;
  active: boolean;
  /** Where it is attached: the scan's `location` when present, else the record's port hint. */
  port: string | null;
}

export interface DetectedRow {
  device: DeviceDescriptor;
  key: string;
  title: string;
  transport: Transport;
  port: string | null;
}

export interface MenuModel {
  yours: YourRow[];
  detected: DetectedRow[];
  /** The fixed "Signal simulator" row shows only until the simulator has been used. */
  simulatorInFixedBlock: boolean;
  /** Drivers whose last scan failed, for the "Could not scan" line. */
  scanErrors: { driverId: string; error: string }[];
}

export interface DiscoveryState {
  results: DiscoveryResult[];
  scanned: boolean;
  scanning: boolean;
}

function portHint(config: SourceConfig): string | null {
  const port = config.connection['port'];
  return typeof port === 'string' && port !== '' ? port : null;
}

/** True while the entry is the active source and a session operation holds its connection. */
export function isActiveBusy(
  state: SessionState | null | undefined,
  busy: string | null,
  activeId: string | null,
  entryId: string,
): boolean {
  if (activeId == null || activeId !== entryId) return false;
  if (busy === 'connecting' || busy === 'disconnecting') return true;
  return state != null && state !== 'disconnected';
}

function presenceOf(
  config: SourceConfig,
  driver: DriverInfo,
  results: readonly DiscoveryResult[],
): Presence {
  if (!driver.supportsDiscovery || config.deviceId == null) return 'unknown';
  const result = results.find((r) => r.driverId === config.driverId);
  if (!result || result.error != null) return 'unknown';
  return result.devices.some((d) => d.deviceId === config.deviceId) ? 'present' : 'absent';
}

export function menuModel(
  list: readonly SavedSource[],
  discovery: DiscoveryState,
  drivers: readonly DriverInfo[],
  activeId: string | null,
): MenuModel {
  const available = new Map(visibleDrivers(drivers).map((d) => [d.id, d]));
  const entries = list.filter((e) => available.has(e.config.driverId));
  const yours = entries.map<YourRow>((entry) => {
    const driver = available.get(entry.config.driverId)!;
    const located = discovery.results
      .find((r) => r.driverId === entry.config.driverId)
      ?.devices.find((d) => d.deviceId === entry.config.deviceId)?.location;
    return {
      entry,
      port: located ?? portHint(entry.config),
      key: rowKey(entry),
      title: rowTitle(entry, drivers),
      transport: driver.transport,
      presence: presenceOf(entry.config, driver, discovery.results),
      active: entry.id === activeId,
    };
  });

  const remembered = new Set(
    entries
      .filter((e) => e.config.deviceId != null)
      .map((e) => detectedKey({ ...e.config, deviceId: e.config.deviceId! })),
  );
  // An entry that only knows its port (the backend binds the serial when it can, but a device
  // may show up after the save) stands for the device detected at that port: one row per device.
  for (const entry of entries) {
    if (entry.config.deviceId != null) continue;
    const port = portHint(entry.config);
    if (port == null) continue;
    const device = discovery.results
      .find((r) => r.driverId === entry.config.driverId)
      ?.devices.find((d) => d.location === port);
    if (device) remembered.add(detectedKey(device));
  }
  const detected: DetectedRow[] = [];
  const scanErrors: MenuModel['scanErrors'] = [];
  for (const result of discovery.results) {
    const driver = available.get(result.driverId);
    if (!driver) continue;
    if (result.error != null) scanErrors.push({ driverId: result.driverId, error: result.error });
    for (const device of result.devices) {
      const key = detectedKey(device);
      if (remembered.has(key)) continue;
      detected.push({
        device,
        key,
        title: device.label,
        transport: driver.transport,
        port: device.location,
      });
    }
  }

  return {
    yours,
    detected,
    simulatorInFixedBlock:
      available.has(SIMULATOR_ID) && !entries.some((e) => e.config.driverId === SIMULATOR_ID),
    scanErrors,
  };
}

/** Which remembered entry a "Run"/"Reconnect" should target: the entry if it still exists. */
export function isRemembered(list: readonly SavedSource[], id: string | null): id is string {
  return id != null && list.some((e) => e.id === id);
}

export interface SplitParams {
  /** Required parameters that have no value yet: shown first. */
  primary: ParamSpec[];
  /** Everything else, behind "Show more". */
  more: ParamSpec[];
}

export function splitConnectionParams(
  specs: readonly ParamSpec[],
  values: Partial<Record<string, ParamValue>>,
): SplitParams {
  const missing = (s: ParamSpec) => {
    const v = values[s.id];
    return s.required && (v === undefined || v === '');
  };
  return { primary: specs.filter(missing), more: specs.filter((s) => !missing(s)) };
}
