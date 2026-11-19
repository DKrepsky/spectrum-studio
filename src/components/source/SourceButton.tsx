import { useCallback, useRef, type KeyboardEvent } from 'react';

import type { SessionState } from '../../bindings/SessionState';
import { selectStartup, useSession } from '../../state/session';
import { configKey } from '../../state/sourceEntries';
import { useSources } from '../../state/sources';
import { SourceMenu } from './SourceMenu';
import { useSourceMenu } from './menuState';
import { StatusDot } from '../../ui/StatusDot';
import { STATUS_TEXT, activeStatus } from './status';
import './source.css';

const STATE_LABEL: Record<SessionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  acquiring: 'Acquiring',
  disconnecting: 'Disconnecting…',
};

/**
 * The source control, first item of the side panel's Measurement group: status dot, source name and the
 * menu it opens. Until start-up is done it reads "Loading…" or "Status unavailable" (ADR 0017): it is
 * focusable but does not open the menu.
 */
export function SourceButton() {
  const startup = useSession(selectStartup);
  const open = useSourceMenu((s) => s.open);
  const setOpen = useSourceMenu((s) => s.setOpen);
  const active = useSources((s) => s.active);
  const failed = useSources((s) => s.failed);
  const state = useSession((s) => s.status?.state ?? 'disconnected');
  // The live source is the simulator (ADR 0017). Exposed as a data attribute for the e2e helpers, so
  // they identify the simulator by what it is, not by its name; no visual change.
  const simulated = useSession((s) => s.status?.source?.simulated === true);
  const busy = useSession((s) => s.busy);
  const lost = useSession(
    (s) => s.status?.lastNotice?.kind === 'deviceLost' && s.status.state === 'disconnected',
  );
  const button = useRef<HTMLButtonElement>(null);

  const close = useCallback(
    (refocus: boolean) => {
      setOpen(false);
      if (refocus) button.current?.focus();
    },
    [setOpen],
  );

  const key = active
    ? active.id != null
      ? `source-entry-${active.id}`
      : configKey(active.config)
    : null;
  const status = activeStatus(state, busy, key !== null && failed === key, lost);
  // After start-up a source is always selected (ADR 0017). "Choose a source" is only the fallback for a
  // build with no simulator driver, where nothing can be selected.
  const name = active?.title ?? 'Choose a source';
  // The accessible name says what the dot shows (the same words as the row, status.tsx), so a failed
  // source reads "Failed", not the session's "Disconnected".
  const stateLabel = STATUS_TEXT[status] ?? STATE_LABEL[state];

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  if (startup !== 'ready') {
    const text = startup === 'loading' ? 'Loading…' : 'Status unavailable';
    return (
      <div className="source-control">
        <button
          type="button"
          className="source-button pending"
          aria-disabled="true"
          aria-label={`Source: ${text}`}
          title={text}
          data-testid="source-button"
        >
          <span className="source-button-name" data-testid="source-button-name">
            {text}
          </span>
          <span aria-hidden>▾</span>
        </button>
      </div>
    );
  }

  return (
    <div className="source-control">
      <button
        ref={button}
        type="button"
        className={`source-button${active ? '' : ' attention'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={active ? `Source: ${name}, ${stateLabel}` : 'Source: Choose a source'}
        title={active ? `${name}\nChoose source (Ctrl+K)` : 'Choose source (Ctrl+K)'}
        data-testid="source-button"
        data-simulated={simulated ? 'true' : undefined}
        onClick={() => setOpen(!open)}
        onKeyDown={onKeyDown}
      >
        {active && <StatusDot status={status} data-testid="source-button-status" />}
        <span className="source-button-name" data-testid="source-button-name">
          {name}
        </span>
        <span aria-hidden>▾</span>
      </button>
      {open && <SourceMenu buttonRef={button} onClose={close} />}
    </div>
  );
}
