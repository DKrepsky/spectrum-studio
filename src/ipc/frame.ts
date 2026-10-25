import type { FrameHeader } from '../bindings/FrameHeader';
import type { TraceKind } from '../bindings/TraceKind';

/** Binary frame layout version understood by this decoder (see ADR 0003). */
export const FRAME_FORMAT_VERSION = 1;

export interface DecodedFrame {
  header: FrameHeader;
  live: Float32Array;
  maxHold: Float32Array | null;
  minHold: Float32Array | null;
  /** `performance.now()` when the frame was received, for staleness checks. */
  receivedAt: number;
}

export class FrameDecodeError extends Error {
  override name = 'FrameDecodeError';
}

const TRACE_KINDS: readonly TraceKind[] = ['live', 'maxHold', 'minHold'];

function isHeader(value: unknown): value is FrameHeader {
  if (typeof value !== 'object' || value === null) return false;
  const h = value as Record<string, unknown>;
  return (
    typeof h.seq === 'number' &&
    typeof h.bins === 'number' &&
    typeof h.startHz === 'number' &&
    typeof h.binHz === 'number' &&
    typeof h.unit === 'string' &&
    Array.isArray(h.traces) &&
    Array.isArray(h.peaks)
  );
}

/**
 * Decodes a binary frame: `u32 LE header length`, JSON header, padding to 4 bytes, then one
 * little-endian `f32` array of `bins` values per trace listed in `header.traces`.
 * Returns `null` for an empty buffer (poll timeout). Throws `FrameDecodeError` if malformed.
 */
export function decodeFrame(
  buffer: ArrayBuffer,
  receivedAt = performance.now(),
): DecodedFrame | null {
  if (buffer.byteLength === 0) return null;
  if (buffer.byteLength < 4) throw new FrameDecodeError('Frame is truncated.');
  const view = new DataView(buffer);
  const headerLength = view.getUint32(0, true);
  if (4 + headerLength > buffer.byteLength)
    throw new FrameDecodeError('Frame header is truncated.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, headerLength)));
  } catch {
    throw new FrameDecodeError('Frame header is not valid JSON.');
  }
  if (!isHeader(parsed)) throw new FrameDecodeError('Frame header is missing fields.');
  const header = parsed;
  if (header.version !== FRAME_FORMAT_VERSION) {
    throw new FrameDecodeError(`Unsupported frame version ${header.version}.`);
  }
  if (!Number.isInteger(header.bins) || header.bins <= 0) {
    throw new FrameDecodeError('Frame has an invalid number of bins.');
  }
  if (header.traces[0] !== 'live' || header.traces.some((t) => !TRACE_KINDS.includes(t))) {
    throw new FrameDecodeError('Frame has an invalid trace list.');
  }

  const dataStart = Math.ceil((4 + headerLength) / 4) * 4;
  const expected = dataStart + header.traces.length * header.bins * 4;
  if (buffer.byteLength !== expected) {
    throw new FrameDecodeError(
      `Frame payload has ${buffer.byteLength} bytes, expected ${expected}.`,
    );
  }
  // The data offset is 4-byte aligned, so Float32Array views are valid (little-endian hosts).
  const trace = (index: number) =>
    new Float32Array(buffer, dataStart + index * header.bins * 4, header.bins);
  const indexOf = (kind: TraceKind) => header.traces.indexOf(kind);
  const maxIndex = indexOf('maxHold');
  const minIndex = indexOf('minHold');
  return {
    header,
    live: trace(0),
    maxHold: maxIndex >= 0 ? trace(maxIndex) : null,
    minHold: minIndex >= 0 ? trace(minIndex) : null,
    receivedAt,
  };
}

export function frequencyOfBin(header: FrameHeader, bin: number): number {
  return header.startHz + bin * header.binHz;
}

/** Nearest bin for a frequency, clamped to the frame. */
export function binOfFrequency(header: FrameHeader, hz: number): number {
  const bin = Math.round((hz - header.startHz) / header.binHz);
  return Math.min(header.bins - 1, Math.max(0, bin));
}
