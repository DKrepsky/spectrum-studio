import { formatFrequency, formatLevel } from '../../format/frequency';
import { UNIT_SYMBOL } from '../../format/units';
import { nextPeak, readMarkers } from '../../plot/markers';
import { useSession } from '../../state/session';
import { useFrameTick } from '../../state/useFrameTick';
import { MAX_MARKERS, useView } from '../../state/view';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { InlineMessage } from '../../ui/InlineMessage';
import { Table } from '../../ui/Table';
import { currentView } from '../SpectrumView';

const COLUMNS = [
  { key: 'id', header: '' },
  { key: 'frequency', header: 'Frequency' },
  { key: 'level', header: 'Level' },
  { key: 'actions', header: '' },
];

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
    <>
      <div className="panel-row">
        <Button
          size="small"
          disabled={!peaks.length}
          onClick={() => toPeak(false)}
          data-testid="peak-search"
        >
          Peak search
        </Button>
        <Button size="small" disabled={!peaks.length} onClick={() => toPeak(true)}>
          Next peak
        </Button>
        <Button
          size="small"
          disabled={!frame || markers.length >= MAX_MARKERS}
          onClick={() => {
            const v = currentView();
            view.addMarker((v.startHz + v.endHz) / 2);
          }}
        >
          + Marker
        </Button>
      </div>
      {markers.length === 0 ? (
        <InlineMessage variant="hint">
          Click the spectrum to place a marker (Shift+click adds another).
        </InlineMessage>
      ) : (
        <Table
          label="Markers"
          data-testid="marker-table"
          columns={COLUMNS}
          emptyText="No markers."
          rows={readMarkers(frame, markers).map(({ marker, level, delta }) => ({
            key: String(marker.id),
            active: marker.id === activeMarker,
            onSelect: () => view.setActiveMarker(marker.id),
            cells: [
              <span className="marker-id">M{marker.id}</span>,
              <>
                {formatFrequency(marker.frequencyHz, resolution)}
                {delta && <div className="delta">Δ {formatFrequency(delta.hz, resolution)}</div>}
              </>,
              <>
                {formatLevel(level, unit, 2)}
                {delta && <div className="delta">Δ {formatLevel(delta.db, 'dB', 2)}</div>}
              </>,
              <span className="table-actions">
                {tunable && (
                  <IconButton
                    label={`Set center frequency to M${marker.id}`}
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
                  </IconButton>
                )}
                <IconButton
                  label={`Remove marker M${marker.id}`}
                  title="Remove marker"
                  onClick={(e) => {
                    e.stopPropagation();
                    view.removeMarker(marker.id);
                  }}
                >
                  ×
                </IconButton>
              </span>,
            ],
          }))}
        />
      )}
    </>
  );
}
