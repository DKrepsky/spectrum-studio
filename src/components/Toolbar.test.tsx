import '../test/mockApi';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { DecodedFrame } from '../ipc/frame';
import { frameStore } from '../state/frames';
import { SIMULATOR_CONFIG, useSession } from '../state/session';
import { useSources } from '../state/sources';
import { activeSimulator, simulatorDriver, status } from '../test/fixtures';
import { apiMock } from '../test/mockApi';
import { Toolbar } from './Toolbar';

function renderToolbar() {
  return render(<Toolbar />);
}

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({ status: null, drivers: [simulatorDriver], busy: null });
    useSources.setState({
      drivers: [simulatorDriver],
      list: [],
      active: { id: null, title: 'Signal simulator', config: SIMULATOR_CONFIG },
    });
  });

  it('shows no state pill and a disabled Play while disconnected', () => {
    useSession.getState().receiveStatus(status({ revision: 1 }));
    renderToolbar();
    expect(screen.queryByTestId('session-state')).not.toBeInTheDocument();
    expect(screen.getByTestId('source-button')).toHaveAttribute(
      'aria-label',
      'Source: Signal simulator, Disconnected',
    );
    const button = screen.getByTestId('acquire-button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-label', 'Start acquisition');
    expect(button).toHaveAttribute('data-state', 'idle');
    expect(button).toHaveAttribute('title', 'Connect a source first');
    expect(button).toHaveTextContent('');
    expect(screen.queryByText(/^(Run|Stop)$/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('simulated-badge')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Center frequency')).toBeDisabled();
  });

  it('has one source control and none of the old connect buttons', () => {
    useSession.getState().receiveStatus(status({ revision: 1 }));
    renderToolbar();
    expect(screen.getByTestId('source-button')).toHaveTextContent('Signal simulator');
    expect(
      screen.queryByRole('button', { name: /^(Connect|Disconnect|Switch|Sources…)$/ }),
    ).toBeNull();
    expect(screen.queryByTestId('connect-button')).not.toBeInTheDocument();
  });

  it('disables Play until a source is chosen', () => {
    useSources.setState({ active: null });
    useSession.getState().receiveStatus(status({ revision: 1 }));
    renderToolbar();
    expect(screen.getByTestId('source-button')).toHaveTextContent('Choose a source');
    expect(screen.getByTestId('acquire-button')).toBeDisabled();
    expect(screen.getByTestId('acquire-button')).toHaveAttribute('title', 'Connect a source first');
  });

  it.each(['connecting', 'disconnecting'] as const)('disables Play while %s', (state) => {
    useSession.getState().receiveStatus(status({ revision: 1, state }));
    renderToolbar();
    expect(screen.getByTestId('acquire-button')).toBeDisabled();
  });

  it('marks Play aria-disabled while a command is in flight, even when connected', () => {
    useSession.getState().receiveStatus(status({ revision: 1, state: 'connected' }));
    useSession.setState({ busy: 'starting' });
    renderToolbar();
    const button = screen.getByTestId('acquire-button');
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toBeEnabled();
  });

  it('keeps keyboard focus on Play while busy and ignores clicks until the command ends', async () => {
    useSession.getState().receiveStatus(status({ revision: 1, state: 'connected' }));
    let finishStart!: () => void;
    apiMock.startAcquisition.mockImplementationOnce(
      () => new Promise<null>((resolve) => (finishStart = () => resolve(null))),
    );
    renderToolbar();
    const button = screen.getByTestId('acquire-button');
    button.focus();
    expect(button).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(apiMock.startAcquisition).toHaveBeenCalledTimes(1);
    expect(button).toHaveFocus();
    expect(button).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(button);
    await userEvent.keyboard(' ');
    expect(apiMock.startAcquisition).toHaveBeenCalledTimes(1);
    expect(apiMock.stopAcquisition).not.toHaveBeenCalled();
    expect(button).toHaveFocus();

    finishStart();
    await waitFor(() => expect(useSession.getState().busy).toBeNull());
    expect(button).not.toHaveAttribute('aria-disabled');
    expect(button).toHaveFocus();
  });

  it('starts acquisition from Play without connecting first', async () => {
    useSession.getState().receiveStatus(status({ revision: 1, state: 'connected' }));
    renderToolbar();
    const button = screen.getByTestId('acquire-button');
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-label', 'Start acquisition');
    await userEvent.click(button);
    expect(apiMock.startAcquisition).toHaveBeenCalledTimes(1);
    expect(apiMock.connectRemembered).not.toHaveBeenCalled();
    expect(apiMock.connectSource).not.toHaveBeenCalled();
  });

  it('shows Pause while acquiring and stops without clearing the last frame', async () => {
    const frame = { receivedAt: 1 } as unknown as DecodedFrame;
    frameStore.publish(frame);
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'acquiring', source: activeSimulator }));
    renderToolbar();
    const button = screen.getByTestId('acquire-button');
    expect(button).toHaveAttribute('aria-label', 'Pause acquisition');
    expect(button).toHaveAttribute('data-state', 'acquiring');
    expect(button).toHaveAttribute('title', 'Pause acquisition');
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(apiMock.stopAcquisition).toHaveBeenCalledTimes(1);
    expect(frameStore.latest).toBe(frame);
    frameStore.clear();
  });

  it('keeps the source button state-aware while acquiring', () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'acquiring', source: activeSimulator }));
    renderToolbar();
    expect(screen.getByTestId('source-button')).toHaveAttribute(
      'aria-label',
      'Source: Signal simulator, Acquiring',
    );
    expect(screen.getByTestId('simulated-badge')).toBeInTheDocument();
    expect(screen.getByLabelText('Center frequency')).toHaveValue('100.000000 MHz');
    expect(screen.getByLabelText('Span')).toHaveValue('2048000');
  });

  it('applies a typed centre frequency', async () => {
    apiMock.applySourceSettings.mockResolvedValue(activeSimulator.settings);
    useSession
      .getState()
      .receiveStatus(status({ revision: 3, state: 'connected', source: activeSimulator }));
    renderToolbar();
    const input = screen.getByLabelText('Center frequency');
    await userEvent.clear(input);
    await userEvent.type(input, '433.92M{Enter}');
    expect(apiMock.applySourceSettings).toHaveBeenCalledWith({
      centerHz: 433.92e6,
      spanHz: null,
      params: {},
    });
  });

  it('keeps an out-of-range frequency visible as invalid instead of applying it', async () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 4, state: 'connected', source: activeSimulator }));
    renderToolbar();
    const input = screen.getByLabelText('Center frequency');
    await userEvent.clear(input);
    await userEvent.type(input, '7G{Enter}');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(apiMock.applySourceSettings).not.toHaveBeenCalled();
  });
});
