import { act, render, screen } from '@testing-library/react';

import { StatusStrip, type StatusItem, type MeasureFn } from './StatusStrip';

/** Items that the strip can drop. Each stub `measure` decides from the rendered DOM. */
const pinned: StatusItem = { id: 'center', label: 'Center', value: '2.4 GHz' };
const span: StatusItem = { id: 'span', label: 'Span', value: '1 MHz' };
const rbw: StatusItem = { id: 'rbw', label: 'RBW', value: '1 kHz', dropOrder: 3 };
const avg: StatusItem = { id: 'avg', label: 'Avg', value: '4/4', dropOrder: 2 };
const frame: StatusItem = { id: 'frame', label: 'Frame', value: '#7', dropOrder: 1 };

/** Overflows while more than `capacity` items are rendered. */
function capacityOf(capacity: number): MeasureFn {
  return (strip) => strip.querySelectorAll('[data-item-id]').length > capacity;
}

function renderedIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[data-item-id]')].map((el) =>
    el.getAttribute('data-item-id')!,
  );
}

/** Captures the resize callbacks so a test can fire a resize. */
let resizeCallbacks: (() => void)[] = [];
function stubResizeObserver() {
  resizeCallbacks = [];
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resizeCallbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
}
function resize() {
  act(() => {
    for (const callback of resizeCallbacks) callback();
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('StatusStrip', () => {
  it('renders every item in order when it fits', () => {
    const measure = vi.fn<MeasureFn>(() => false);
    const { container } = render(
      <StatusStrip items={[pinned, span, rbw, avg, frame]} measure={measure} />,
    );
    expect(renderedIds(container)).toEqual(['center', 'span', 'rbw', 'avg', 'frame']);
    expect(measure).toHaveBeenCalled();
  });

  it('removes whole items, lowest dropOrder first, until the rest fit', () => {
    const { container } = render(
      <StatusStrip items={[pinned, span, rbw, avg, frame]} measure={capacityOf(3)} />,
    );
    // Five rendered, overflow: frame (1) goes; four, overflow: avg (2) goes; three fit.
    expect(renderedIds(container)).toEqual(['center', 'span', 'rbw']);
  });

  it('never drops a pinned item, even when nothing droppable is left', () => {
    const { container } = render(
      <StatusStrip items={[pinned, frame, span]} measure={() => true} />,
    );
    expect(renderedIds(container)).toEqual(['center', 'span']);
  });

  it('renders the empty content when there are no items', () => {
    const measure = vi.fn<MeasureFn>(() => true);
    render(
      <StatusStrip items={[]} empty={<span>Connect a source to begin.</span>} measure={measure} />,
    );
    expect(screen.getByText('Connect a source to begin.')).toBeInTheDocument();
    expect(measure).not.toHaveBeenCalled();
  });

  it('re-evaluates on resize: drops when narrower, restores when wider', () => {
    stubResizeObserver();
    let capacity = 5;
    const measure: MeasureFn = (strip) =>
      strip.querySelectorAll('[data-item-id]').length > capacity;
    const { container } = render(
      <StatusStrip items={[pinned, span, rbw, avg, frame]} measure={measure} />,
    );
    expect(renderedIds(container)).toHaveLength(5);

    capacity = 3;
    resize();
    expect(renderedIds(container)).toEqual(['center', 'span', 'rbw']);

    capacity = 5;
    resize();
    expect(renderedIds(container)).toEqual(['center', 'span', 'rbw', 'avg', 'frame']);
  });

  it('re-evaluates when the items change', () => {
    const { container, rerender } = render(
      <StatusStrip items={[pinned, span]} measure={capacityOf(3)} />,
    );
    expect(renderedIds(container)).toEqual(['center', 'span']);

    rerender(<StatusStrip items={[pinned, span, rbw, avg, frame]} measure={capacityOf(3)} />);
    expect(renderedIds(container)).toEqual(['center', 'span', 'rbw']);
  });

  it('uses scrollWidth and clientWidth by default, and skips the ResizeObserver when it is absent', () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(500);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(300);
    const { container } = render(<StatusStrip items={[pinned, span, frame]} />);
    // Overflow stays true, so the droppable item goes and the pinned ones stay.
    expect(renderedIds(container)).toEqual(['center', 'span']);
  });

  it('renders a pinned item right aligned with align="end"', () => {
    const unit: StatusItem = { id: 'unit', value: 'dBFS', align: 'end' };
    const { container } = render(<StatusStrip items={[pinned, unit]} measure={() => false} />);
    expect(container.querySelector('[data-item-id="unit"]')).toHaveAttribute('data-align', 'end');
  });

  it('shows the item label and title, and the value in its own element', () => {
    const { container } = render(
      <StatusStrip
        items={[{ ...rbw, title: 'Equivalent noise bandwidth of one bin' }]}
        measure={() => false}
      />,
    );
    const item = container.querySelector('[data-item-id="rbw"]')!;
    expect(item).toHaveAttribute('title', 'Equivalent noise bandwidth of one bin');
    expect(item.querySelector('.ui-status-label')).toHaveTextContent('RBW');
    expect(item.querySelector('.ui-status-value')).toHaveTextContent('1 kHz');
  });
  it('separates the label from the value with a space, so the text reads "RBW 1 kHz"', () => {
    const { container } = render(<StatusStrip items={[rbw]} measure={() => false} />);
    expect(container.querySelector('[data-item-id="rbw"]')!.textContent).toBe('RBW 1 kHz');
  });
});
