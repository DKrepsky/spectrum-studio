import { useEffect, useRef } from 'react';

import type { CaptureMode } from '../bindings/CaptureMode';
import type { SessionState } from '../bindings/SessionState';
import { formatFrequency } from '../format/frequency';
import { UNIT_SYMBOL } from '../format/units';
import { drawSpectrum, plotGeometry } from '../plot/spectrumRenderer';
import { fullView, panBy, zoomAt } from '../plot/viewport';
import { frameStore } from '../state/frames';
import { useLiveness, type LivenessKind } from '../state/liveness';
import { selectStartup, useSession, type Startup } from '../state/session';
import { useView, type FrequencyView } from '../state/view';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useCanvasSize } from './useCanvasSize';

const FALLBACK_VIEW: FrequencyView = { startHz: 0, endHz: 1e6 };

/** Frequency extent of the data currently shown (or expected), before display zoom. */
export function currentFullView(): FrequencyView {
  const frame = frameStore.latest;
  if (frame) return fullView(frame.header);
  const settings = useSession.getState().status?.source?.settings;
  return settings
    ? fullView({ centerHz: settings.centerHz, spanHz: settings.spanHz })
    : FALLBACK_VIEW;
}

export function currentView(): FrequencyView {
  return useView.getState().zoom ?? currentFullView();
}

function minViewWidth(): number {
  const frame = frameStore.latest;
  return frame ? frame.header.binHz * 8 : 1;
}

/** The state tag's tone per liveness kind (DESIGN.md 4.7): live accent, waiting and stale warn. */
const TAG_TONE: Record<LivenessKind, BadgeTone> = {
  live: 'live',
  waiting: 'waiting',
  stale: 'warn',
  stopped: 'neutral',
  noSource: 'neutral',
  capturing: 'capturing',
};

/**
 * The empty-plot hint: only while there is no trace yet (design.md 5, copy). No hint during start-up
 * (`loading`, `unavailable`); a selected source that is not connected asks for a connect (S13).
 */
export function plotHint(
  startup: Startup,
  state: SessionState | undefined,
  mode: CaptureMode | undefined,
  kind: LivenessKind,
  hasFrame: boolean,
): string | null {
  if (startup !== 'ready') return null;
  if (hasFrame) return null;
  if (state === 'disconnected') return 'Not connected. Use the source button to connect.';
  if (kind === 'capturing') return 'Capturing one sweep…';
  if (state !== 'connected') return null;
  return mode === 'single'
    ? 'No trace yet. Press Single for one sweep.'
    : 'No trace yet. Press Continuous to start acquisition.';
}

