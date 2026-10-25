import { useSession } from '../state/session';

/** Shows session notices (connection lost, end of file...) and failed commands, with recovery actions. */
export function NoticeBanner({ onOpenSources }: { onOpenSources: () => void }) {
  const notice = useSession((s) => s.status?.lastNotice);
  const lastConfig = useSession((s) => s.status?.lastConfig);
  const state = useSession((s) => s.status?.state);
  const commandError = useSession((s) => s.commandError);
  const info = useSession((s) => s.info);
  const busy = useSession((s) => s.busy);
  const { connect, start, dismissNotice, clearCommandError, showInfo } = useSession.getState();

  return (
    <>
      {notice && (
        <div className={`notice notice-${notice.kind}`} role="alert" data-testid="session-notice">
          <span className="notice-message">{notice.message}</span>
          {(notice.kind === 'deviceLost' ||
            notice.kind === 'connectFailed' ||
            notice.kind === 'internal') &&
            lastConfig &&
            state === 'disconnected' && (
              <button
                disabled={busy !== null}
                onClick={() => void connect(lastConfig)}
                data-testid="reconnect-button"
              >
                Reconnect
              </button>
            )}
          {(notice.kind === 'acquisitionFailed' || notice.kind === 'endOfStream') &&
            state === 'connected' && (
              <button disabled={busy !== null} onClick={() => void start()}>
                Restart
              </button>
            )}
          <button onClick={onOpenSources}>Sources…</button>
          <button className="icon" aria-label="Dismiss" onClick={() => void dismissNotice()}>
            ×
          </button>
        </div>
      )}
      {info && (
        <div className="notice notice-info" role="status" data-testid="info-message">
          <span className="notice-message">{info}</span>
          <button className="icon" aria-label="Dismiss" onClick={() => showInfo(null)}>
            ×
          </button>
        </div>
      )}
      {commandError && (
        <div className="notice notice-command" role="alert" data-testid="command-error">
          <span className="notice-message">{commandError}</span>
          <button className="icon" aria-label="Dismiss" onClick={clearCommandError}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
