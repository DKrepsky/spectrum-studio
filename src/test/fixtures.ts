import type { ActiveSource } from '../bindings/ActiveSource';
import type { SavedSource } from '../bindings/SavedSource';
import type { DeviceDescriptor } from '../bindings/DeviceDescriptor';
import type { DriverInfo } from '../bindings/DriverInfo';
import type { ProcessingSettings } from '../bindings/ProcessingSettings';
import type { SessionStatus } from '../bindings/SessionStatus';
import { emptyConfig } from '../state/sourceConfig';

export const processing: ProcessingSettings = {
  fftSize: 4096,
  window: 'hann',
  averaging: 1,
  maxHold: false,
  minHold: false,
  peaks: { enabled: true, maxCount: 8, minProminenceDb: 6, minExcessDb: 15, threshold: null },
};

export const simulatorDriver: DriverInfo = {
  id: 'simulator',
  name: 'Signal simulator',
  description: 'Built-in',
  kind: 'simulator',
  transport: 'internal',
  status: 'available',
  supportsDiscovery: true,
  connectionParams: [
    {
      id: 'failConnect',
      label: 'Fail to connect',
      group: 'Testing',
      help: null,
      kind: { type: 'bool' },
      default: false,
      required: false,
    },
  ],
};

export const fileDriver: DriverInfo = {
  id: 'iq-file',
  name: 'IQ recording',
  description: 'Replays IQ',
  kind: 'file',
  transport: 'file',
  status: 'available',
  supportsDiscovery: false,
  connectionParams: [
    {
      id: 'path',
      label: 'File',
      group: null,
      help: null,
      kind: { type: 'path', extensions: ['cf32'] },
      default: '',
      required: true,
    },
  ],
};

export const plannedDriver: DriverInfo = {
  id: 'soapysdr',
  name: 'SoapySDR devices',
  description: 'Planned',
  kind: 'sdr',
  transport: 'usb',
  status: 'planned',
  supportsDiscovery: false,
  connectionParams: [],
};

export const activeSimulator: ActiveSource = {
  config: emptyConfig('simulator'),
  driverName: 'Signal simulator',
  deviceLabel: 'Signal simulator',
  kind: 'simulator',
  transport: 'internal',
  simulated: true,
  capabilities: {
    dataKind: 'iq',
    tuning: { minHz: 0, maxHz: 6e9 },
    spanOptionsHz: [1.024e6, 2.048e6],
    amplitudeUnit: 'dbfs',
    finite: false,
    params: [],
  },
  settings: { centerHz: 100e6, spanHz: 2.048e6, params: {} },
};

export function status(overrides: Partial<SessionStatus> = {}): SessionStatus {
  return {
    revision: 1,
    state: 'disconnected',
    source: null,
    lastNotice: null,
    lastConfig: null,
    processing,
    ...overrides,
  };
}

export function savedSource(overrides: Partial<SavedSource> = {}): SavedSource {
  return {
    id: 'src-1',
    name: '',
    label: 'Signal simulator',
    config: emptyConfig('simulator'),
    createdMs: 1,
    updatedMs: 1,
    lastUsedMs: 1,
    ...overrides,
  };
}

export const SA430_SERIAL = '08FF41E50F8B3A34';
export const OTHER_SA430_SERIAL = 'B7C100A2E9D41F05';

/** The SA430 as the backend exposes it: USB, discoverable, one serial-port parameter. */
export const sa430Driver: DriverInfo = {
  id: 'sa430',
  name: 'SA430 spectrum analyzer',
  description: 'TI SA430',
  kind: 'spectrumAnalyzer',
  transport: 'usb',
  status: 'available',
  supportsDiscovery: true,
  connectionParams: [
    {
      id: 'port',
      label: 'Serial port',
      group: null,
      help: "Path of the device's serial port, for example /dev/ttyACM0.",
      kind: { type: 'text', maxLength: 256 },
      default: '',
      required: false,
    },
  ],
};

export function sa430Device(
  deviceId = SA430_SERIAL,
  location: string | null = '/dev/ttyACM0',
): DeviceDescriptor {
  return {
    driverId: 'sa430',
    deviceId,
    label: `SA430 ${deviceId}`,
    location,
    details: [['Serial', deviceId]],
  };
}
