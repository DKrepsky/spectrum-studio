import '../test/mockApi';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSession } from '../state/session';
import { activeSimulator, simulatorDriver, status } from '../test/fixtures';
import { apiMock } from '../test/mockApi';
import { Toolbar } from './Toolbar';

function renderToolbar() {
  return render(<Toolbar onOpenSources={vi.fn()} onExport={vi.fn()} />);
}

describe('Toolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSession.setState({ status: null, drivers: [simulatorDriver], busy: null, savedSources: [] });
  });

  it('shows only actions that are valid while disconnected', () => {
    useSession.getState().receiveStatus(status({ revision: 1 }));
    renderToolbar();
    expect(screen.getByTestId('session-state')).toHaveTextContent('Disconnected');
    expect(screen.getByTestId('run-button')).toBeEnabled();
    expect(screen.queryByTestId('stop-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('simulated-badge')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Center frequency')).toBeDisabled();
    expect(screen.getByTestId('export-button')).toBeDisabled();
  });

  it('reflects an acquiring simulated source', () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 2, state: 'acquiring', source: activeSimulator }));
    renderToolbar();
    expect(screen.getByTestId('session-state')).toHaveTextContent('Acquiring');
    expect(screen.getByTestId('stop-button')).toBeInTheDocument();
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