export function SpectrumView() {
  const { containerRef, canvasRef, size } = useCanvasSize();
  const state = useSession((s) => s.status?.state);
  const captureMode = useSession((s) => s.status?.captureMode);
  const sourceUnit = useSession((s) => s.status?.source?.capabilities.amplitudeUnit);
  const startup = useSession(selectStartup);
  const deviceLost = useSession((s) => s.status?.lastNotice?.kind === 'deviceLost');
  const live = useLiveness(state, frameStore.latest, captureMode, deviceLost);
  const liveRef = useRef(false);
  const hover = useRef<{ x: number; y: number } | null>(null);
  const dirty = useRef(true);

  // Render loop: redraw on the next animation frame whenever something changed.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || size.width === 0) return;
    let raf = 0;
    let axisKey = '';
    const markDirty = () => {
      dirty.current = true;
    };
    const unsubscribeFrames = frameStore.subscribe(markDirty);
    const unsubscribeView = useView.subscribe(markDirty);
    const unsubscribeSession = useSession.subscribe(markDirty);

    const draw = () => {
      raf = requestAnimationFrame(draw);
      if (!dirty.current) return;
      dirty.current = false;
      const frame = frameStore.latest;
      const v = useView.getState();
      const key = frame ? `${frame.header.centerHz}:${frame.header.spanHz}` : axisKey;
      if (key !== axisKey) {
        axisKey = key;
        // The acquisition axis changed (retune, new span): show the whole new span.
        if (v.zoom) v.setZoom(null);
      }
      const unit = frame
        ? frame.header.unit
        : (useSession.getState().status?.source?.capabilities.amplitudeUnit ?? 'dbfs');
      ctx.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
      drawSpectrum(ctx, {
        width: size.width,
        height: size.height,
        frame,
        view: v.zoom ?? currentFullView(),
        referenceLevel: v.referenceLevel,
        rangeDb: v.rangeDb,
        unit: UNIT_SYMBOL[unit],
        live: liveRef.current,
        markers: v.markers,
        activeMarker: v.activeMarker,
        selectedPeakHz: v.selectedPeakHz,
        hover: hover.current,
      });
    };
    dirty.current = true;
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      unsubscribeFrames();
      unsubscribeView();
      unsubscribeSession();
    };
  }, [size, canvasRef]);

  useEffect(() => {
    liveRef.current = live.kind === 'live';
    dirty.current = true;
  }, [live.kind]);

  // Wheel: zoom frequency (over the plot), amplitude range (Ctrl) or reference level (left axis).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const v = useView.getState();
      const g = plotGeometry(rect.width, rect.height, currentView(), v.referenceLevel, v.rangeDb);
      const outward = e.deltaY > 0;
      if (x < g.left) {
        v.setReferenceLevel(v.referenceLevel + (outward ? -5 : 5));
      } else if (e.ctrlKey) {
        v.setRange(v.rangeDb * (outward ? 1.25 : 0.8));
      } else {
        const full = currentFullView();
        v.setZoom(zoomAt(currentView(), full, g.x.invert(x), outward ? 1.25 : 0.8, minViewWidth()));
      }
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [canvasRef]);

  const drag = useRef<{ startX: number; view: FrequencyView; moved: boolean } | null>(null);

  const localPoint = (e: React.PointerEvent | React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, rect };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: localPoint(e).x, view: currentView(), moved: false };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const { x, y, rect } = localPoint(e);
    hover.current = { x, y };
    dirty.current = true;
    const d = drag.current;
    if (!d) return;
    const dx = x - d.startX;
    if (Math.abs(dx) > 3) d.moved = true;
    if (!d.moved) return;
    const v = useView.getState();
    const g = plotGeometry(rect.width, rect.height, d.view, v.referenceLevel, v.rangeDb);
    const hzPerPixel = (d.view.endHz - d.view.startHz) / (g.right - g.left);
    v.setZoom(panBy(d.view, currentFullView(), -dx * hzPerPixel, minViewWidth()));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved || !frameStore.latest) return;
    const { x, y, rect } = localPoint(e);
    const v = useView.getState();
    const g = plotGeometry(rect.width, rect.height, currentView(), v.referenceLevel, v.rangeDb);
    if (x < g.left || x > g.right || y < g.top || y > g.bottom) return;
    const hz = g.x.invert(x);
    if (e.shiftKey) v.addMarker(hz);
    else v.placeMarker(hz);
  };

  const view = useView((s) => s.zoom);
  const hint = plotHint(startup, state, captureMode, live.kind, frameStore.latest !== null);
  const unit = UNIT_SYMBOL[frameStore.latest?.header.unit ?? sourceUnit ?? 'dbfs'];
  const shown = view ?? currentFullView();

  return (
    <div className="plot spectrum-plot" ref={containerRef}>
      <canvas
        ref={canvasRef}
        data-testid="spectrum-canvas"
        role="img"
        aria-label={`Spectrum from ${formatFrequency(shown.startHz, 1000)} to ${formatFrequency(shown.endHz, 1000)} in ${unit}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          hover.current = null;
          dirty.current = true;
        }}
        onDoubleClick={() => useView.getState().setZoom(null)}
      />
      <Badge
        variant="tag"
        tone={TAG_TONE[live.kind]}
        className="plot-tag"
        data-testid="plot-liveness"
        data-kind={live.kind}
      >
        {live.label}
      </Badge>
      {hint && (
        <p className="plot-hint" data-testid="plot-hint">
          {hint}
        </p>
      )}
      {view && (
        <Button
          size="small"
          className="plot-zoom-reset"
          data-testid="plot-zoom-reset"
          onClick={() => useView.getState().setZoom(null)}
        >
          Zoom: {formatFrequency(view.endHz - view.startHz, 100)} · reset
        </Button>
      )}
    </div>
  );
}
