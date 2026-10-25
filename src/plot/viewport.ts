import type { FrameHeader } from '../bindings/FrameHeader';
import type { FrequencyView } from '../state/view';

/** Full frequency extent of a frame: centre ± span / 2. */
export function fullView(header: Pick<FrameHeader, 'centerHz' | 'spanHz'>): FrequencyView {
  return {
    startHz: header.centerHz - header.spanHz / 2,
    endHz: header.centerHz + header.spanHz / 2,
  };
}

function clampView(view: FrequencyView, full: FrequencyView, minWidth: number): FrequencyView {
  const fullWidth = full.endHz - full.startHz;
  const width = Math.min(fullWidth, Math.max(minWidth, view.endHz - view.startHz));
  let start = view.startHz;
  start = Math.max(full.startHz, Math.min(full.endHz - width, start));
  return { startHz: start, endHz: start + width };
}

/**
 * Zooms by `factor` (< 1 zooms in) keeping `anchorHz` at the same screen position.
 * Returns `null` when the result covers the full span.
 */
export function zoomAt(
  view: FrequencyView,
  full: FrequencyView,
  anchorHz: number,
  factor: number,
  minWidth: number,
): FrequencyView | null {
  const oldWidth = view.endHz - view.startHz;
  const width = Math.min(full.endHz - full.startHz, Math.max(minWidth, oldWidth * factor));
  const anchorFraction = (anchorHz - view.startHz) / oldWidth;
  const startHz = anchorHz - anchorFraction * width;
  const next = clampView({ startHz, endHz: startHz + width }, full, minWidth);
  return isFull(next, full) ? null : next;
}

/** Shifts the view by `deltaHz`, staying inside the full span. */
export function panBy(
  view: FrequencyView,
  full: FrequencyView,
  deltaHz: number,
  minWidth: number,
): FrequencyView | null {
  const next = clampView(
    { startHz: view.startHz + deltaHz, endHz: view.endHz + deltaHz },
    full,
    minWidth,
  );
  return isFull(next, full) ? null : next;
}

function isFull(view: FrequencyView, full: FrequencyView): boolean {
  const tolerance = (full.endHz - full.startHz) * 1e-9;
  return view.startHz - full.startHz <= tolerance && full.endHz - view.endHz <= tolerance;
}
