import type { NoticeKind } from '../bindings/NoticeKind';
import { useSession } from '../state/session';
import { isRemembered } from '../state/sourceEntries';
import { useSources } from '../state/sources';
import { Banner, type BannerTone, type BannerUrgency } from '../ui/Banner';
import { Button } from '../ui/Button';

/**
 * Tone and urgency per notice kind (DESIGN.md 4.9, 9.6). Only the causes 9.6 lists are assertive;
 * a failed connect is the user's own action and is polite.
 */
const NOTICE_PRESENTATION: Record<NoticeKind, { tone: BannerTone; urgency: BannerUrgency }> = {
  deviceLost: { tone: 'error', urgency: 'alert' },
  acquisitionFailed: { tone: 'warning', urgency: 'alert' },
  internal: { tone: 'error', urgency: 'alert' },
  connectFailed: { tone: 'error', urgency: 'status' },
};

/**
 * Shows session notices (connection lost, end of file...) and failed commands, with recovery actions.
 * Renders inside the always-mounted `BannerRegion` in App. A failed connect is reported twice by the
 * backend (the command error and the session notice, which carries the same cause and the Reconnect
 * action); only the notice is shown.
 */
export function NoticeBanner() {
  const notice = useSession((s) => s.status?.lastNotice);
  const lastConfig = useSession((s) => s.status?.lastConfig);
  const state = useSession((s) => s.status?.state);
  const commandError = useSession((s) => s.commandError);
  const commandErrorFrom = useSession((s) => s.commandErrorFrom);
  const busy = useSession((s) => s.busy);
  const { connectTo, start, dismissNotice, clearCommandError } = useSession.getState();

  // Reconnect only after a cause a reconnect can fix, while disconnected, with a last configuration.
  const reconnectConfig =
    notice &&
    (notice.kind === 'deviceLost' ||
      notice.kind === 'connectFailed' ||
      notice.kind === 'internal') &&
    state === 'disconnected'
      ? lastConfig
      : null;
  const canRestart = notice?.kind === 'acquisitionFailed' && state === 'connected';

  return (
    <>
      {notice && (
        <Banner
          {...NOTICE_PRESENTATION[notice.kind]}
          data-testid="session-notice"
          onDismiss={() => void dismissNotice()}
          actions={
            reconnectConfig || canRestart ? (
              <>
                {reconnectConfig && (
                  <Button
                    unavailable={busy !== null}
                    onClick={() => {
                      const { active, list } = useSources.getState();
                      void connectTo(
                        active && isRemembered(list, active.id)
                          ? { type: 'remembered', id: active.id }
                          : { type: 'config', config: reconnectConfig },
                      );
                    }}
                    data-testid="reconnect-button"
                  >
                    Reconnect
                  </Button>
                )}
                {canRestart && (
                  <Button unavailable={busy !== null} onClick={() => void start()}>
                    Restart
                  </Button>
                )}
              </>
            ) : undefined
          }
        >
          {notice.message}
        </Banner>
      )}
      {commandError && !(commandErrorFrom === 'connecting' && notice?.kind === 'connectFailed') && (
        <Banner
          tone="error"
          urgency="status"
          data-testid="command-error"
          onDismiss={() => clearCommandError()}
        >
          {commandError}
        </Banner>
      )}
    </>
  );
}
