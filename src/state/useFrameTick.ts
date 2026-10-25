import { useEffect, useState } from 'react';

import type { DecodedFrame } from '../ipc/frame';
import { frameStore } from './frames';

/**
 * Returns the latest frame, re-rendering at most every `intervalMs`. For text readouts that do
 * not need the full frame rate.
 */
export function useFrameTick(intervalMs = 250): DecodedFrame | null {
  const [frame, setFrame] = useState(frameStore.latest);
  useEffect(() => {
    let pending = false;
    const unsubscribe = frameStore.subscribe(() => {
      pending = true;
    });
    const id = window.setInterval(() => {
      if (pending) {
        pending = false;
        setFrame(frameStore.latest);
      }
    }, intervalMs);
    const unsubscribeClear = frameStore.subscribe((f) => {
      if (!f) setFrame(null);
    });
    return () => {
      unsubscribe();
      unsubscribeClear();
      window.clearInterval(id);
    };
  }, [intervalMs]);
  return frame;
}
