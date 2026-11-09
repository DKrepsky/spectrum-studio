import { formatFrequency, formatLevel } from '../format/frequency';
import { UNIT_DESCRIPTION, UNIT_SYMBOL } from '../format/units';
import { frameStore } from '../state/frames';
import { useSession } from '../state/session';
import { useFrameTick } from '../state/useFrameTick';

const WINDOW_LABEL = {
  hann: 'Hann',
  rectangular: 'Rectangular',
  blackmanHarris: 'Blackman-Harris',
  flatTop: 'Flat top',
};

/** Settings and statistics of the frame on screen — always those that produced it. */
export function StatusBar() {
  const frame = useFrameTick(500);
  const source = useSession((s) => s.status?.source);
  const h = frame?.header;
  const items: [string, string, string?][] = [];
  if (h) {
    items.push(['Center', formatFrequency(h.centerHz, h.binHz / 10)]);
    items.push(['Span', formatFrequency(h.spanHz, 1000)]);
    if (h.rbwHz !== null)
      items.push(['RBW', formatFrequency(h.rbwHz, 1), 'Equivalent noise bandwidth of one bin']);
    if (h.fftSize !== null)
      items.push(['FFT', `${h.fftSize} · ${h.window ? WINDOW_LABEL[h.window] : ''}`]);
    else items.push(['Points', String(h.bins)]);
    items.push(['Avg', `${h.averagedCount}/${h.averaging}`]);
    if (h.noiseFloor !== null) {
      items.push([
        'Noise floor',
        `${formatLevel(h.noiseFloor, UNIT_SYMBOL[h.unit])}/bin`,
        'Median level of the live trace',
      ]);
    }
    items.push(['Unit', UNIT_SYMBOL[h.unit], UNIT_DESCRIPTION[h.unit]]);
    items.push(['Rate', `${frameStore.rate.toFixed(1)} fps`]);
    items.push([
      'Frame',
      `#${h.seq} · ${new Date(h.timestampMs).toLocaleTimeString(undefined, { hour12: false })}`,
    ]);
  }
  return (
    <footer className="status-bar" data-testid="status-bar">
      {h ? (
        items.map(([label, value, title]) => (
          <span key={label} className="status-item" title={title}>
            <span className="status-label">{label}</span> {value}
          </span>
        ))
      ) : (
        <span className="status-item">
          {source ? 'No data yet — press Play to start acquisition.' : 'No source connected.'}
        </span>
      )}
      {h && h.unit !== 'dbm' && (
        <span className="status-item uncalibrated" title={UNIT_DESCRIPTION[h.unit]}>
          Uncalibrated
        </span>
      )}
    </footer>
  );
}
