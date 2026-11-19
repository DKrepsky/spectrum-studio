import '../test/mockApi';

import { render, screen } from '@testing-library/react';

import type { FrameHeader } from '../bindings/FrameHeader';
import type { DecodedFrame } from '../ipc/frame';
import { UNIT_DESCRIPTION } from '../format/units';
import { frameStore } from '../state/frames';
import { useSession } from '../state/session';
import { activeSimulator, status } from '../test/fixtures';
import { type MeasureFn } from '../ui/StatusStrip';
import { StatusBar } from './StatusBar';

/** A frame header with every optional item present (dBFS, FFT and noise floor). */
function header(overrides: Partial<FrameHeader> = {}): FrameHeader {
  return {
    version: 3,
    seq: 42,
    timestampMs: Date.UTC(2026, 10, 16, 12, 0, 0),
    sourceLabel: 'Signal simulator',
    simulated: true,
    dataKind: 'iq',
    unit: 'dbfs',
    centerHz: 100e6,
    spanHz: 2e6,
    startHz: 99e6,
    binHz: 1000,
    bins: 2001,
    rbwHz: 1000,
    fftSize: 4096,
    window: 'hann',
    averaging: 4,
    averagedCount: 4,
    traces: ['live'],
    noiseFloor: -92,
    peaks: [],
    ...overrides,
  };
}

function publish(overrides: Partial<FrameHeader> = {}) {
  const frame: DecodedFrame = {
    header: header(overrides),
    live: new Float32Array(0),
    maxHold: null,
    minHold: null,
    receivedAt: performance.now(),
  };
  frameStore.publish(frame);
}

/** The item ids that are rendered, in order. */
function ids(): string[] {
  return [...document.querySelectorAll('[data-item-id]')].map((el) =>
    el.getAttribute('data-item-id')!,
  );
}

/**
 * A stub for the overflow check: the bar holds `available` px, and every rendered item costs its
 * width in `widths`. Mirrors the real check (overflow while the rendered items do not fit).
 */
function fitting(available: number, widths: Record<string, number>): MeasureFn {
  return (strip) => {
    const items = [...strip.querySelectorAll<HTMLElement>('[data-item-id]')];
    const used =
      items.reduce((sum, el) => sum + (widths[el.dataset['itemId'] ?? ''] ?? 100), 0) +
      16 * Math.max(0, items.length - 1);
    return used > available;
  };
}

/**
 * Item widths for the stub, with 16px between items. The full set fits in 1260px (1440 window) and
 * needs a drop at each narrower width, so every window shows a different set.
 */
const WIDTHS: Record<string, number> = {
  center: 140,
  span: 110,
  rbw: 100,
  fft: 160,
  avg: 50,
  'noise-floor': 140,
  unit: 50,
  rate: 80,
  frame: 140,
  uncalibrated: 110,
};

/** The window widths of the regression (DESIGN.md 3.2) and the content width each leaves. */
const WINDOWS = [
  { width: 1024, available: 1024 - 180 },
  { width: 1180, available: 1180 - 180 },
  { width: 1257, available: 1257 - 180 },
  { width: 1440, available: 1440 - 180 },
];

const PINNED = ['center', 'span', 'unit', 'uncalibrated'];
const DROP_ORDER = ['frame', 'rate', 'noise-floor', 'fft', 'avg', 'rbw'];

