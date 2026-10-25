import type { Peak } from '../bindings/Peak';
import type { DecodedFrame } from '../ipc/frame';
import type { Marker } from '../state/view';
import { valueAt } from './envelope';

export interface MarkerReading {
  marker: Marker;
  level: number;
  /** Difference to marker 1, when this is not marker 1 and marker 1 exists. */
  delta: { hz: number; db: number } | null;
}

export function readMarkers(
  frame: DecodedFrame | null,
  markers: readonly Marker[],
): MarkerReading[] {
  const level = (m: Marker) =>
    frame ? valueAt(frame.live, frame.header, m.frequencyHz) : Number.NaN;
  const reference = markers.find((m) => m.id === 1);
  const refLevel = reference ? level(reference) : Number.NaN;
  return markers.map((marker) => {
    const l = level(marker);
    return {
      marker,
      level: l,
      delta:
        reference && marker.id !== 1
          ? { hz: marker.frequencyHz - reference.frequencyHz, db: l - refLevel }
          : null,
    };
  });
}

/**
 * Next peak below `currentHz` in amplitude order (peaks are sorted strongest first). Starts at
 * the strongest peak when the marker is not on a peak.
 */
export function nextPeak(
  peaks: readonly Peak[],
  currentHz: number | null,
  toleranceHz: number,
): Peak | null {
  if (peaks.length === 0) return null;
  if (currentHz === null) return peaks[0]!;
  const index = peaks.findIndex((p) => Math.abs(p.frequencyHz - currentHz) <= toleranceHz);
  return index === -1 ? peaks[0]! : (peaks[index + 1] ?? null);
}
