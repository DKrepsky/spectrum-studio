import '../test/mockApi';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSession } from '../state/session';
import { emptyConfig } from '../state/sourceConfig';
import { status } from '../test/fixtures';
import { apiMock } from '../test/mockApi';
import { NoticeBanner } from './NoticeBanner';

describe('NoticeBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({ status: null, busy: null, commandError: null, info: null });
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
    render(<NoticeBanner onOpenSources={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('USB device unplugged.');
    await userEvent.click(screen.getByTestId('reconnect-button'));
    expect(apiMock.connectSource).toHaveBeenCalledWith(lastConfig);
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
    render(<NoticeBanner onOpenSources={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();
    expect(screen.queryByTestId('reconnect-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('command-error')).toHaveTextContent('Could not save preferences.');
  });
});
