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

/**
 * Whether a local Failed marker is shown. The backend state wins: a source the backend is
 * connecting, connected or acquiring is never shown as Failed, whatever the UI last saw.
 */
export function showsFailed(
  state: SessionState,
  busy: BusyOperation | null,
  failed: boolean,
): boolean {
  return failed && state === 'disconnected' && busy !== 'connecting';
}

/** Status of the active source from the backend state plus local markers. */
export function activeStatus(
  state: SessionState,
  busy: BusyOperation | null,
  failed: boolean,
  lost: boolean,
): EntryStatus {
  if (showsFailed(state, busy, failed)) return 'failed';
  if (state === 'connecting' || busy === 'connecting') return 'connecting';
  if (state === 'disconnecting') return 'disconnecting';
  if (state === 'connected' || state === 'acquiring') return state;
  return lost ? 'absent' : 'idle';
}
