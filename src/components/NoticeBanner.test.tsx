import '../test/mockApi';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSession } from '../state/session';
import { emptyConfig } from '../state/sourceConfig';
import { useSources } from '../state/sources';
import { savedSource, status } from '../test/fixtures';
import { apiMock } from '../test/mockApi';
import { NoticeBanner } from './NoticeBanner';

describe('NoticeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({ status: null, busy: null, commandError: null, info: null });
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

  it('offers Restart at the end of a recording and shows command errors', () => {
    useSession.getState().receiveStatus(
      status({
        revision: 1,
        state: 'connected',
        lastNotice: {
          kind: 'endOfStream',
          message: 'Reached the end of the recording.',
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
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByTestId('session-notice')).toHaveTextContent('port refused');
    expect(screen.getByTestId('reconnect-button')).toBeInTheDocument();
    expect(screen.queryByTestId('command-error')).not.toBeInTheDocument();
  });

  it('still shows a failed connect that produced no session notice', () => {
    useSession.setState({ commandError: 'Invalid port.', commandErrorFrom: 'connecting' });
    render(<NoticeBanner />);
    expect(screen.getByTestId('command-error')).toHaveTextContent('Invalid port.');
  });
});
