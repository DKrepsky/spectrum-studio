import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';

import type { CaptureMode } from '../../bindings/CaptureMode';
import type { SessionState } from '../../bindings/SessionState';
import { frameStore } from '../../state/frames';
import { useSession } from '../../state/session';
import { LiveRegion } from '../../ui/LiveRegion';
import { SplitButton } from '../../ui/SplitButton';
import { CaptureModeMenu } from './CaptureModeMenu';

const PLAY_ICON = (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden focusable="false">
    <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
  </svg>
);

const PAUSE_ICON = (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden focusable="false">
    <rect x="2.5" y="1.5" width="2.5" height="9" fill="currentColor" />
    <rect x="7" y="1.5" width="2.5" height="9" fill="currentColor" />
  </svg>
);

const STOP_ICON = (
  <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden focusable="false">
    <rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" />
  </svg>
);

const MODE_LABEL: Record<CaptureMode, string> = { continuous: 'Continuous', single: 'Single' };

const BUSY_REASON = 'Wait for the current change to finish';
const LOCKED_REASON = 'Pause or cancel acquisition to change the mode';

/** Why the source cannot start or change anything, in the words of the tooltip. */
function noSourceTitle(state: SessionState): string {
  if (state === 'connecting') return 'Connecting…';
  if (state === 'disconnecting') return 'Disconnecting…';
  return 'Connect a source first';
}

interface MainView {
  icon: 'play' | 'pause' | 'stop';
  aria: string;
  title: string;
}

/** The main button's icon, accessible name and tooltip for the backend state (design.md 5, 6). */
function mainView(mode: CaptureMode, state: SessionState): MainView {
  if (state === 'acquiring') {
    return mode === 'single'
      ? {
          icon: 'stop',
          aria: 'Cancel single capture',
          title: 'Cancel capture: the previous trace stays on screen',
        }
      : {
          icon: 'pause',
          aria: 'Pause continuous acquisition',
          title: 'Pause acquisition: the last trace stays on screen',
        };
  }
  const title = state === 'connected' ? undefined : noSourceTitle(state);
  return mode === 'single'
    ? {
        icon: 'play',
        aria: 'Start single capture',
        title: title ?? 'Start single capture: one sweep, then stop',
      }
    : {
        icon: 'play',
        aria: 'Start continuous acquisition',
        title: title ?? 'Start continuous acquisition',
      };
}

/**
 * The capture control, last item of the side panel's Measurement group: a main button (mode label
 * plus play, pause or cancel) and a chevron that opens the mode menu, both in one `SplitButton`.
 * Everything shown comes from `SessionStatus`; the UI never assumes a start, stop or single-capture
 * completion succeeded.
 */
