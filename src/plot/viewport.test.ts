import { fullView, panBy, zoomAt } from './viewport';

const full = { startHz: 0, endHz: 1000 };

describe('viewport', () => {
  it('computes the full view from centre and span', () => {
    expect(fullView({ centerHz: 100, spanHz: 20 })).toEqual({ startHz: 90, endHz: 110 });
  });

  it('zooms around the anchor', () => {
    const v = zoomAt(full, full, 250, 0.5, 10);
    expect(v).toEqual({ startHz: 125, endHz: 625 });
  });

  it('limits zoom-in and returns null when fully zoomed out', () => {
    expect(zoomAt(full, full, 500, 0.0001, 10)).toEqual({ startHz: 495, endHz: 505 });
    expect(zoomAt({ startHz: 100, endHz: 600 }, full, 300, 4, 10)).toBeNull();
  });

  it('pans inside the full span', () => {
    const v = { startHz: 100, endHz: 200 };
    expect(panBy(v, full, 50, 10)).toEqual({ startHz: 150, endHz: 250 });
    expect(panBy(v, full, -500, 10)).toEqual({ startHz: 0, endHz: 100 });
    expect(panBy(v, full, 5000, 10)).toEqual({ startHz: 900, endHz: 1000 });
  });
});
