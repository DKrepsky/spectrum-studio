import type { SessionState } from '../../bindings/SessionState';
import type { BusyOperation } from '../../state/session';

/** What a source row or the source button says about its source (always shown with text, never colour only). */
export type EntryStatus =
  'connected' | 'acquiring' | 'connecting' | 'disconnecting' | 'failed' | 'absent' | 'idle';

export const STATUS_TEXT: Record<EntryStatus, string | null> = {
  connected: 'Connected',
  acquiring: 'Acquiring',
  connecting: 'Connecting…',
  disconnecting: 'Disconnecting…',
  failed: 'Failed',
  absent: 'Not detected',
  idle: null,
};

/** Status of the active source from the backend state plus local markers. */
export function activeStatus(
  state: SessionState,
  busy: BusyOperation | null,
  failed: boolean,
  lost: boolean,
): EntryStatus {
  if (failed) return 'failed';
  if (state === 'connecting' || busy === 'connecting') return 'connecting';
  if (state === 'disconnecting') return 'disconnecting';
  if (state === 'connected' || state === 'acquiring') return state;
  return lost ? 'absent' : 'idle';
}

/** One CSS-drawn 10px circle (a cross for `failed`) in an 18px cell; the text next to it says the same. */
export function StatusGlyph({ status }: { status: EntryStatus }) {
  return <span className="src-dot" data-status={status} aria-hidden="true" />;
}
