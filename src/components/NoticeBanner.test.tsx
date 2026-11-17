import '../test/mockApi';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSession } from '../state/session';
import { emptyConfig } from '../state/sourceConfig';
import { useSources } from '../state/sources';
import { savedSource, status } from '../test/fixtures';
import { apiMock } from '../test/mockApi';
import { BannerRegion } from '../ui/Banner';
import { NoticeBanner } from './NoticeBanner';

function renderInRegion() {
  return render(
    <BannerRegion>
      <NoticeBanner />
    </BannerRegion>,
  );
}

describe('NoticeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({ status: null, busy: null, commandError: null });
    useSources.setState({ list: [], active: null });
  });

  it('offers Reconnect after a device was lost', async () => {
    const lastConfig = emptyConfig('simulator');
    apiMock.connectSource.mockResolvedValue(status({ state: 'connected' }));
    useSession.getState().receiveStatus(
      status({
        revision: 1,
        lastConfig,
        lastNotice: { kind: 'deviceLost', message: 'USB device unplugged.', timestampMs: 0 },
      }),
    );
    render(<NoticeBanner />);
    expect(screen.getByRole('alert')).toHaveTextContent('USB device unplugged.');
    await userEvent.click(screen.getByTestId('reconnect-button'));
    expect(apiMock.connectSource).toHaveBeenCalledWith(lastConfig);
  });

  it('reconnects the remembered active source by id, without a Sources… button', async () => {
    const entry = savedSource({ id: 'r1' });
    useSources.setState({
      list: [entry],
      active: { id: 'r1', title: 'Sim', config: entry.config },
    });
    apiMock.connectRemembered.mockResolvedValue(status({ state: 'connected' }));
    useSession.getState().receiveStatus(
      status({
        revision: 1,
        lastConfig: emptyConfig('simulator'),
        lastNotice: { kind: 'deviceLost', message: 'USB device unplugged.', timestampMs: 0 },
      }),
    );
    render(<NoticeBanner />);
    expect(screen.queryByRole('button', { name: 'Sources…' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('reconnect-button'));
    expect(apiMock.connectRemembered).toHaveBeenCalledWith('r1');
    expect(apiMock.connectSource).not.toHaveBeenCalled();
  });

  it('offers Restart after an acquisition failure and shows command errors', () => {
    useSession.getState().receiveStatus(
      status({
        revision: 1,
        state: 'connected',
        lastNotice: {
          kind: 'acquisitionFailed',
          message: 'Timeout reading trace.',
          timestampMs: 0,
        },
      }),
    );
    useSession.setState({ commandError: 'Could not save preferences.' });
    render(<NoticeBanner />);
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
    expect(screen.queryByTestId('reconnect-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('command-error')).toHaveTextContent('Could not save preferences.');
  });

  it('shows a failed connect once: the session notice with Reconnect, not the duplicate command error', () => {
    useSession.getState().receiveStatus(
      status({
        revision: 1,
        lastConfig: emptyConfig('simulator'),
        lastNotice: {
          kind: 'connectFailed',
          message: 'Could not connect to X: port refused',
          timestampMs: 0,
        },
      }),
    );
    useSession.setState({ commandError: 'port refused', commandErrorFrom: 'connecting' });
    render(<NoticeBanner />);
    expect(screen.getByTestId('session-notice')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('session-notice')).toHaveTextContent('port refused');
    expect(screen.getByTestId('reconnect-button')).toBeInTheDocument();
    expect(screen.queryByTestId('command-error')).not.toBeInTheDocument();
  });

  it('still shows a failed connect that produced no session notice', () => {
    useSession.setState({ commandError: 'Invalid port.', commandErrorFrom: 'connecting' });
    render(<NoticeBanner />);
    expect(screen.getByTestId('command-error')).toHaveTextContent('Invalid port.');
  });

  it.each([
    ['deviceLost', 'alert', 'error'],
    ['acquisitionFailed', 'alert', 'warning'],
    ['internal', 'alert', 'error'],
    ['connectFailed', 'status', 'error'],
  ] as const)('%s is role=%s with the %s tone', (kind, role, tone) => {
    useSession.getState().receiveStatus(
      status({
        revision: 1,
        lastNotice: { kind, message: 'Something happened.', timestampMs: 0 },
      }),
    );
    renderInRegion();
    const banner = screen.getByTestId('session-notice');
    expect(banner).toHaveAttribute('role', role);
    expect(banner).toHaveAttribute('data-tone', tone);
  });

  it('shows a command error as a polite error banner', () => {
    useSession.setState({ commandError: 'Could not save preferences.' });
    renderInRegion();
    const banner = screen.getByTestId('command-error');
    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).toHaveAttribute('data-tone', 'error');
  });

  it('keeps the live region mounted and empty when there is no notice', () => {
    const { container, rerender } = renderInRegion();
    const region = container.firstElementChild!;
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();

    useSession.setState({ commandError: 'Could not save preferences.' });
    rerender(
      <BannerRegion>
        <NoticeBanner />
      </BannerRegion>,
    );
    expect(container.firstElementChild).toBe(region);
    expect(region).toHaveTextContent('Could not save preferences.');
  });

  it('dismisses a notice and a command error through the store', async () => {
    const dismissNotice = vi.spyOn(useSession.getState(), 'dismissNotice');
    useSession.getState().receiveStatus(
      status({
        revision: 1,
        state: 'connected',
        lastNotice: { kind: 'acquisitionFailed', message: 'Timeout.', timestampMs: 0 },
      }),
    );
    useSession.setState({ commandError: 'Could not save preferences.' });
    renderInRegion();
    const [noticeDismiss, commandDismiss] = screen.getAllByRole('button', { name: 'Dismiss' });
    await userEvent.click(commandDismiss!);
    expect(useSession.getState().commandError).toBeNull();
    await userEvent.click(noticeDismiss!);
    expect(dismissNotice).toHaveBeenCalledTimes(1);
    dismissNotice.mockRestore();
  });

  it('offers Reconnect for an internal failure while disconnected, and no action otherwise', () => {
    const lastConfig = emptyConfig('simulator');
    useSession.getState().receiveStatus(
      status({
        revision: 1,
        state: 'disconnected',
        lastConfig,
        lastNotice: { kind: 'internal', message: 'Backend restarted.', timestampMs: 0 },
      }),
    );
    const { unmount } = renderInRegion();
    expect(screen.getByTestId('reconnect-button')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
    unmount();

    useSession.getState().receiveStatus(
      status({
        revision: 2,
        state: 'connected',
        lastConfig,
        lastNotice: { kind: 'internal', message: 'Backend restarted.', timestampMs: 0 },
      }),
    );
    renderInRegion();
    expect(screen.queryByTestId('reconnect-button')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
  });

  it('shows no actions container for a notice without recovery (connected, deviceLost)', () => {
    useSession.getState().receiveStatus(
      status({
        revision: 1,
        state: 'connected',
        lastNotice: { kind: 'deviceLost', message: 'Unplugged.', timestampMs: 0 },
      }),
    );
    const { container } = renderInRegion();
    expect(screen.getByTestId('session-notice')).toBeInTheDocument();
    expect(screen.queryByTestId('reconnect-button')).not.toBeInTheDocument();
    expect(container.querySelector('.ui-banner-actions')).toBeNull();
  });
});
