import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cssRules } from '../../test/css';
import { Badge } from './Badge';

const css = readFileSync(resolve(__dirname, 'Badge.css'), 'utf8');

/** The pill (the `.ui-badge` span) that holds a text. */
const pill = (text: string) => screen.getByText(text).closest('.ui-badge');

describe('Badge', () => {
  it('renders its text as it is, as a span inside the pill', () => {
    render(<Badge variant="chip">USB</Badge>);
    const badge = pill('USB');
    expect(badge?.tagName).toBe('SPAN');
    expect(badge).toHaveTextContent(/^USB$/);
  });

  describe('long text', () => {
    const LONG = 'Serial over USB CDC-ACM, bench unit 08FF41E50F8B3A34';

    /** jsdom has no layout: report a pill of 140px whose text is `scroll` px wide. */
    function narrowPill(scroll: number) {
      const widths = {
        scrollWidth: vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(scroll),
        clientWidth: vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(140),
      };
      return () => Object.values(widths).forEach((spy) => spy.mockRestore());
    }

    afterEach(() => vi.restoreAllMocks());

    it('keeps the full text as the accessible text: the ellipsis is CSS, not a cut string', () => {
      const restore = narrowPill(321);
      render(<Badge variant="chip">{LONG}</Badge>);
      expect(screen.getByText(LONG)).toHaveClass('ui-badge-label');
      restore();
    });

    it('gives the full text as the native title when the text is cut', () => {
      const restore = narrowPill(321);
      render(<Badge variant="chip">{LONG}</Badge>);
      expect(pill(LONG)).toHaveAttribute('title', LONG);
      restore();
    });

    it('has no title when the text fits', () => {
      const restore = narrowPill(90);
      render(<Badge variant="chip">USB</Badge>);
      expect(pill('USB')).not.toHaveAttribute('title');
      restore();
    });

    it('lets the caller title win over the cut text', () => {
      const restore = narrowPill(321);
      render(
        <Badge variant="chip" title="Port: /dev/ttyACM0">
          {LONG}
        </Badge>,
      );
      expect(pill(LONG)).toHaveAttribute('title', 'Port: /dev/ttyACM0');
      restore();
    });

    it('keeps the text on one line and ellipsises the label (tokens, no wrap)', () => {
      const label = cssRules(css).find((r) => r.selector === '.ui-badge-label');
      expect(label?.body).toMatch(/overflow: hidden/);
      expect(label?.body).toMatch(/text-overflow: ellipsis/);
      expect(label?.body).toMatch(/white-space: nowrap/);
      expect(cssRules(css).some((r) => /white-space: normal|pre-wrap/.test(r.body))).toBe(false);
    });
  });

  it('marks the variant and defaults to the neutral tone', () => {
    render(<Badge variant="tag">LIVE</Badge>);
    const badge = pill('LIVE');
    expect(badge).toHaveAttribute('data-variant', 'tag');
    expect(badge).toHaveAttribute('data-tone', 'neutral');
  });

  it.each(['neutral', 'live', 'waiting', 'warn', 'capturing'] as const)(
    'carries the %s tone',
    (tone) => {
      render(
        <Badge variant="chip" tone={tone}>
          x
        </Badge>,
      );
      expect(pill('x')).toHaveAttribute('data-tone', tone);
    },
  );

  it('forwards native attributes and merges className', () => {
    render(
      <Badge variant="chip" className="transport" data-testid="transport" title="Serial port">
        Serial
      </Badge>,
    );
    const badge = screen.getByTestId('transport');
    expect(badge).toHaveClass('ui-badge', 'transport');
    expect(badge).toHaveAttribute('title', 'Serial port');
  });

  it('keeps the case of a tag: the state word is typed as it is shown, the CSS does not uppercase it', () => {
    const tag = cssRules(css).filter((r) => r.selector.includes("data-variant='tag'"));
    expect(tag.length).toBeGreaterThan(0);
    expect(tag.some((r) => /text-transform/.test(r.body))).toBe(false);
  });

  it('finds a text-transform on a tag (self-check of the case guard)', () => {
    const planted = cssRules(".ui-badge[data-variant='tag'] { text-transform: uppercase; }");
    expect(planted.some((r) => /text-transform/.test(r.body))).toBe(true);
  });
});
