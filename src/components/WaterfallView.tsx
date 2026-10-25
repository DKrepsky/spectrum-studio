import { useEffect, useRef, useState } from 'react';

import { buildLut, levelIndex } from '../plot/colormap';
import { columnEnvelope } from '../plot/envelope';
import { PLOT_INSETS, PLOT_THEME } from '../plot/theme';
import { frameStore } from '../state/frames';
import { useView } from '../state/view';
import { currentView } from './SpectrumView';
import { useCanvasSize } from './useCanvasSize';

/**
 * Scrolling spectrogram: one row per received frame, newest at the top, using the same
 * frequency view and amplitude range as the spectrum plot. History is cleared when the view,
 * colour scale or size changes, so rows are never shown on a mismatched axis.
 */
const TICK_SPACING_PX = 48;

interface TimeTick {
  y: number;
  label: string;
}

/** Time labels for rows at regular heights, relative to the newest row. */
export function timeTicks(
  rowTimesMs: readonly number[],
  heightPx: number,
  dpr: number,
): TimeTick[] {
  const newest = rowTimesMs[0];
  if (newest === undefined) return [];
  const ticks: TimeTick[] = [];
  for (let y = TICK_SPACING_PX; y < heightPx - 8; y += TICK_SPACING_PX) {
    const t = rowTimesMs[Math.round(y * dpr)];
    if (t === undefined) break;
    const age = (newest - t) / 1000;
    ticks.push({ y, label: `−${age < 10 ? age.toFixed(1) : age.toFixed(0)} s` });
  }
  return ticks;
}

export function WaterfallView() {
  const { containerRef, canvasRef, size } = useCanvasSize();
  /** Frame timestamps of the rows on screen, newest first (one entry per device-pixel row). */
  const rowTimes = useRef<number[]>([]);
  const [ticks, setTicks] = useState<TimeTick[]>([]);

  useEffect(() => {
    const id = window.setInterval(
      () => setTicks(timeTicks(rowTimes.current, size.height, size.dpr)),
      500,
    );
    return () => window.clearInterval(id);
  }, [size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || size.width === 0) return;
    const width = canvas.width;
    const height = canvas.height;
    const row = ctx.createImageData(width, 1);
    const pixels = new Uint32Array(row.data.buffer);
    const columns = new Float32Array(width);
    let lut = buildLut(useView.getState().palette);
    let lastSeq = -1;
    let viewKey = '';
    let pendingRow = false;

    const times = rowTimes.current;
    const clear = () => {
      ctx.fillStyle = PLOT_THEME.plotBackground;
      ctx.fillRect(0, 0, width, height);
      times.length = 0;
    };
    clear();

    const keyOf = () => {
      const v = currentView();
      const s = useView.getState();
      return `${v.startHz}:${v.endHz}:${s.referenceLevel}:${s.rangeDb}:${s.palette}`;
    };

    const addRow = () => {
      const frame = frameStore.latest;
      if (!frame || frame.header.seq === lastSeq) return;
      lastSeq = frame.header.seq;
      const key = keyOf();
      if (key !== viewKey) {
        viewKey = key;
        lut = buildLut(useView.getState().palette);
        clear();
      }
      const v = currentView();
      const { referenceLevel, rangeDb } = useView.getState();
      columnEnvelope(frame.live, frame.header, v.startHz, v.endHz, width, columns);
      for (let x = 0; x < width; x++) {
        pixels[x] = lut[levelIndex(columns[x]!, referenceLevel, rangeDb)]!;
      }
      // Scroll the existing image down by one row, then draw the new row at the top.
      ctx.drawImage(canvas, 0, 0, width, height - 1, 0, 1, width, height - 1);
      ctx.putImageData(row, 0, 0);
      times.unshift(frame.header.timestampMs);
      if (times.length > height) times.length = height;
    };

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (pendingRow) {
        pendingRow = false;
        addRow();
      }
    };
    raf = requestAnimationFrame(tick);
    const unsubscribeFrames = frameStore.subscribe((frame) => {
      if (frame) pendingRow = true;
      else {
        clear();
        lastSeq = -1;
      }
    });
    const unsubscribeView = useView.subscribe(() => {
      if (keyOf() !== viewKey) {
        viewKey = keyOf();
        lut = buildLut(useView.getState().palette);
        clear();
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      unsubscribeFrames();
      unsubscribeView();
    };
  }, [size, canvasRef]);

  return (
    <div className="waterfall">
      <div className="waterfall-axis" style={{ width: PLOT_INSETS.left }}>
        <span className="waterfall-axis-title">Time ↓</span>
        {ticks.map((t) => (
          <span key={t.y} className="waterfall-tick" style={{ top: t.y }}>
            {t.label}
          </span>
        ))}
      </div>
      <div
        className="plot waterfall-plot"
        ref={containerRef}
        style={{ marginRight: PLOT_INSETS.right }}
      >
        <canvas ref={canvasRef} data-testid="waterfall-canvas" role="img" aria-label="Waterfall" />
      </div>
    </div>
  );
}
