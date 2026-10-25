import { formatFrequency, formatLevel } from '../../format/frequency';
import { UNIT_SYMBOL } from '../../format/units';
import { nextPeak, readMarkers } from '../../plot/markers';
import { useSession } from '../../state/session';
import { useFrameTick } from '../../state/useFrameTick';
import { MAX_MARKERS, useView } from '../../state/view';
import { currentView } from '../SpectrumView';

export function MarkersPanel() {
  const frame = useFrameTick();
  const markers = useView((s) => s.markers);
  const activeMarker = useView((s) => s.activeMarker);
  const tunable = useSession((s) => s.status?.source?.capabilities.tuning != null);
  const view = useView.getState();
  const unit = frame ? UNIT_SYMBOL[frame.header.unit] : '';
  const resolution = frame ? frame.header.binHz / 10 : 1;
  const active = markers.find((m) => m.id === activeMarker) ?? null;
  const peaks = frame?.header.peaks ?? [];

  const toPeak = (next: boolean) => {
    const target = next
      ? nextPeak(peaks, active?.frequencyHz ?? null, frame ? frame.header.binHz : 0)
      : (peaks[0] ?? null);
    if (target) view.placeMarker(target.frequencyHz);
  };

  return (
    <div className="panel-body">
      <div className="button-row">
        <button
          className="small"
          disabled={!peaks.length}
          onClick={() => toPeak(false)}
          data-testid="peak-search"
        >
          Peak search
        </button>
        <button className="small" disabled={!peaks.length} onClick={() => toPeak(true)}>
          Next peak
        </button>
        <button
          className="small"
          disabled={!frame || markers.length >= MAX_MARKERS}
          onClick={() => {
            const v = currentView();
            view.addMarker((v.startHz + v.endHz) / 2);
          }}
        >
          + Marker
        </button>
      </div>
      {markers.length === 0 ? (
        <p className="hint">Click the spectrum to place a marker (Shift+click adds another).</p>
      ) : (
        <table className="readout-table" data-testid="marker-table">
          <thead>
            <tr>
              <th />
              <th>Frequency</th>
              <th>Level</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {readMarkers(frame, markers).map(({ marker, level, delta }) => (
              <tr
                key={marker.id}
                className={marker.id === activeMarker ? 'active' : undefined}
                onClick={() => view.setActiveMarker(marker.id)}
              >
                <td className="marker-id">M{marker.id}</td>
                <td>
                  {formatFrequency(marker.frequencyHz, resolution)}
                  {delta && <div className="delta">Δ {formatFrequency(delta.hz, resolution)}</div>}
                </td>
                <td>
                  {formatLevel(level, unit, 2)}
                  {delta && <div className="delta">Δ {formatLevel(delta.db, 'dB', 2)}</div>}
                </td>
                <td className="row-actions">
                  {tunable && (
                    <button
                      className="icon"
                      title="Set center frequency to this marker"
                      onClick={(e) => {
                        e.stopPropagation();
                        void useSession.getState().applySettings({
                          centerHz: marker.frequencyHz,
                          spanHz: null,
                          params: {},
                        });
                      }}
                    >
                      ⇥
                    </button>
                  )}
                  <button
                    className="icon"
                    title="Remove marker"
                    onClick={(e) => {
                      e.stopPropagation();
                      view.removeMarker(marker.id);
                    }}
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
