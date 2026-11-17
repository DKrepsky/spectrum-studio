import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';

import './StatusStrip.css';

export interface StatusItem {
  id: string;
  /** Shown in sans before the value. */
  label?: string;
  /** Shown in mono. */
  value: ReactNode;
  title?: string;
  /** Removal order when the strip is too narrow, lowest first. Omit to pin the item. */
  dropOrder?: number;
  /** Starts the item at the end of the strip (for example a state that stays right aligned). */
  align?: 'end';
}

/** True when the content of the strip does not fit. */
export type MeasureFn = (strip: HTMLElement) => boolean;

export interface StatusStripProps extends Omit<ComponentProps<'div'>, 'children'> {
  items: readonly StatusItem[];
  /** Shown when there are no items. */
  empty?: ReactNode;
  /** Overrides the default overflow check (tests stub it; jsdom has no layout). */
  measure?: MeasureFn;
}

const overflows: MeasureFn = (strip) => strip.scrollWidth > strip.clientWidth;

/**
 * One line of `label value` items. Whole items are removed, never cut: the droppable items (those
 * with a `dropOrder`) go lowest first until the rest fit; pinned items always stay (DESIGN.md 3.4,
 * F0). Re-evaluated on every commit that changes the items and on every resize of the strip.
 */
export function StatusStrip({
  items,
  empty,
  measure = overflows,
  className,
  ...rest
}: StatusStripProps) {
  const ref = useRef<HTMLDivElement>(null);
  // How many droppable items are removed, valid for the `items` array it was measured with. A new
  // array (new items) or a resize starts again from none, so the strip only drops, never restores.
  const [run, setRun] = useState<{ items: readonly StatusItem[]; dropped: number }>({
    items,
    dropped: 0,
  });
  const dropped = run.items === items ? run.dropped : 0;

  const droppable = useMemo(
    () =>
      items
        .filter((item) => item.dropOrder !== undefined)
        .sort((a, b) => a.dropOrder! - b.dropOrder!)
        .map((item) => item.id),
    [items],
  );
  const removed = useMemo(() => new Set(droppable.slice(0, dropped)), [droppable, dropped]);
  const visible = items.filter((item) => !removed.has(item.id));

  // Runs after every commit, before paint: one more item goes while the content still overflows.
  useLayoutEffect(() => {
    const strip = ref.current;
    if (!strip) return;
    if (dropped < droppable.length && measure(strip)) {
      setRun({ items, dropped: dropped + 1 });
    }
  }, [run, items, dropped, droppable, measure]);

  useEffect(() => {
    const strip = ref.current;
    if (!strip || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
      setRun((current) => ({ items: current.items, dropped: 0 }));
    });
    observer.observe(strip);
    return () => observer.disconnect();
  }, []);

  return (
    <div {...rest} ref={ref} className={['ui-status-strip', className].filter(Boolean).join(' ')}>
      {items.length === 0
        ? empty
        : visible.map((item) => (
            <span
              key={item.id}
              className="ui-status-item"
              title={item.title}
              data-item-id={item.id}
              data-align={item.align}
            >
              {item.label !== undefined ? (
                <>
                  <span className="ui-status-label">{item.label}</span>{' '}
                </>
              ) : null}
              <span className="ui-status-value">{item.value}</span>
            </span>
          ))}
    </div>
  );
}
