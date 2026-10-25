/** Colours and metrics shared by the canvas renderers (the plots use a fixed dark theme). */
export const PLOT_THEME = {
  background: '#0b1018',
  plotBackground: '#0e1520',
  grid: 'rgba(120, 150, 190, 0.14)',
  gridStrong: 'rgba(120, 150, 190, 0.28)',
  axisText: '#8ea0b8',
  liveTrace: '#3ee0b5',
  liveFill: 'rgba(62, 224, 181, 0.10)',
  staleTrace: '#7a8799',
  maxHold: '#ff9f43',
  minHold: '#5aa9ff',
  peak: '#ffd166',
  marker: '#ff6bcb',
  markerActive: '#ffffff',
  crosshair: 'rgba(220, 230, 245, 0.45)',
  readoutBackground: 'rgba(8, 12, 18, 0.88)',
  readoutText: '#e6edf6',
  font: '11px "Inter", "Cantarell", "Ubuntu", system-ui, sans-serif',
  monoFont: '11px "JetBrains Mono", "DejaVu Sans Mono", ui-monospace, monospace',
} as const;

/** Plot area insets in CSS pixels; the waterfall uses the same horizontal insets to align. */
export const PLOT_INSETS = { left: 64, right: 14, top: 10, bottom: 26 } as const;
