import '../../test/mockApi';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { SessionStatus } from '../../bindings/SessionStatus';
import type { DecodedFrame } from '../../ipc/frame';
import { frameStore } from '../../state/frames';
import { type BusyOperation, SIMULATOR_CONFIG, useSession } from '../../state/session';
import { useSources } from '../../state/sources';
import { activeSimulator, simulatorDriver, status } from '../../test/fixtures';
import { apiMock } from '../../test/mockApi';
import { CaptureControl } from './CaptureControl';

let revision = 1;

/** Delivers a backend status as the event bridge would (revisions must increase). */
function push(overrides: Partial<SessionStatus>) {
  revision += 1;
  act(() => useSession.getState().receiveStatus(status({ revision, ...overrides })));
}

function main() {
  return screen.getByTestId('acquire-button');
}

function chevron() {
  return screen.getByTestId('capture-mode-button');
}

function liveRegion() {
  return screen.getByTestId('capture-live-region');
}

describe('CaptureControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revision = 1;
    frameStore.clear();
    useSession.setState({ status: null, drivers: [simulatorDriver], busy: null });
    useSources.setState({
      drivers: [simulatorDriver],
      list: [],
      active: { id: null, title: 'Signal simulator', config: SIMULATOR_CONFIG },
    });
  });

  describe('labels, colours and names per state', () => {
    it('shows Continuous, a start icon and the start name when connected and idle', () => {
      push({ state: 'connected', source: activeSimulator, captureMode: 'continuous' });
      render(<CaptureControl />);
      expect(main()).toHaveTextContent('Continuous');
      expect(main()).toHaveAttribute('aria-label', 'Start continuous acquisition');
      expect(main()).toHaveAttribute('title', 'Start continuous acquisition');
      expect(main()).toHaveAttribute('data-mode', 'continuous');
      expect(main()).toHaveAttribute('data-state', 'idle');
      expect(main()).toBeEnabled();
      expect(chevron()).toHaveAttribute('aria-label', 'Capture mode: Continuous');
      expect(chevron()).toHaveAttribute('title', 'Choose capture mode');
      expect(chevron()).toHaveAttribute('aria-haspopup', 'menu');
      expect(chevron()).toHaveAttribute('aria-expanded', 'false');
      expect(chevron()).toBeEnabled();
      expect(chevron()).not.toHaveAttribute('aria-disabled');
    });

    it('shows Single in the purple mode with the single start name and tooltip', () => {
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      render(<CaptureControl />);
      expect(main()).toHaveTextContent('Single');
      expect(main()).toHaveAttribute('aria-label', 'Start single capture');
      expect(main()).toHaveAttribute('title', 'Start single capture: one sweep, then stop');
      expect(main()).toHaveAttribute('data-mode', 'single');
      expect(chevron()).toHaveAttribute('aria-label', 'Capture mode: Single');
    });

    it('draws every capture glyph inside the 12px icon slot, in every state (no state widens it)', () => {
      const states = [
        { state: 'connected', captureMode: 'continuous' },
        { state: 'acquiring', captureMode: 'continuous' },
        { state: 'connected', captureMode: 'single' },
        { state: 'acquiring', captureMode: 'single' },
      ] as const;
      for (const next of states) {
        const { unmount } = (() => {
          push({ source: activeSimulator, ...next });
          return render(<CaptureControl />);
        })();
        const glyphs = [...main().querySelectorAll('svg'), ...chevron().querySelectorAll('svg')];
        expect(glyphs.length).toBeGreaterThan(1);
        for (const glyph of glyphs) {
          expect(Number(glyph.getAttribute('width')), JSON.stringify(next)).toBeLessThanOrEqual(12);
          expect(Number(glyph.getAttribute('height')), JSON.stringify(next)).toBeLessThanOrEqual(
            12,
          );
        }
        unmount();
      }
    });

    it('shows Pause while continuous acquisition runs and locks the chevron', () => {
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'continuous' });
      render(<CaptureControl />);
      expect(main()).toHaveAttribute('aria-label', 'Pause continuous acquisition');
      expect(main()).toHaveAttribute('title', 'Pause acquisition: the last trace stays on screen');
      expect(main()).toHaveAttribute('data-state', 'acquiring');
      expect(main()).toBeEnabled();
      expect(chevron()).toHaveAttribute('aria-disabled', 'true');
      expect(chevron()).toHaveAttribute('title', 'Pause or cancel acquisition to change the mode');
    });

    it('marks the main button acquiring or idle from the backend state', () => {
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'continuous' });
      const { unmount } = render(<CaptureControl />);
      expect(main()).toHaveAttribute('data-state', 'acquiring');
      unmount();
      push({ state: 'connected', source: activeSimulator, captureMode: 'continuous' });
      render(<CaptureControl />);
      expect(main()).toHaveAttribute('data-state', 'idle');
    });

    it('shows the square Stop as Cancel while a single capture runs, never Pause', () => {
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'single' });
      render(<CaptureControl />);
      expect(main()).toHaveAttribute('aria-label', 'Cancel single capture');
      expect(main()).toHaveAttribute('title', 'Cancel capture: the previous trace stays on screen');
      expect(main()).toHaveAttribute('data-state', 'acquiring');
      expect(main().querySelector('rect[rx]')).not.toBeNull();
      expect(main().querySelectorAll('rect')).toHaveLength(1);
      expect(chevron()).toHaveAttribute('aria-disabled', 'true');
    });

    it('disables the whole control without a connected source, with the reason as tooltip', () => {
      push({ state: 'disconnected' });
      render(<CaptureControl />);
      expect(main()).toBeDisabled();
      expect(main()).toHaveAttribute('title', 'Connect a source first');
      expect(main()).toHaveAttribute('aria-label', 'Start continuous acquisition');
      expect(chevron()).toBeDisabled();
      expect(chevron()).toHaveAttribute('title', 'Connect a source first');
    });

    it('says Loading… and disables the whole control before the first status (start-up)', () => {
      render(<CaptureControl />);
      expect(main()).toBeDisabled();
      expect(main()).toHaveAttribute('title', 'Loading…');
      expect(main()).toHaveAccessibleDescription('Loading…');
      expect(chevron()).toBeDisabled();
      expect(chevron()).toHaveAttribute('title', 'Loading…');
      expect(chevron()).toHaveAccessibleDescription('Loading…');
    });

    it('says Loading… while the launch connect has not begun, then the connect reason', () => {
      push({ state: 'disconnected', launching: true });
      const { unmount } = render(<CaptureControl />);
      expect(main()).toHaveAttribute('title', 'Loading…');
      expect(chevron()).toHaveAccessibleDescription('Loading…');
      unmount();
      push({ state: 'disconnected', launching: false });
      render(<CaptureControl />);
      expect(main()).toHaveAttribute('title', 'Connect a source first');
      expect(chevron()).toHaveAccessibleDescription('Connect a source first');
    });

    it('says Status unavailable, not Connect a source first, when start-up failed (S12)', () => {
      useSession.setState({ status: null, startupFailed: true });
      render(<CaptureControl />);
      expect(main()).toBeDisabled();
      expect(main()).toHaveAttribute('title', 'Status unavailable');
      expect(main()).toHaveAccessibleDescription('Status unavailable');
      expect(chevron()).toHaveAttribute('title', 'Status unavailable');
    });

    it.each([
      ['connecting', 'Connecting…'],
      ['disconnecting', 'Disconnecting…'],
    ] as const)('disables the control while %s and says so', (state, text) => {
      push({ state });
      render(<CaptureControl />);
      expect(main()).toBeDisabled();
      expect(main()).toHaveAttribute('title', text);
      expect(chevron()).toBeDisabled();
      expect(chevron()).toHaveAttribute('title', text);
    });

    it('keeps the main button enabled while a command is in flight, but aria-disabled', () => {
      push({ state: 'connected', source: activeSimulator });
      useSession.setState({ busy: 'starting' });
      render(<CaptureControl />);
      expect(main()).toBeEnabled();
      expect(main()).toHaveAttribute('aria-disabled', 'true');
      expect(chevron()).toHaveAttribute('aria-disabled', 'true');
      expect(chevron()).toHaveAttribute('title', 'Wait for the current change to finish');
    });
  });

  describe('accessibility (B7)', () => {
    it('is a group labelled Capture', () => {
      push({ state: 'connected', source: activeSimulator });
      render(<CaptureControl />);
      expect(screen.getByRole('group', { name: 'Capture' })).toBeInTheDocument();
    });

    it('describes the unavailable main and chevron by their reason, and an available one by nothing', () => {
      push({ state: 'connected', source: activeSimulator });
      const { unmount } = render(<CaptureControl />);
      expect(main()).not.toHaveAttribute('aria-describedby');
      expect(chevron()).not.toHaveAttribute('aria-describedby');
      unmount();

      push({ state: 'acquiring', source: activeSimulator, captureMode: 'continuous' });
      render(<CaptureControl />);
      expect(chevron()).toHaveAccessibleDescription(
        'Pause or cancel acquisition to change the mode',
      );
      expect(main()).not.toHaveAttribute('aria-describedby');
    });

    it('describes the main button while a command is in flight', () => {
      push({ state: 'connected', source: activeSimulator });
      useSession.setState({ busy: 'starting' });
      render(<CaptureControl />);
      expect(main()).toHaveAccessibleDescription('Wait for the current change to finish');
    });
  });

  describe('actions', () => {
    it('starts an acquisition from the main button when connected', async () => {
      push({ state: 'connected', source: activeSimulator });
      render(<CaptureControl />);
      await userEvent.click(main());
      expect(apiMock.startAcquisition).toHaveBeenCalledTimes(1);
      expect(apiMock.setCaptureMode).not.toHaveBeenCalled();
    });

    it('stops from the main button while acquiring', async () => {
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'continuous' });
      render(<CaptureControl />);
      await userEvent.click(main());
      expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1);
    });

    it('ignores presses while a command is in flight', async () => {
      push({ state: 'connected', source: activeSimulator });
      useSession.setState({ busy: 'starting' });
      render(<CaptureControl />);
      await userEvent.click(main());
      await userEvent.keyboard('{Enter}');
      expect(apiMock.startAcquisition).not.toHaveBeenCalled();
      expect(apiMock.stopAcquisition).not.toHaveBeenCalled();
    });

    it('keeps keyboard focus on the main button across start, the frames and stop', async () => {
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      render(<CaptureControl />);
      main().focus();
      await userEvent.keyboard('{Enter}');
      expect(apiMock.startAcquisition).toHaveBeenCalledTimes(1);
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'single' });
      expect(main()).toHaveFocus();
      await userEvent.keyboard('{Enter}');
      expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1);
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      expect(main()).toHaveFocus();
    });
  });

  describe('a press while the start is still in flight (BUG-1)', () => {
    /** Holds the start command open; `finishStart` resolves it, as the backend's reply would. */
    function holdStart() {
      let finishStart: () => void = () => undefined;
      apiMock.startAcquisition.mockImplementation(
        () => new Promise((resolve) => (finishStart = () => resolve(null))),
      );
      return () => act(() => finishStart());
    }

    /** Frame counts as published by the frame pump, with a sequence number. */
    function publishFrame(seq: number) {
      frameStore.publish({ header: { seq }, receivedAt: seq } as unknown as DecodedFrame);
    }

    it('queues Cancel pressed while start is in flight and sends it once start resolves', async () => {
      const finishStart = holdStart();
      const busyStates: (BusyOperation | null)[] = [];
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      render(<CaptureControl />);
      const unsubscribe = useSession.subscribe((s) => busyStates.push(s.busy));
      await userEvent.click(main());
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'single' });
      expect(main()).toHaveAttribute('aria-label', 'Cancel single capture');
      expect(main()).toHaveAttribute('aria-disabled', 'true');

      await userEvent.click(main());
      expect(apiMock.stopAcquisition).not.toHaveBeenCalled();

      finishStart();
      await waitFor(() => expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1));
      unsubscribe();
      // The start command stays busy until the queued Stop has run: busy never dropped to null.
      expect(busyStates.slice(0, -1)).not.toContain(null);
      expect(busyStates).toContain('stopping');
      expect(busyStates.at(-1)).toBeNull();
    });

    it('sends one Stop for two presses in the same window', async () => {
      const finishStart = holdStart();
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      render(<CaptureControl />);
      await userEvent.click(main());
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'single' });
      await userEvent.click(main());
      await userEvent.click(main());
      finishStart();
      await waitFor(() => expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1));
      expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1);
    });

    it('queues Pause pressed while a continuous start is in flight', async () => {
      const finishStart = holdStart();
      push({ state: 'connected', source: activeSimulator, captureMode: 'continuous' });
      render(<CaptureControl />);
      await userEvent.click(main());
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'continuous' });
      await userEvent.click(main());
      expect(apiMock.stopAcquisition).not.toHaveBeenCalled();
      finishStart();
      await waitFor(() => expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1));
    });

    it.each(['stopping', 'applying'] as const)(
      'still ignores presses while busy is %s',
      async (busy) => {
        push({ state: 'acquiring', source: activeSimulator, captureMode: 'single' });
        useSession.setState({ busy });
        render(<CaptureControl />);
        await userEvent.click(main());
        expect(apiMock.stopAcquisition).not.toHaveBeenCalled();
        expect(apiMock.startAcquisition).not.toHaveBeenCalled();
      },
    );

    it('keeps the Stop when the sweep finished before it was sent, and announces completion', async () => {
      const finishStart = holdStart();
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      render(<CaptureControl />);
      await userEvent.click(main());
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'single' });
      await userEvent.click(main());
      // The sweep is published and the capture ends before the queued Stop is sent.
      publishFrame(1);
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      expect(liveRegion()).toHaveTextContent('Single capture complete');
      finishStart();
      await waitFor(() => expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1));
      expect(liveRegion()).toHaveTextContent('Single capture complete');
      expect(liveRegion()).not.toHaveTextContent('cancelled');
    });

    it('reports a failed queued Stop as the stop failure and keeps the capture completed', async () => {
      const finishStart = holdStart();
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      render(<CaptureControl />);
      await userEvent.click(main());
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'single' });
      apiMock.stopAcquisition.mockRejectedValueOnce(new Error('the port is busy'));
      await userEvent.click(main());
      finishStart();
      await waitFor(() => expect(useSession.getState().commandError).not.toBeNull());
      expect(useSession.getState().commandErrorFrom).toBe('stopping');
      expect(main()).toHaveAttribute('aria-label', 'Cancel single capture');
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      expect(liveRegion()).toHaveTextContent('Single capture complete');
    });
  });

  describe('mode menu', () => {
    beforeEach(() => {
      push({ state: 'connected', source: activeSimulator, captureMode: 'continuous' });
    });

    it('opens on click with focus on the checked item, which is the only checked one', async () => {
      render(<CaptureControl />);
      await userEvent.click(chevron());
      expect(screen.getByRole('menu', { name: 'Capture mode' })).toBeInTheDocument();
      expect(chevron()).toHaveAttribute('aria-expanded', 'true');
      const items = screen.getAllByRole('menuitemradio');
      expect(items.map((i) => i.getAttribute('aria-checked'))).toEqual(['true', 'false']);
      expect(screen.getByTestId('capture-mode-continuous')).toHaveFocus();
      expect(screen.getByRole('menuitemradio', { name: /Continuous/ })).toHaveAccessibleDescription(
        'Keeps acquiring until you pause.',
      );
      expect(screen.queryByText(/does not start a capture/)).not.toBeInTheDocument();
      expect(screen.getByTestId('capture-mode-menu').querySelector('p')).toBeNull();
    });

    it('opens with ArrowDown on the chevron and moves with the arrows, wrapping', async () => {
      render(<CaptureControl />);
      chevron().focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByTestId('capture-mode-continuous')).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByTestId('capture-mode-single')).toHaveFocus();
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByTestId('capture-mode-continuous')).toHaveFocus();
      await userEvent.keyboard('{ArrowUp}');
      expect(screen.getByTestId('capture-mode-single')).toHaveFocus();
      await userEvent.keyboard('{Home}');
      expect(screen.getByTestId('capture-mode-continuous')).toHaveFocus();
      await userEvent.keyboard('{End}');
      expect(screen.getByTestId('capture-mode-single')).toHaveFocus();
    });

    it('chooses a mode with Enter, closes, returns focus to the chevron and does not start', async () => {
      render(<CaptureControl />);
      await userEvent.click(chevron());
      await userEvent.keyboard('{ArrowDown}{Enter}');
      expect(apiMock.setCaptureMode).toHaveBeenCalledWith('single');
      expect(apiMock.startAcquisition).not.toHaveBeenCalled();
      expect(screen.queryByTestId('capture-mode-menu')).not.toBeInTheDocument();
      expect(chevron()).toHaveFocus();
    });

    it('closes with Escape without changing the mode', async () => {
      render(<CaptureControl />);
      await userEvent.click(chevron());
      await userEvent.keyboard('{ArrowDown}{Escape}');
      expect(screen.queryByTestId('capture-mode-menu')).not.toBeInTheDocument();
      expect(chevron()).toHaveFocus();
      expect(apiMock.setCaptureMode).not.toHaveBeenCalled();
    });

    it('closes with Tab and leaves the chevron so Tab moves on', async () => {
      render(<CaptureControl />);
      await userEvent.click(chevron());
      await userEvent.keyboard('{Tab}');
      expect(screen.queryByTestId('capture-mode-menu')).not.toBeInTheDocument();
      expect(apiMock.setCaptureMode).not.toHaveBeenCalled();
    });

    it('does not call the backend when the current mode is chosen again', async () => {
      render(<CaptureControl />);
      await userEvent.click(chevron());
      await userEvent.click(screen.getByTestId('capture-mode-continuous'));
      expect(apiMock.setCaptureMode).not.toHaveBeenCalled();
      expect(screen.queryByTestId('capture-mode-menu')).not.toBeInTheDocument();
    });

    it('chooses Single with a click', async () => {
      render(<CaptureControl />);
      await userEvent.click(chevron());
      await userEvent.click(screen.getByTestId('capture-mode-single'));
      expect(apiMock.setCaptureMode).toHaveBeenCalledWith('single');
    });

    it('closes on a press outside the control without changing the mode', async () => {
      render(
        <>
          <button>outside</button>
          <CaptureControl />
        </>,
      );
      await userEvent.click(chevron());
      await userEvent.click(screen.getByRole('button', { name: 'outside' }));
      expect(screen.queryByTestId('capture-mode-menu')).not.toBeInTheDocument();
      expect(apiMock.setCaptureMode).not.toHaveBeenCalled();
    });

    it('does not open while acquiring', async () => {
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'continuous' });
      render(<CaptureControl />);
      await userEvent.click(chevron());
      expect(screen.queryByTestId('capture-mode-menu')).not.toBeInTheDocument();
    });

    it('closes when acquisition starts while the menu is open, without changing the mode', async () => {
      render(<CaptureControl />);
      await userEvent.click(chevron());
      expect(screen.getByTestId('capture-mode-menu')).toBeInTheDocument();
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'continuous' });
      await waitFor(() =>
        expect(screen.queryByTestId('capture-mode-menu')).not.toBeInTheDocument(),
      );
      expect(apiMock.setCaptureMode).not.toHaveBeenCalled();
    });

    it('shows the mode the backend reports, not the one chosen locally', async () => {
      render(<CaptureControl />);
      await userEvent.click(chevron());
      await userEvent.click(screen.getByTestId('capture-mode-single'));
      // The backend has not confirmed yet: the control still says Continuous.
      expect(main()).toHaveTextContent('Continuous');
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      expect(main()).toHaveTextContent('Single');
    });
  });

  describe('live region', () => {
    it('stays silent for continuous acquisition', () => {
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'continuous' });
      render(<CaptureControl />);
      push({ state: 'connected', source: activeSimulator, captureMode: 'continuous' });
      expect(liveRegion()).toHaveAttribute('aria-live', 'polite');
      expect(liveRegion().textContent).toBe('');
    });

    it('announces a completed single capture when the backend returns to connected', () => {
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      render(<CaptureControl />);
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'single' });
      expect(liveRegion().textContent).toBe('');
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      expect(liveRegion()).toHaveTextContent('Single capture complete');
    });

    it('announces a cancelled single capture', async () => {
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      render(<CaptureControl />);
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'single' });
      await userEvent.click(main());
      expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1);
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      expect(liveRegion()).toHaveTextContent('Single capture cancelled');
    });

    it('announces complete, not cancelled, when the Stop itself failed', async () => {
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      render(<CaptureControl />);
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'single' });
      apiMock.stopAcquisition.mockRejectedValueOnce(new Error('the port is busy'));
      await userEvent.click(main());
      expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(useSession.getState().commandError).not.toBeNull());
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      expect(liveRegion()).toHaveTextContent('Single capture complete');
    });

    it('does not announce a failed single capture (the failure notice does)', () => {
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      render(<CaptureControl />);
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'single' });
      push({
        state: 'connected',
        source: activeSimulator,
        captureMode: 'single',
        lastNotice: {
          kind: 'acquisitionFailed',
          message: 'Single capture failed: no sweep from the source.',
          timestampMs: 1,
        },
      });
      expect(liveRegion().textContent).toBe('');
    });

    it('does not announce a device loss as a capture end', () => {
      push({ state: 'connected', source: activeSimulator, captureMode: 'single' });
      render(<CaptureControl />);
      push({ state: 'acquiring', source: activeSimulator, captureMode: 'single' });
      push({
        state: 'disconnected',
        source: null,
        captureMode: 'single',
        lastNotice: { kind: 'deviceLost', message: 'Device lost', timestampMs: 1 },
      });
      expect(liveRegion().textContent).toBe('');
    });
  });
});
