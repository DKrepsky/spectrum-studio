import type { DriverInfo } from '../bindings/DriverInfo';
import type { ParamSpec } from '../bindings/ParamSpec';
import { plannedDriver, savedSource, simulatorDriver } from '../test/fixtures';
import { emptyConfig } from './sourceConfig';
import {
  detectedKey,
  fallbackTitle,
  defaultName,
  dialogDrivers,
  isActiveBusy,
  menuModel,
  otherDrivers,
  rowKey,
  rowTitle,
  splitConnectionParams,
} from './sourceEntries';

const sa430: DriverInfo = {
  id: 'sa430',
  name: 'SA430',
  description: '',
  kind: 'spectrumAnalyzer',
  transport: 'usb',
  status: 'available',
  supportsDiscovery: true,
  connectionParams: [],
};
const network: DriverInfo = {
  id: 'net',
  name: 'Net SDR',
  description: '',
  kind: 'sdr',
  transport: 'network',
  status: 'available',
  supportsDiscovery: false,
  connectionParams: [
    {
      id: 'host',
      label: 'Host',
      group: null,
      help: null,
      kind: { type: 'text', maxLength: 64 },
      default: '',
      required: true,
    },
  ],
};
const drivers = [simulatorDriver, sa430, network, plannedDriver];
const noScan = { results: [], scanned: false, scanning: false };

const device = (deviceId: string, label = `Dev ${deviceId}`, location: string | null = null) => ({
  driverId: 'sa430',
  deviceId,
  label,
  location,
  details: [],
});
const sa430Entry = (id: string, deviceId: string) =>
  savedSource({ id, label: `SA ${deviceId}`, config: { ...emptyConfig('sa430'), deviceId } });

describe('rowTitle', () => {
  it('prefers name, then label, then a fallback', () => {
    const e = savedSource({ name: '  Bench ', label: 'Auto' });
    expect(rowTitle(e, drivers)).toBe('Bench');
    expect(rowTitle({ ...e, name: ' ' }, drivers)).toBe('Auto');
    expect(rowTitle({ ...e, name: '', label: '' }, drivers)).toBe('Signal simulator');
  });

  it('builds fallbacks from device id and host:port', () => {
    expect(fallbackTitle({ ...emptyConfig('sa430'), deviceId: '/dev/ttyACM0' }, drivers)).toBe(
      'SA430 · /dev/ttyACM0',
    );
    const net = { ...emptyConfig('net'), connection: { host: '10.0.0.2', port: 5000 } };
    expect(fallbackTitle(net, drivers)).toBe('Net SDR · 10.0.0.2:5000');
    expect(fallbackTitle(emptyConfig('ghost'), drivers)).toBe('ghost');
  });
});

describe('menuModel', () => {
  it('shows the simulator row only until the simulator has been used', () => {
    expect(menuModel([], noScan, drivers, null).simulatorInFixedBlock).toBe(true);
    expect(menuModel([savedSource()], noScan, drivers, null).simulatorInFixedBlock).toBe(false);
    expect(menuModel([], noScan, [sa430], null).simulatorInFixedBlock).toBe(false);
  });

  it('hides planned and unknown drivers everywhere', () => {
    const list = [
      savedSource({ id: 'p', config: emptyConfig('soapysdr') }),
      savedSource({ id: 'g', config: emptyConfig('ghost') }),
    ];
    const scan = {
      results: [{ driverId: 'soapysdr', devices: [device('x')], error: null }],
      scanned: true,
      scanning: false,
    };
    const m = menuModel(list, scan, drivers, null);
    expect(m.yours).toEqual([]);
    expect(m.detected).toEqual([]);
  });

  it('dedupes detected devices against remembered entries', () => {
    const scan = {
      results: [{ driverId: 'sa430', devices: [device('a'), device('b')], error: null }],
      scanned: true,
      scanning: false,
    };
    const m = menuModel([sa430Entry('1', 'a')], scan, drivers, '1');
    expect(m.detected.map((d) => d.key)).toEqual([detectedKey(device('b'))]);
    expect(m.yours[0]).toMatchObject({
      key: rowKey(sa430Entry('1', 'a')),
      presence: 'present',
      active: true,
    });
  });

  it('treats an entry without a serial as the device detected at its port: one row', () => {
    const untested = savedSource({
      id: 'u',
      name: 'Bench SA430',
      config: { ...emptyConfig('sa430'), connection: { port: '/dev/ttyACM0' } },
    });
    const scan = {
      results: [
        {
          driverId: 'sa430',
          devices: [device('a', 'SA a', '/dev/ttyACM0'), device('b', 'SA b', '/dev/ttyACM1')],
          error: null,
        },
      ],
      scanned: true,
      scanning: false,
    };
    const m = menuModel([untested], scan, drivers, null);
    expect(m.yours).toHaveLength(1);
    expect(m.detected.map((d) => d.key)).toEqual([detectedKey(device('b'))]);
    // Another port, or no scan result yet: nothing is hidden.
    const elsewhere = { ...untested, config: { ...untested.config, connection: { port: '/x' } } };
    expect(menuModel([elsewhere], scan, drivers, null).detected).toHaveLength(2);
    expect(menuModel([untested], noScan, drivers, null).detected).toHaveLength(0);
  });

  it('marks absent only after a successful scan of the driver', () => {
    const entry = sa430Entry('1', 'a');
    const presence = (scan: Parameters<typeof menuModel>[1]) =>
      menuModel([entry], scan, drivers, null).yours[0]!.presence;
    expect(presence(noScan)).toBe('unknown');
    const failed = {
      results: [{ driverId: 'sa430', devices: [], error: 'udev' }],
      scanned: true,
      scanning: false,
    };
    expect(presence(failed)).toBe('unknown');
    expect(menuModel([entry], failed, drivers, null).scanErrors).toEqual([
      { driverId: 'sa430', error: 'udev' },
    ]);
    const empty = {
      results: [{ driverId: 'sa430', devices: [], error: null }],
      scanned: true,
      scanning: false,
    };
    expect(presence(empty)).toBe('absent');
  });

  it('never marks entries without a device id or discovery as absent', () => {
    const scan = {
      results: [{ driverId: 'simulator', devices: [], error: null }],
      scanned: true,
      scanning: false,
    };
    expect(menuModel([savedSource()], scan, drivers, null).yours[0]!.presence).toBe('unknown');
  });

  it('keeps the list order it is given', () => {
    const m = menuModel(
      [savedSource({ id: 'b' }), savedSource({ id: 'a' })],
      noScan,
      drivers,
      null,
    );
    expect(m.yours.map((r) => r.entry.id)).toEqual(['b', 'a']);
  });
});

