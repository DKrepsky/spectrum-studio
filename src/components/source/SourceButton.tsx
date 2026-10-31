import { useCallback, useRef, type KeyboardEvent } from 'react';

import type { SessionState } from '../../bindings/SessionState';
import { useSession } from '../../state/session';
import { configKey } from '../../state/sourceEntries';
import { useSources } from '../../state/sources';
import { SourceMenu } from './SourceMenu';
import { useSourceMenu } from './menuState';
import { StatusGlyph, activeStatus } from './status';

const STATE_LABEL: Record<SessionState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  acquiring: 'Acquiring',
  disconnecting: 'Disconnecting…',
};

/** The single source control of the toolbar: status dot, source name and the menu it opens. */
export function SourceButton() {
  const open = useSourceMenu((s) => s.open);
  const setOpen = useSourceMenu((s) => s.setOpen);
  const active = useSources((s) => s.active);
  const failed = useSources((s) => s.failed);
  const state = useSession((s) => s.status?.state ?? 'disconnected');
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
  const name = active?.title ?? 'Choose a source';
  const stateLabel = busy === 'connecting' ? STATE_LABEL.connecting : STATE_LABEL[state];

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' && !open) {
      e.preventDefault();
      setOpen(true);
    }
  };

  return (
    <div className="source-control">
      <button
        ref={button}
        type="button"
        className={`source-button${active ? '' : ' attention'}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={active ? `Source: ${name}, ${stateLabel}` : 'Source: Choose a source'}
        title={active ? `${name}\nChoose source (Ctrl+K)` : 'Choose source (Ctrl+K)'}
        data-testid="source-button"
        onClick={() => setOpen(!open)}
        onKeyDown={onKeyDown}
      >
        {active && <StatusGlyph status={status} />}
        <span className="src-name">{name}</span>
        <span aria-hidden>▾</span>
      </button>
      {open && <SourceMenu buttonRef={button} onClose={close} />}
    </div>
  );
}