export function CaptureControl() {
  const status = useSession((s) => s.status);
  const busy = useSession((s) => s.busy);
  const { start, stop, setCaptureMode } = useSession.getState();

  const state: SessionState = status?.state ?? 'disconnected';
  const mode: CaptureMode = status?.captureMode ?? 'continuous';
  const acquiring = state === 'acquiring';
  const capturing = acquiring && mode === 'single';
  // Start needs a connected source; Stop is offered only while the backend acquires.
  const canAcquire = state === 'connected' || acquiring;
  // A command in flight: aria-disabled rather than disabled, so keyboard focus is not lost.
  const busyNow = busy !== null;
  // The mode is locked while acquiring (the backend refuses to change it) and during a command.
  const locked = acquiring || busyNow;
  const lastNoticeKind = status?.lastNotice?.kind;

  const [menuOpen, setMenuOpen] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [seen, setSeen] = useState({ capturing, state, notice: lastNoticeKind });
  // The newest frame when this capture started: a newer one means the sweep was published.
  const [frameAtStart, setFrameAtStart] = useState<number | null>(null);
  const chevron = useRef<HTMLButtonElement>(null);
  // The reasons the main and chevron are unavailable, read through aria-describedby (DESIGN.md 9.12).
  const reasonId = useId();
  const mainReason = !canAcquire ? noSourceTitle(state) : busyNow ? BUSY_REASON : undefined;
  const chevronReason = !canAcquire
    ? noSourceTitle(state)
    : acquiring
      ? LOCKED_REASON
      : busyNow
        ? BUSY_REASON
        : undefined;

  // Announce only a completed or cancelled single capture. A failure is not announced here: the notice
  // banner announces it (NoticeBanner: acquisitionFailed is role=alert), and a second announcement would
  // be read out twice. Continuous acquisition is not announced. Compares with the previous render (no effect), so an unchanged
  // status never repeats an announcement.
  if (seen.capturing !== capturing || seen.state !== state || seen.notice !== lastNoticeKind) {
    setSeen({ capturing, state, notice: lastNoticeKind });
    if (capturing) {
      setAnnouncement('');
      setCancelled(false);
      setFrameAtStart(frameStore.latest?.header.seq ?? null);
    } else if (seen.capturing) {
      // A sweep published before the Stop was received is a completed capture (a late cancel): the
      // frame is on screen, so it must not be announced as cancelled.
      const published = (frameStore.latest?.header.seq ?? null) !== frameAtStart;
      setAnnouncement(
        lastNoticeKind === 'acquisitionFailed'
          ? ''
          : cancelled && !published
            ? 'Single capture cancelled'
            : state === 'connected'
              ? 'Single capture complete'
              : '',
      );
    }
  }

  // The menu closes when the mode becomes locked (acquisition started elsewhere, a command began).
  // If its focused item was removed, focus goes back to the chevron, so keyboard users keep place.
  if (locked && menuOpen) setMenuOpen(false);
  useEffect(() => {
    if (locked && !menuOpen && document.activeElement === document.body) {
      chevron.current?.focus();
    }
  }, [locked, menuOpen]);

  const onMain = () => {
    // A capture starts (status acquiring) before the start command resolves. Its Cancel/Pause label
    // is already shown, so the press is accepted and the store queues the Stop after the start.
    const queueableStop = busy === 'starting' && acquiring;
    if (busyNow && !queueableStop) return;
    if (acquiring) {
      if (capturing) {
        // A failed Stop leaves the capture running: it must then end as complete, not cancelled.
        setCancelled(true);
        void stop().then((stopped) => {
          if (!stopped) setCancelled(false);
        });
      } else {
        void stop();
      }
    } else if (state === 'connected') {
      void start();
    }
  };

  const openMenu = () => {
    if (locked || !canAcquire) return;
    setMenuOpen(true);
  };

  const onChevronKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !menuOpen) {
      e.preventDefault();
      openMenu();
    }
  };

  const choose = (next: CaptureMode) => {
    if (busyNow) return;
    setMenuOpen(false);
    chevron.current?.focus();
    // Choosing a mode never starts a capture; the store updates when the backend reports it.
    if (next !== mode) void setCaptureMode(next);
  };

  const closeMenu = (refocus: boolean) => {
    setMenuOpen(false);
    if (refocus) chevron.current?.focus();
  };

  const main = mainView(mode, state);

  return (
    <SplitButton
      groupLabel="Capture"
      fullWidth
      tone={acquiring ? 'danger' : mode === 'single' ? 'violet' : 'accent'}
      chevronRef={chevron}
      main={{
        label: MODE_LABEL[mode],
        icon: main.icon === 'stop' ? STOP_ICON : main.icon === 'pause' ? PAUSE_ICON : PLAY_ICON,
        ariaLabel: main.aria,
        title: main.title,
        disabled: !canAcquire,
        busy: busyNow,
        describedBy: mainReason ? `${reasonId}-main` : undefined,
        dataMode: mode,
        dataState: acquiring ? 'acquiring' : 'idle',
        onPress: onMain,
        testId: 'acquire-button',
      }}
      chevron={{
        ariaLabel: `Capture mode: ${MODE_LABEL[mode]}`,
        title: chevronReason ?? 'Choose capture mode',
        disabled: !canAcquire,
        locked,
        describedBy: chevronReason ? `${reasonId}-chevron` : undefined,
        expanded: menuOpen,
        onPress: () => (menuOpen ? setMenuOpen(false) : openMenu()),
        onKeyDown: onChevronKeyDown,
        testId: 'capture-mode-button',
      }}
    >
      {mainReason && (
        <span id={`${reasonId}-main`} className="visually-hidden">
          {mainReason}
        </span>
      )}
      {chevronReason && (
        <span id={`${reasonId}-chevron`} className="visually-hidden">
          {chevronReason}
        </span>
      )}
      {menuOpen && (
        <CaptureModeMenu mode={mode} anchorRef={chevron} onChoose={choose} onClose={closeMenu} />
      )}
      <LiveRegion message={announcement} data-testid="capture-live-region" />
    </SplitButton>
  );
}