describe('otherDrivers', () => {
  it('lists available non-internal drivers with connection params', () => {
    expect(otherDrivers(drivers).map((d) => d.id)).toEqual(['net']);
    expect(otherDrivers([simulatorDriver, plannedDriver, sa430])).toEqual([]);
  });
});

describe('splitConnectionParams', () => {
  const spec = (id: string, required: boolean): ParamSpec => ({
    id,
    label: id,
    group: null,
    help: null,
    kind: { type: 'text', maxLength: 64 },
    default: '',
    required,
  });
  const specs = [spec('opt', false), spec('rate', true), spec('host', true)];

  it('puts missing required params first and the rest behind show more', () => {
    const r = splitConnectionParams(specs, { host: '10.0.0.1' });
    expect(r.primary.map((s) => s.id)).toEqual(['rate']);
    expect(r.more.map((s) => s.id)).toEqual(['opt', 'host']);
  });

  it('treats empty strings as missing', () => {
    expect(splitConnectionParams(specs, { rate: '', host: 'h' }).primary.map((s) => s.id)).toEqual([
      'rate',
    ]);
  });
});

describe('port and identity rows', () => {
  const remembered = savedSource({
    id: 'r1',
    name: 'Bench',
    label: 'SA S1',
    config: { ...emptyConfig('sa430'), deviceId: 'S1', connection: { port: '/dev/ttyACM0' } },
  });
  const scan = (devices: ReturnType<typeof device>[], error: string | null = null) => ({
    results: [{ driverId: 'sa430', devices, error }],
    scanned: true,
    scanning: false,
  });

  it('a renamed device replugged on another port is one row with the new port and old name', () => {
    const m = menuModel(
      [remembered],
      scan([device('S1', 'Dev S1', '/dev/ttyACM5')]),
      drivers,
      null,
    );
    expect(m.detected).toEqual([]);
    expect(m.yours).toHaveLength(1);
    expect(m.yours[0]).toMatchObject({ title: 'Bench', port: '/dev/ttyACM5', presence: 'present' });
  });

  it('falls back to the stored port hint when the device is not in the scan', () => {
    const m = menuModel([remembered], scan([]), drivers, null);
    expect(m.yours[0]).toMatchObject({ port: '/dev/ttyACM0', presence: 'absent' });
  });

  it('shows a detected, not remembered device once, with its location', () => {
    const m = menuModel(
      [remembered],
      scan([device('S1'), device('S2', 'Dev S2', '/dev/ttyACM1')]),
      drivers,
      null,
    );
    expect(m.detected.map((d) => [d.key, d.port])).toEqual([['sa430/S2', '/dev/ttyACM1']]);
  });

  it('presence is unknown when the scan failed', () => {
    const m = menuModel([remembered], scan([], 'no udev'), drivers, null);
    expect(m.yours[0]!.presence).toBe('unknown');
    expect(m.scanErrors).toEqual([{ driverId: 'sa430', error: 'no udev' }]);
  });
});

describe('isActiveBusy', () => {
  it('locks only the active entry while a session operation holds the connection', () => {
    expect(isActiveBusy('connected', null, 'a', 'a')).toBe(true);
    expect(isActiveBusy('acquiring', null, 'a', 'a')).toBe(true);
    expect(isActiveBusy('connecting', null, 'a', 'a')).toBe(true);
    expect(isActiveBusy('disconnecting', null, 'a', 'a')).toBe(true);
    expect(isActiveBusy('disconnected', 'connecting', 'a', 'a')).toBe(true);
    expect(isActiveBusy('disconnected', null, 'a', 'a')).toBe(false);
    expect(isActiveBusy(null, null, 'a', 'a')).toBe(false);
    expect(isActiveBusy('connected', null, 'a', 'b')).toBe(false);
    expect(isActiveBusy('connected', null, null, 'a')).toBe(false);
  });
});

describe('dialogDrivers and defaultName', () => {
  it('dialogDrivers equals otherDrivers', () => {
    expect(dialogDrivers(drivers).map((d) => d.id)).toEqual(['net']);
    expect(otherDrivers).toBe(dialogDrivers);
  });
  it('defaultName is the trimmed device label', () => {
    expect(defaultName({ label: ' SA430 S1 ' })).toBe('SA430 S1');
  });
});