describe('StatusBar', () => {
  beforeEach(() => {
    frameStore.clear();
    useSession.setState({ status: null, busy: null });
  });

  describe('without a frame', () => {
    it('tells the user to press Continuous when a source is connected but has no data', () => {
      useSession
        .getState()
        .receiveStatus(status({ revision: 1, state: 'connected', source: activeSimulator }));
      render(<StatusBar />);
      expect(screen.getByTestId('status-bar')).toHaveTextContent(
        'No data yet — press Continuous to start acquisition.',
      );
    });

    it('says what a single capture is doing while it runs', () => {
      useSession.getState().receiveStatus(
        status({
          revision: 1,
          state: 'acquiring',
          source: activeSimulator,
          captureMode: 'single',
        }),
      );
      render(<StatusBar />);
      expect(screen.getByTestId('status-bar')).toHaveTextContent('Capturing one sweep…');
    });

    it('asks for one sweep, naming the Single mode, when the next start is a single capture', () => {
      useSession.getState().receiveStatus(
        status({
          revision: 1,
          state: 'connected',
          source: activeSimulator,
          captureMode: 'single',
        }),
      );
      render(<StatusBar />);
      expect(screen.getByTestId('status-bar')).toHaveTextContent(
        'No data yet — press Single for one sweep.',
      );
    });

    it('says that no source is connected when none is selected', () => {
      useSession.getState().receiveStatus(status({ revision: 1 }));
      render(<StatusBar />);
      expect(screen.getByTestId('status-bar')).toHaveTextContent('No source connected.');
    });

    it('is empty during start-up, before the first status (S0)', () => {
      useSession.setState({ status: null, startupFailed: false });
      render(<StatusBar />);
      expect(screen.getByTestId('status-bar').textContent).toBe('');
    });

    it('is empty while the launch connect has not begun (S0), then says no source is connected', () => {
      useSession.getState().receiveStatus(status({ revision: 1, launching: true }));
      const { unmount } = render(<StatusBar />);
      expect(screen.getByTestId('status-bar').textContent).toBe('');
      unmount();
      useSession.getState().receiveStatus(status({ revision: 2, launching: false }));
      render(<StatusBar />);
      expect(screen.getByTestId('status-bar')).toHaveTextContent('No source connected.');
    });

    it('is empty when the backend could not be reached (S12)', () => {
      useSession.setState({ status: null, startupFailed: true });
      render(<StatusBar />);
      expect(screen.getByTestId('status-bar').textContent).toBe('');
    });
  });

  describe('with a frame', () => {
    it('shows every item in display order at 1440px, Uncalibrated included', () => {
      publish();
      render(<StatusBar measure={fitting(1440 - 180, WIDTHS)} />);
      expect(ids()).toEqual([
        'center',
        'span',
        'rbw',
        'fft',
        'avg',
        'noise-floor',
        'unit',
        'rate',
        'frame',
        'uncalibrated',
      ]);
      expect(screen.getByTestId('status-bar')).toHaveTextContent('Uncalibrated');
    });

    it('writes label and value apart: "Center 100.0000 MHz", "Frame #42"', () => {
      publish();
      render(<StatusBar measure={() => false} />);
      const bar = screen.getByTestId('status-bar');
      expect(bar).toHaveTextContent('Center 100.0000 MHz');
      expect(bar).toHaveTextContent(/Frame #42 · \d\d:\d\d:\d\d/);
      expect(bar).toHaveTextContent('Unit dBFS');
    });

    it('shows the point count in the FFT slot when the source has no FFT', () => {
      publish({ fftSize: null, window: null, rbwHz: null, bins: 401 });
      render(<StatusBar measure={() => false} />);
      expect(ids()).toContain('points');
      expect(ids()).not.toContain('rbw');
      expect(screen.getByTestId('status-bar')).toHaveTextContent('Points 401');
    });

    it('does not show Uncalibrated for a calibrated dBm unit', () => {
      publish({ unit: 'dbm' });
      render(<StatusBar measure={() => false} />);
      expect(screen.getByTestId('status-bar')).not.toHaveTextContent('Uncalibrated');
    });

    it('keeps the unit description as a tooltip on the unit and the calibration state', () => {
      publish();
      render(<StatusBar measure={() => false} />);
      const uncalibrated = document.querySelector('[data-item-id="uncalibrated"]')!;
      expect(uncalibrated).toHaveAttribute('title', UNIT_DESCRIPTION.dbfs);
    });

    describe.each(WINDOWS)('at $width px', ({ available }) => {
      it('never removes Center, Span, Unit or Uncalibrated', () => {
        publish();
        render(<StatusBar measure={fitting(available, WIDTHS)} />);
        for (const id of PINNED) expect(ids()).toContain(id);
        expect(screen.getByTestId('status-bar')).toHaveTextContent('Uncalibrated');
      });

      it('removes whole items only, in the decided order (Q-1)', () => {
        publish();
        render(<StatusBar measure={fitting(available, WIDTHS)} />);
        const removed = DROP_ORDER.filter((id) => !ids().includes(id));
        // The removed items are a prefix of the drop order: no gap, no item out of turn.
        expect(removed).toEqual(DROP_ORDER.slice(0, removed.length));
      });
    });

    it('drops Frame first at a narrow width, and keeps Uncalibrated', () => {
      publish();
      render(<StatusBar measure={fitting(1257 - 180, WIDTHS)} />);
      expect(ids()).not.toContain('frame');
      expect(ids()).toContain('uncalibrated');
    });
  });
});
