import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { startFramePump } from './framePump';
import { FrameStore } from './frames';

function fixture(): ArrayBuffer {
  const bytes = readFileSync(resolve(process.cwd(), 'src/ipc/__fixtures__/frame-v1.bin'));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('startFramePump', () => {
  it('publishes decoded frames and asks for newer ones', async () => {
    const store = new FrameStore();
    const calls: number[] = [];
    let served = false;
    const nextFrame = vi.fn((after: number) => {
      calls.push(after);
      if (!served) {
        served = true;
        return Promise.resolve(fixture());
      }
      return new Promise<ArrayBuffer>((r) => setTimeout(() => r(new ArrayBuffer(0)), 5));
    });
    const stop = startFramePump({ nextFrame, store, onError: vi.fn() });
    await vi.waitFor(() => expect(calls).toContain(7));
    stop();
    expect(store.latest?.header.seq).toBe(7);
    expect(calls[0]).toBe(0);
  });

  it('reports decode errors and keeps running', async () => {
    vi.useFakeTimers();
    const store = new FrameStore();
    const onError = vi.fn();
    const nextFrame = vi.fn(() => Promise.resolve(new ArrayBuffer(2)));
    const stop = startFramePump({ nextFrame, store, onError });
    await vi.advanceTimersByTimeAsync(1100);
    stop();
    vi.useRealTimers();
    expect(onError).toHaveBeenCalledWith('Frame is truncated.');
    expect(nextFrame.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(store.latest).toBeNull();
  });
});
