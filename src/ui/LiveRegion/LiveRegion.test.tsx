import { render } from '@testing-library/react';

import { LiveRegion } from './LiveRegion';

describe('LiveRegion', () => {
  it('is always in the DOM, polite and atomic, with the message as its text', () => {
    const { container, rerender } = render(<LiveRegion message="" />);
    const region = container.firstElementChild!;
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region).toHaveClass('ui-live-region');
    expect(region).toBeEmptyDOMElement();

    rerender(<LiveRegion message="Capture complete" />);
    expect(container.firstElementChild).toBe(region);
    expect(region).toHaveTextContent('Capture complete');
  });
});
