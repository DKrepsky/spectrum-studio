import type { CaptureMode } from '../bindings/CaptureMode';
import type { FrameHeader } from '../bindings/FrameHeader';
import type { SessionState } from '../bindings/SessionState';
import { formatFrequency, formatLevel } from '../format/frequency';
import { formatFrameRate } from '../format/rate';
import { UNIT_DESCRIPTION, UNIT_SYMBOL } from '../format/units';
import { frameStore } from '../state/frames';
import { selectStartup, useSession } from '../state/session';
import { useFrameTick } from '../state/useFrameTick';
import { StatusStrip, type MeasureFn, type StatusItem } from '../ui/StatusStrip';

const WINDOW_LABEL = {
  hann: 'Hann',
  rectangular: 'Rectangular',
  blackmanHarris: 'Blackman-Harris',
  flatTop: 'Flat top',
};

/** What the status bar says while there is no frame yet, in the words of the running mode. */
function noDataText(
  connected: boolean,
  state: SessionState | undefined,
  mode: CaptureMode | undefined,
): string {
  if (!connected) return 'No source connected.';
  if (state === 'acquiring') {
    return mode === 'single'
      ? 'Capturing one sweep…'
      : 'No data yet — waiting for the first sweep.';
  }
  return mode === 'single'
    ? 'No data yet — press Single for one sweep.'
    : 'No data yet — press Continuous to start acquisition.';
}

/**
 * The items of the frame on screen, in display order. `dropOrder` is the removal order when the bar
 * is too narrow (DESIGN.md 3.4, Q-1): Frame first, RBW last. Center, Span, Unit and Uncalibrated are
 * pinned: they are never removed.
 */
export function frameItems(h: FrameHeader, rate: number): StatusItem[] {
  const items: StatusItem[] = [
    { id: 'center', label: 'Center', value: formatFrequency(h.centerHz, h.binHz / 10) },
    { id: 'span', label: 'Span', value: formatFrequency(h.spanHz, 1000) },
  ];
  if (h.rbwHz !== null) {
    items.push({
      id: 'rbw',
      label: 'RBW',
      value: formatFrequency(h.rbwHz, 1),
      title: 'Equivalent noise bandwidth of one bin',
      dropOrder: 6,
    });
  }
  if (h.fftSize !== null) {
    items.push({
      id: 'fft',
      label: 'FFT',
      value: `${h.fftSize} · ${h.window ? WINDOW_LABEL[h.window] : ''}`,
      dropOrder: 4,
    });
  } else {
    // A source without an FFT reports its point count in the same slot.
    items.push({ id: 'points', label: 'Points', value: String(h.bins), dropOrder: 4 });
  }
  items.push({ id: 'avg', label: 'Avg', value: `${h.averagedCount}/${h.averaging}`, dropOrder: 5 });
  if (h.noiseFloor !== null) {
    items.push({
      id: 'noise-floor',
      label: 'Noise floor',
      value: `${formatLevel(h.noiseFloor, UNIT_SYMBOL[h.unit])}/bin`,
      title: 'Median level of the live trace',
      dropOrder: 3,
    });
  }
  items.push({
    id: 'unit',
    label: 'Unit',
    value: UNIT_SYMBOL[h.unit],
    title: UNIT_DESCRIPTION[h.unit],
  });
  items.push({ id: 'rate', label: 'Rate', value: formatFrameRate(rate), dropOrder: 2 });
  items.push({
    id: 'frame',
    label: 'Frame',
    value: `#${h.seq} · ${new Date(h.timestampMs).toLocaleTimeString(undefined, { hour12: false })}`,
    dropOrder: 1,
  });
  if (h.unit !== 'dbm') {
    items.push({
      id: 'uncalibrated',
      value: <span className="status-uncalibrated">Uncalibrated</span>,
      title: UNIT_DESCRIPTION[h.unit],
      align: 'end',
    });
  }
  return items;
}

interface StatusBarProps {
  /** Overrides the overflow check (tests only). */
  measure?: MeasureFn;
}

/** Settings and statistics of the frame on screen, always those that produced it (DESIGN.md 3.4). */
export function StatusBar({ measure }: StatusBarProps) {
  const frame = useFrameTick(500);
  const source = useSession((s) => s.status?.source);
  const state = useSession((s) => s.status?.state);
  const mode = useSession((s) => s.status?.captureMode);
  const startup = useSession(selectStartup);
  // During start-up (and when the backend is silent) the bar is empty: nothing is known yet (S0, S12).
  const items = frame
    ? frameItems(frame.header, frameStore.rate)
    : startup !== 'ready'
      ? []
      : [{ id: 'no-data', value: noDataText(source != null, state, mode) }];
  return (
    <footer className="status-bar" data-testid="status-bar">
      <StatusStrip items={items} measure={measure} />
    </footer>
  );
}
