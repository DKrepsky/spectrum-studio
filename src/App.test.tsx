import './test/mockApi';

import { render, screen } from '@testing-library/react';
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
      'Choose a source to begin. Try Signal simulator.',
    );
    await userEvent.keyboard('{Control>}k{/Control}');
    expect(await screen.findByTestId('source-menu')).toBeInTheDocument();
  });
});
