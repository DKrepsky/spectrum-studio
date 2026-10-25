import type { SourceKind } from '../../bindings/SourceKind';
import type { Transport } from '../../bindings/Transport';

export const KIND_LABEL: Record<SourceKind, string> = {
  simulator: 'Simulation',
  sdr: 'Software-defined radios',
  spectrumAnalyzer: 'Spectrum analyzers',
  file: 'Files & recordings',
};

export const TRANSPORT_LABEL: Record<Transport, string> = {
  usb: 'USB',
  serial: 'Serial',
  network: 'Network',
  file: 'File',
  internal: 'Built-in',
};

export const KIND_ORDER: SourceKind[] = ['simulator', 'file', 'sdr', 'spectrumAnalyzer'];
