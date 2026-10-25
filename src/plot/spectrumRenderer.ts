import type { Peak } from '../bindings/Peak';
import { formatFrequency, formatLevel } from '../format/frequency';
import type { DecodedFrame } from '../ipc/frame';
import type { FrequencyView, Marker } from '../state/view';
import { tracePoints, valueAt } from './envelope';
import { linearScale, ticks, type LinearScale } from './scale';
import { PLOT_INSETS, PLOT_THEME as T } from './theme';

export interface SpectrumDrawOptions {
  /** Size in CSS pixels; the context is already scaled for the device pixel ratio. */
  width: number;
  height: number;
  frame: DecodedFrame | null;
  view: FrequencyView;
  referenceLevel: number;
  rangeDb: number;
  unit: string;
  /** False when the data is not current (stopped or stale): traces are drawn dimmed. */
  live: boolean;
  markers: readonly Marker[];
  activeMarker: number | null;
  selectedPeakHz: number | null;
  hover: { x: number; y: number } | null;
}

export interface PlotGeometry {
  left: number;
  top: number;
  right: number;
  bottom: number;
  x: LinearScale;
  y: LinearScale;
}

export function plotGeometry(
  width: number,
  height: number,
  view: FrequencyView,
  referenceLevel: number,
  rangeDb: number,
): PlotGeometry {
  const left = PLOT_INSETS.left;
  const top = PLOT_INSETS.top;
  const right = Math.max(left + 1, width - PLOT_INSETS.right);
  const bottom = Math.max(top + 1, height - PLOT_INSETS.bottom);
  return {
    left,
    top,
    right,
    bottom,
    x: linearScale(view.startHz, view.endHz, left, right),
    y: linearScale(referenceLevel - rangeDb, referenceLevel, bottom, top),
  };
}

export function drawSpectrum(ctx: CanvasRenderingContext2D, o: SpectrumDrawOptions): PlotGeometry {
  const g = plotGeometry(o.width, o.height, o.view, o.referenceLevel, o.rangeDb);
  ctx.fillStyle = T.background;
  ctx.fillRect(0, 0, o.width, o.height);
  ctx.fillStyle = T.plotBackground;
  ctx.fillRect(g.left, g.top, g.right - g.left, g.bottom - g.top);

  drawGrid(ctx, g, o.unit);

  ctx.save();
  ctx.beginPath();
  ctx.rect(g.left, g.top, g.right - g.left, g.bottom - g.top);
  ctx.clip();
  if (o.frame) {
    drawTraces(ctx, g, o);
    drawPeaks(ctx, g, o.frame.header.peaks, o.selectedPeakHz);
    drawMarkers(ctx, g, o);
  }
  ctx.restore();

  if (o.hover) drawCrosshair(ctx, g, o);
  return g;
}

