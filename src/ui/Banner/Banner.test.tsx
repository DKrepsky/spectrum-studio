import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { rule } from '../../test/css';
import { Banner, BannerRegion } from './index';

const css = readFileSync(resolve(__dirname, 'Banner.css'), 'utf8');

describe('Banner', () => {
  it('is role=alert for urgency alert and role=status otherwise', () => {
    const { rerender } = render(
      <Banner tone="error" urgency="alert" onDismiss={() => {}}>
        Device lost.
      </Banner>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Device lost.');
    rerender(
      <Banner tone="warning" urgency="status" onDismiss={() => {}}>
        Connection failed.
      </Banner>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Connection failed.');
  });

  it.each(['warning', 'error'] as const)('carries the %s tone', (tone) => {
    render(
      <Banner tone={tone} urgency="status" onDismiss={() => {}}>
        m
      </Banner>,
    );
    expect(screen.getByRole('status')).toHaveAttribute('data-tone', tone);
  });

  it('shows the whole message, with no truncation in the markup', () => {
    const long = 'Add your user to the dialout group, then reconnect. '.repeat(12).trim();
    render(
      <Banner tone="warning" urgency="status" onDismiss={() => {}}>
        {long}
      </Banner>,
    );
    expect(screen.getByRole('status').querySelector('.ui-banner-message')).toHaveTextContent(long);
    expect(rule(css, '.ui-banner-message')).toContain('min-width: 0');
    expect(rule(css, '.ui-banner-message')).not.toContain('ellipsis');
  });

  it('puts the actions before a dismiss button that is last and labelled', async () => {
    const onDismiss = vi.fn();
    render(
      <Banner
        tone="error"
        urgency="alert"
        onDismiss={onDismiss}
        actions={<button type="button">Reconnect</button>}
      >
        Connection lost.
      </Banner>,
    );
    const reconnect = screen.getByRole('button', { name: 'Reconnect' });
    const dismiss = screen.getByRole('button', { name: 'Dismiss' });
    expect(
      reconnect.compareDocumentPosition(dismiss) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('takes a custom dismiss label and renders no actions container without actions', () => {
    const { container } = render(
      <Banner tone="warning" urgency="status" onDismiss={() => {}} dismissLabel="Close notice">
        Restart needed.
      </Banner>,
    );
    expect(screen.getByRole('button', { name: 'Close notice' })).toBeInTheDocument();
    expect(container.querySelector('.ui-banner-actions')).toBeNull();
  });

  it('renders the dismiss as an IconButton (24px target and focus ring come from it)', () => {
    render(
      <Banner tone="warning" urgency="status" onDismiss={() => {}}>
        x
      </Banner>,
    );
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveClass('ui-icon-button');
  });
});

describe('BannerRegion', () => {
  it('is always mounted as a polite live region, with or without banners', () => {
    const { container, rerender } = render(<BannerRegion />);
    const region = container.firstElementChild!;
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();

    rerender(
      <BannerRegion>
        <Banner tone="warning" urgency="status" onDismiss={() => {}}>
          Restart needed.
        </Banner>
      </BannerRegion>,
    );
    expect(container.firstElementChild).toBe(region);
    expect(region).toHaveTextContent('Restart needed.');
  });
});
