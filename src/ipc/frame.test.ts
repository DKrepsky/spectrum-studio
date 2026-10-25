import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { FrameDecodeError, binOfFrequency, decodeFrame, frequencyOfBin } from './frame';

/** Written by the Rust test `model::frame::tests::write_frontend_fixture`. */
function fixture(): ArrayBuffer {
  const bytes = readFileSync(resolve(process.cwd(), 'src/ipc/__fixtures__/frame-v1.bin'));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('decodeFrame', () => {
  it('decodes the frame produced by the Rust encoder', () => {
    const frame = decodeFrame(fixture(), 42);
    expect(frame).not.toBeNull();
    const f = frame!;
    expect(f.receivedAt).toBe(42);
    expect(f.header.seq).toBe(7);
    expect(f.header.unit).toBe('dbfs');
    expect(f.header.traces).toEqual(['live', 'maxHold']);
    expect(Array.from(f.live)).toEqual([-80, -79.5, -20, -81.25]);
    expect(Array.from(f.maxHold!)).toEqual([-70, -70, -19, -70]);
    expect(f.minHold).toBeNull();
    expect(f.header.peaks[0]?.frequencyHz).toBe(100e6);
    expect(frequencyOfBin(f.header, 2)).toBe(100e6);
    expect(binOfFrequency(f.header, 100.2e6)).toBe(2);
    expect(binOfFrequency(f.header, 1e12)).toBe(3);
  });

  it('treats an empty buffer as no frame', () => {
    expect(decodeFrame(new ArrayBuffer(0))).toBeNull();
  });

  it('rejects truncated and corrupted frames', () => {
    const good = fixture();
    expect(() => decodeFrame(good.slice(0, good.byteLength - 4))).toThrow(FrameDecodeError);
    expect(() => decodeFrame(good.slice(0, 2))).toThrow(FrameDecodeError);

    const badJson = good.slice(0);
    new Uint8Array(badJson)[4] = 0x7a; // replace '{'
    expect(() => decodeFrame(badJson)).toThrow(/not valid JSON/);

    const hugeHeader = good.slice(0);
    new DataView(hugeHeader).setUint32(0, 1e9, true);
    expect(() => decodeFrame(hugeHeader)).toThrow(/truncated/);
  });
});
