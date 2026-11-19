import './test/mockApi';

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App';
import { useSourceMenu } from './components/source/menuState';
import { simulatorDriver, status } from './test/fixtures';
import { apiMock } from './test/mockApi';

describe('App', () => {
  it('opens the source menu with Ctrl+K and shows the first-launch hint', async () => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never;
    apiMock.getStatus.mockResolvedValue(status());
    apiMock.listDrivers.mockResolvedValue([simulatorDriver]);
    apiMock.getPreferences.mockResolvedValue({ display: {}, lastSource: null, lastSourceId: null });
    useSourceMenu.setState({ open: false });
    render(<App />);
    expect(await screen.findByTestId('plot-hint')).toHaveTextContent(
      'Not connected. Use the source button to connect.',
    );
    // Ctrl+K does nothing until start-up is done (the source button reads Loading… before it).
    await waitFor(() =>
      expect(screen.getByTestId('source-button')).not.toHaveTextContent('Loading…'),
    );
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(await screen.findByTestId('source-menu')).toBeInTheDocument();
  });
});
