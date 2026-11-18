import '../test/mockApi';

import { render, screen } from '@testing-library/react';

import { Toolbar } from './Toolbar';

describe('Toolbar', () => {
  it('shows the brand only: the source button and the capture control are in the side panel', () => {
    render(<Toolbar />);
    expect(screen.getByRole('banner', { name: 'Main toolbar' })).toHaveTextContent(
      'Spectrum Studio',
    );
    expect(screen.queryByTestId('source-button')).toBeNull();
    expect(screen.queryByTestId('acquire-button')).toBeNull();
    expect(screen.queryByTestId('capture-mode-button')).toBeNull();
    expect(screen.queryByTestId('center-frequency')).toBeNull();
    expect(screen.queryByTestId('span-select')).toBeNull();
  });

  it('is a labelled header without role=toolbar, which promises a roving focus it does not have (B7)', () => {
    render(<Toolbar />);
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.getByRole('banner', { name: 'Main toolbar' })).toBeInTheDocument();
  });
});
