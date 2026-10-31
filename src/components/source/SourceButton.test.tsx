import '../../test/mockApi';

import { act, render, screen } from '@testing-library/react';

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

  it('has no glyph and the attention outline while nothing is chosen', () => {
    setup(null);
    const button = screen.getByTestId('source-button');
    expect(button).toHaveTextContent('Choose a source');
    expect(button.querySelector('.src-dot')).toBeNull();
    expect(button).toHaveClass('attention');
    expect(button).toHaveAccessibleName('Source: Choose a source');
  });

  it('keeps the full long name in its accessible name and title, and truncates only visually', () => {
    setup(LONG);
    const button = screen.getByTestId('source-button');
    expect(button).toHaveAccessibleName(`Source: ${LONG}, Disconnected`);
    expect(button).toHaveAttribute('title', `${LONG}\nChoose source (Ctrl+K)`);
    expect(button.querySelector('.src-name')).toHaveTextContent(LONG);
    expect(button).not.toHaveClass('attention');
  });

  it('wears the same glyph as the rows and no status text', () => {
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
    const dot = button.querySelector('.src-dot');
    expect(dot).toHaveAttribute('data-status', 'connected');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(button.querySelectorAll('.badge, .src-status, .row-sub')).toHaveLength(0);
    expect(button).toHaveAccessibleName('Source: Bench, Connected');
  });

  it.each([
    ['connecting', 'connecting'],
    ['disconnecting', 'disconnecting'],
  ] as const)('shows the %s glyph while the session is %s', (state, glyph) => {
    setup('Bench');
    act(() => useSession.setState({ status: status({ revision: 3, state }) }));
    expect(screen.getByTestId('source-button').querySelector('.src-dot')).toHaveAttribute(
      'data-status',
      glyph,
    );
  });
});