function drawGrid(ctx: CanvasRenderingContext2D, g: PlotGeometry, unit: string) {
  const plotWidth = g.right - g.left;
  const plotHeight = g.bottom - g.top;
  const fTicks = ticks(g.x.d0, g.x.d1, Math.max(2, Math.floor(plotWidth / 110)));
  const aTicks = ticks(g.y.d0, g.y.d1, Math.max(2, Math.floor(plotHeight / 36)));

  ctx.lineWidth = 1;
  ctx.font = T.font;
  ctx.fillStyle = T.axisText;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (const f of fTicks.values) {
    const x = Math.round(g.x.map(f)) + 0.5;
    ctx.strokeStyle = T.grid;
    line(ctx, x, g.top, x, g.bottom);
    const label = formatFrequency(f, fTicks.step);
    // Keep edge labels inside the canvas.
    const half = ctx.measureText(label).width / 2;
    const lx = Math.min(g.right + PLOT_INSETS.right - half - 2, Math.max(half + 2, x));
    ctx.fillText(label, lx, g.bottom + 6);
  }

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (const a of aTicks.values) {
    const y = Math.round(g.y.map(a)) + 0.5;
    ctx.strokeStyle = a === 0 ? T.gridStrong : T.grid;
    line(ctx, g.left, y, g.right, y);
    ctx.fillText(String(a), g.left - 6, y);
  }

  ctx.save();
  ctx.translate(14, (g.top + g.bottom) / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText(unit, 0, 0);
  ctx.restore();

  ctx.strokeStyle = T.gridStrong;
  ctx.strokeRect(g.left + 0.5, g.top + 0.5, g.right - g.left - 1, g.bottom - g.top - 1);
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function tracePath(
  ctx: CanvasRenderingContext2D,
  g: PlotGeometry,
  points: { x: Float32Array; y: Float32Array },
) {
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i < points.x.length; i++) {
    const v = points.y[i]!;
    if (Number.isNaN(v)) {
      pen = false;
      continue;
    }
    const x = g.left + points.x[i]!;
    const y = g.y.map(v);
    if (pen) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
    pen = true;
  }
}

function drawTraces(ctx: CanvasRenderingContext2D, g: PlotGeometry, o: SpectrumDrawOptions) {
  const frame = o.frame!;
  const width = Math.max(1, Math.floor(g.right - g.left));
  const points = (trace: Float32Array) =>
    tracePoints(trace, frame.header, o.view.startHz, o.view.endHz, width);

  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  if (frame.minHold) {
    ctx.strokeStyle = T.minHold;
    tracePath(ctx, g, points(frame.minHold));
    ctx.stroke();
  }
  if (frame.maxHold) {
    ctx.strokeStyle = T.maxHold;
    tracePath(ctx, g, points(frame.maxHold));
    ctx.stroke();
  }

  const live = points(frame.live);
  if (o.live) {
    tracePath(ctx, g, live);
    ctx.lineTo(g.right, g.bottom);
    ctx.lineTo(g.left, g.bottom);
    ctx.closePath();
    ctx.fillStyle = T.liveFill;
    ctx.fill();
  }
  ctx.strokeStyle = o.live ? T.liveTrace : T.staleTrace;
  ctx.lineWidth = 1.25;
  tracePath(ctx, g, live);
  ctx.stroke();
}

function drawPeaks(
  ctx: CanvasRenderingContext2D,
  g: PlotGeometry,
  peaks: readonly Peak[],
  selectedHz: number | null,
) {
  ctx.font = T.font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  // Peaks arrive strongest first; weaker peaks' labels are skipped where they would overlap.
  const labels: { x0: number; x1: number; y0: number; y1: number }[] = [];
  peaks.forEach((p, i) => {
    const x = g.x.map(p.frequencyHz);
    const y = g.y.map(p.amplitude) - 4;
    if (x < g.left || x > g.right) return;
    const selected = selectedHz !== null && Math.abs(selectedHz - p.frequencyHz) < 1e-3;
    ctx.fillStyle = selected ? T.markerActive : T.peak;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x - 4, y - 7);
    ctx.lineTo(x + 4, y - 7);
    ctx.closePath();
    ctx.fill();
    const text = `P${i + 1}`;
    const half = ctx.measureText(text).width / 2 + 2;
    const box = { x0: x - half, x1: x + half, y0: y - 22, y1: y - 9 };
    const overlaps = labels.some(
      (b) => box.x0 < b.x1 && box.x1 > b.x0 && box.y0 < b.y1 && box.y1 > b.y0,
    );
    if (selected || !overlaps) {
      labels.push(box);
      ctx.fillText(text, x, y - 9);
    }
  });
}

function drawMarkers(ctx: CanvasRenderingContext2D, g: PlotGeometry, o: SpectrumDrawOptions) {
  const frame = o.frame!;
  ctx.font = T.font;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  for (const m of o.markers) {
    const x = g.x.map(m.frequencyHz);
    if (x < g.left || x > g.right) continue;
    const level = valueAt(frame.live, frame.header, m.frequencyHz);
    const active = m.id === o.activeMarker;
    const color = active ? T.markerActive : T.marker;
    ctx.strokeStyle = color;
    ctx.setLineDash([3, 4]);
    line(ctx, Math.round(x) + 0.5, g.top, Math.round(x) + 0.5, g.bottom);
    ctx.setLineDash([]);
    if (!Number.isNaN(level)) {
      const y = g.y.map(level);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 5, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillText(`M${m.id}`, x + 7, y - 4);
    }
  }
}

function drawCrosshair(ctx: CanvasRenderingContext2D, g: PlotGeometry, o: SpectrumDrawOptions) {
  const { x, y } = o.hover!;
  if (x < g.left || x > g.right || y < g.top || y > g.bottom) return;
  ctx.strokeStyle = T.crosshair;
  ctx.lineWidth = 1;
  line(ctx, Math.round(x) + 0.5, g.top, Math.round(x) + 0.5, g.bottom);
  line(ctx, g.left, Math.round(y) + 0.5, g.right, Math.round(y) + 0.5);

  const hz = g.x.invert(x);
  const resolution = (g.x.d1 - g.x.d0) / (g.right - g.left);
  const lines = [formatFrequency(hz, resolution), `cursor ${formatLevel(g.y.invert(y), o.unit)}`];
  if (o.frame) {
    lines.push(`trace ${formatLevel(valueAt(o.frame.live, o.frame.header, hz), o.unit)}`);
  }
  ctx.font = T.monoFont;
  const boxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 12;
  const boxHeight = lines.length * 15 + 8;
  const bx = x + boxWidth + 14 > g.right ? x - boxWidth - 10 : x + 10;
  const by = Math.max(g.top + 4, Math.min(y + 10, g.bottom - boxHeight - 4));
  ctx.fillStyle = T.readoutBackground;
  ctx.fillRect(bx, by, boxWidth, boxHeight);
  ctx.fillStyle = T.readoutText;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, bx + 6, by + 5 + i * 15));
}
