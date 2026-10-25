import { decodeFrame } from '../ipc/frame';
import type { FrameStore } from './frames';

export interface FramePumpDeps {
  nextFrame: (afterSeq: number) => Promise<ArrayBuffer>;
  store: FrameStore;
  onError: (message: string) => void;
}

/**
 * Pulls frames from the backend in a loop. Each request long-polls for a frame newer than the
 * last one seen, so the backend never queues frames the UI has not asked for (latest wins).
 * Returns a function that stops the loop.
 */
export function startFramePump({ nextFrame, store, onError }: FramePumpDeps): () => void {
  let running = true;
  // Read through a function so the flag is re-checked after each `await`.
  const isRunning = () => running;
  let lastSeq = 0;

  const loop = async () => {
    while (isRunning()) {
      try {
        const frame = decodeFrame(await nextFrame(lastSeq));
        if (!isRunning()) break;
        if (frame) {
          lastSeq = frame.header.seq;
          store.publish(frame);
        }
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error));
        // Back off briefly so a persistent failure does not spin the CPU.
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }
  };
  void loop();
  return () => {
    running = false;
  };
}
