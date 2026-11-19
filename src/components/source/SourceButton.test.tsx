import '../../test/mockApi';

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSession } from '../../state/session';
import { emptyConfig } from '../../state/sourceConfig';
import { useSources } from '../../state/sources';
import { activeSimulator, savedSource, simulatorDriver, status } from '../../test/fixtures';
import { apiMock } from '../../test/mockApi';
import { SourceButton } from './SourceButton';
import { useSourceMenu } from './menuState';

const LONG = 'Roof antenna north-facing, 2.4 GHz survey with the long cable, rev 7';

function setup(name: string | null) {
  const entry =
    name === null ? null : savedSource({ id: 'a', name, config: emptyConfig('simulator') });
  useSources.setState({
    list: entry ? [entry] : [],
    activeId: entry?.id ?? null,
    active: entry ? { id: entry.id, title: name!, config: entry.config } : null,
    failed: null,
    forgotten: null,
    error: null,
    drivers: [simulatorDriver],
    discovery: { results: [], scanned: false, scanning: false, error: null },
  });
  apiMock.listSources.mockResolvedValue({
    sources: entry ? [entry] : [],
    activeId: entry?.id ?? null,
  });
  return render(<SourceButton />);
}

describe('source button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSourceMenu.setState({ open: false });
    useSession.setState({ status: status({ revision: 1 }), busy: null, commandError: null });
  });

  // Only reachable where no simulator driver is registered: after start-up a source is always selected.
  it('has no status dot and the attention outline while nothing is chosen', () => {
    setup(null);
    const button = screen.getByTestId('source-button');
    expect(button).toHaveTextContent('Choose a source');
    expect(within(button).queryByTestId('source-button-status')).toBeNull();
    expect(button).toHaveClass('attention');
    expect(button).toHaveAccessibleName('Source: Choose a source');
  });

  it('keeps the full long name in its accessible name and title, and truncates only visually', () => {
    setup(LONG);
    const button = screen.getByTestId('source-button');
    expect(button).toHaveAccessibleName(`Source: ${LONG}, Disconnected`);
    expect(button).toHaveAttribute('title', `${LONG}\nChoose source (Ctrl+K)`);
    expect(within(button).getByTestId('source-button-name')).toHaveTextContent(LONG);
    expect(button).not.toHaveClass('attention');
  });

  it('names a source the device no longer reports Not detected, as its row does', () => {
    setup('Bench');
    act(() =>
      useSession.setState({
        status: status({
          revision: 3,
          state: 'disconnected',
          lastNotice: { kind: 'deviceLost', message: 'Device lost', timestampMs: 1 },
        }),
      }),
    );
    expect(screen.getByTestId('source-button')).toHaveAccessibleName('Source: Bench, Not detected');
  });

  it('wears the same status dot as the rows and no status text', () => {
    setup('Bench');
    act(() =>
      useSession.setState({
        status: status({
          revision: 2,
          state: 'connected',
          source: { ...activeSimulator, config: emptyConfig('simulator') },
        }),
      }),
    );
    const button = screen.getByTestId('source-button');
    const dot = within(button).getByTestId('source-button-status');
    expect(dot).toHaveAttribute('data-status', 'connected');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(button.textContent).toBe('Bench▾');
    expect(button).toHaveAccessibleName('Source: Bench, Connected');
  });

  it('marks the button data-simulated only while the live source is the simulator', () => {
    setup('Bench');
    const button = screen.getByTestId('source-button');
    expect(button).not.toHaveAttribute('data-simulated');
    act(() =>
      useSession.setState({
        status: status({ revision: 2, state: 'connected', source: activeSimulator }),
      }),
    );
    expect(button).toHaveAttribute('data-simulated', 'true');
    act(() =>
      useSession.setState({
        status: status({
          revision: 3,
          state: 'connected',
          source: { ...activeSimulator, simulated: false },
        }),
      }),
    );
    expect(button).not.toHaveAttribute('data-simulated');
  });

  it('announces a popover (dialog), not a menu', () => {
    setup('Bench');
    expect(screen.getByTestId('source-button')).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('shows Failed only while the backend is disconnected', () => {
    setup('Bench');
    act(() => useSources.setState({ failed: 'source-entry-a' }));
    expect(screen.getByTestId('source-button-status')).toHaveAttribute('data-status', 'failed');
    // The name says the word the row shows (F4), not the session's Disconnected.
    expect(screen.getByTestId('source-button')).toHaveAccessibleName('Source: Bench, Failed');
  });

  it('shows the connected dot and label, not Failed, when the backend is connected', () => {
    setup('Bench');
    act(() => useSources.setState({ failed: 'source-entry-a' }));
    act(() =>
      useSession.setState({
        status: status({
          revision: 2,
          state: 'connected',
          source: { ...activeSimulator, config: emptyConfig('simulator') },
        }),
      }),
    );
    const button = screen.getByTestId('source-button');
    expect(within(button).getByTestId('source-button-status')).toHaveAttribute(
      'data-status',
      'connected',
    );
    expect(button).toHaveAccessibleName('Source: Bench, Connected');
  });

  it.each([
    ['connecting', 'connecting'],
    ['disconnecting', 'disconnecting'],
  ] as const)('shows the %s glyph while the session is %s', (state, glyph) => {
    setup('Bench');
    act(() => useSession.setState({ status: status({ revision: 3, state }) }));
    expect(screen.getByTestId('source-button-status')).toHaveAttribute('data-status', glyph);
  });

  describe('start-up (ADR 0017)', () => {
    it('reads Loading… with no dot, not as a choice, before the first status', () => {
      setup('Bench');
      act(() => useSession.setState({ status: null }));
      const button = screen.getByTestId('source-button');
      expect(button).toHaveTextContent('Loading…');
      expect(button).not.toHaveTextContent('Bench');
      expect(within(button).queryByTestId('source-button-status')).toBeNull();
      expect(button).not.toHaveClass('attention');
      expect(button).toHaveAccessibleName('Source: Loading…');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(button).not.toBeDisabled();
    });

    it('stays Loading… while a launch has not begun its connect, then shows the source', () => {
      setup('Bench');
      act(() => useSession.setState({ status: status({ revision: 1, launching: true }) }));
      expect(screen.getByTestId('source-button')).toHaveTextContent('Loading…');
      act(() => useSession.setState({ status: status({ revision: 2, launching: false }) }));
      const button = screen.getByTestId('source-button');
      expect(button).toHaveAccessibleName('Source: Bench, Disconnected');
      expect(within(button).getByTestId('source-button-status')).toHaveAttribute(
        'data-status',
        'idle',
      );
    });

    it('shows the connecting source while a launch connects it', () => {
      setup('Bench');
      act(() =>
        useSession.setState({
          status: status({ revision: 2, state: 'connecting', launching: true }),
        }),
      );
      expect(screen.getByTestId('source-button')).toHaveAccessibleName(
        'Source: Bench, Connecting…',
      );
    });

    it('does not open the menu on click or ArrowDown while loading', async () => {
      setup('Bench');
      act(() => useSession.setState({ status: null }));
      await userEvent.click(screen.getByTestId('source-button'));
      screen.getByTestId('source-button').focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(useSourceMenu.getState().open).toBe(false);
      expect(screen.queryByTestId('source-menu')).toBeNull();
    });

    it('reads Status unavailable when the start-up commands failed', () => {
      setup('Bench');
      act(() => useSession.setState({ status: null, startupFailed: true }));
      const button = screen.getByTestId('source-button');
      expect(button).toHaveTextContent('Status unavailable');
      expect(button).toHaveAccessibleName('Source: Status unavailable');
      expect(button).toHaveAttribute('aria-disabled', 'true');
      expect(within(button).queryByTestId('source-button-status')).toBeNull();
    });
  });
});
