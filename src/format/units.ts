import type { AmplitudeUnit } from '../bindings/AmplitudeUnit';

export const UNIT_SYMBOL: Record<AmplitudeUnit, string> = { dbfs: 'dBFS', dbm: 'dBm', db: 'dB' };

export const UNIT_DESCRIPTION: Record<AmplitudeUnit, string> = {
  dbfs: 'Relative to converter full scale (uncalibrated)',
  dbm: 'Absolute power, calibrated by the instrument',
  db: 'Relative level, unknown reference (uncalibrated)',
};
