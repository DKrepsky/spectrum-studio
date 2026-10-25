import type { DecodedFrame } from '../ipc/frame';

type Listener = (frame: DecodedFrame | null) => void;

/**
 * Holds the latest frame outside React state. Canvases subscribe and redraw on their own
 * animation frames, so high-rate data never triggers React re-renders.
 */
export class FrameStore {
  private current: DecodedFrame | null = null;
  private readonly listeners = new Set<Listener>();
  private readonly arrivals: number[] = [];

  get latest(): DecodedFrame | null {
    return this.current;
  }

  /** Frames per second over the last ~2 seconds of arrivals. */
  get rate(): number {
    const a = this.arrivals;
    if (a.length < 2) return 0;
    const newest = a[a.length - 1]!;
    if (performance.now() - newest > 2000) return 0;
    return ((a.length - 1) * 1000) / (newest - a[0]!);
  }

  publish(frame: DecodedFrame): void {
    this.current = frame;
    this.arrivals.push(frame.receivedAt);
    while (this.arrivals.length > 1 && frame.receivedAt - this.arrivals[0]! > 2000) {
      this.arrivals.shift();
    }
    this.listeners.forEach((l) => l(frame));
  }

  /** Drops the current frame, e.g. when switching sources. */
  clear(): void {
    this.current = null;
    this.arrivals.length = 0;
    this.listeners.forEach((l) => l(null));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const frameStore = new FrameStore();
