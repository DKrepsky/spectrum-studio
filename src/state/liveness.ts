import { useEffect, useState } from 'react';

import type { CaptureMode } from '../bindings/CaptureMode';
import type { SessionState } from '../bindings/SessionState';
import type { DecodedFrame } from '../ipc/frame';

/** A frame older than this while acquiring is considered stale. */
export const STALE_AFTER_MS = 2000;

export type LivenessKind = 'live' | 'waiting' | 'stale' | 'stopped' | 'noSource' | 'capturing';

export interface Liveness {
  kind: LivenessKind;
  /** Short label shown on the plot. */
  label: string;
}

function clock(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString(undefined, { hour12: false });
}

/**
 * Decides whether the displayed data is current. Data is only "live" while the backend reports
 * continuous acquisition and frames keep arriving; anything else is labelled so old traces are never
 * mistaken for current measurements. A single capture is acquiring until its one sweep lands, so it
 * is always `capturing` (never stale, never LIVE).
 */
export function liveness(
  state: SessionState | undefined,
  frame: DecodedFrame | null,
  now: number,
  mode: CaptureMode | undefined,
): Liveness {
  if (state === 'acquiring' && mode === 'single') {
    return { kind: 'capturing', label: 'CAPTURING' };
  }
  if (state === 'acquiring') {
    if (!frame) return { kind: 'waiting', label: 'Waiting for data…' };
    const age = now - frame.receivedAt;
    if (age > STALE_AFTER_MS) {
      return { kind: 'stale', label: `No data for ${Math.floor(age / 1000)} s` };
    }
    return { kind: 'live', label: 'LIVE' };
  }
  if (frame) {
    return { kind: 'stopped', label: `HOLD · last data ${clock(frame.header.timestampMs)}` };
  }
  return {
    kind: state === 'connected' ? 'stopped' : 'noSource',
    label: state === 'connected' ? 'Stopped' : 'No source connected',
  };
}

/** Re-evaluates liveness periodically so staleness is detected without new frames. */
export function useLiveness(
  state: SessionState | undefined,
  frame: DecodedFrame | null,
  mode: CaptureMode | undefined,
): Liveness {
  const [now, setNow] = useState(() => performance.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(performance.now()), 250);
    return () => window.clearInterval(id);
  }, []);
  return liveness(state, frame, Math.max(now, frame?.receivedAt ?? 0), mode);
}
