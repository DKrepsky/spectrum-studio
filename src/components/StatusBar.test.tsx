import '../test/mockApi';

import { render, screen } from '@testing-library/react';

import { frameStore } from '../state/frames';
import { useSession } from '../state/session';
import { activeSimulator, status } from '../test/fixtures';
import { StatusBar } from './StatusBar';

describe('StatusBar', () => {
  beforeEach(() => {
    frameStore.clear();
    useSession.setState({ status: null, busy: null });
  });

  it('tells the user to press Play, not Run, when a source is connected but has no data', () => {
    useSession
      .getState()
      .receiveStatus(status({ revision: 1, state: 'connected', source: activeSimulator }));
    render(<StatusBar />);
    expect(screen.getByTestId('status-bar')).toHaveTextContent(
      'No data yet — press Play to start acquisition.',
    );
    expect(screen.getByTestId('status-bar')).not.toHaveTextContent(/\bRun\b/);
  });

  it('says what a single capture is doing while it runs', () => {
    useSession
      .getState()
      .receiveStatus(
        status({ revision: 1, state: 'acquiring', source: activeSimulator, captureMode: 'single' }),
      );
    render(<StatusBar />);
    expect(screen.getByTestId('status-bar')).toHaveTextContent('Capturing one sweep…');
  });

  it('asks for one sweep when the next start is a single capture', () => {
    useSession
      .getState()
      .receiveStatus(
        status({ revision: 1, state: 'connected', source: activeSimulator, captureMode: 'single' }),
      );
    render(<StatusBar />);
    expect(screen.getByTestId('status-bar')).toHaveTextContent(
      'No data yet — press Play for one sweep.',
    );
  });

  it('says that no source is connected when none is selected', () => {
    useSession.getState().receiveStatus(status({ revision: 1 }));
    render(<StatusBar />);
    expect(screen.getByTestId('status-bar')).toHaveTextContent('No source connected.');
  });
});
