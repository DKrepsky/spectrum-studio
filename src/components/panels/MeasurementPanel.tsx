import type { WindowKind } from '../../bindings/WindowKind';
import { useSession } from '../../state/session';
import { NumberInput } from '../NumberInput';

const FFT_SIZES = [256, 512, 1024, 2048, 4096, 8192, 16384, 32768];

const WINDOWS: { value: WindowKind; label: string }[] = [
  { value: 'hann', label: 'Hann' },
  { value: 'rectangular', label: 'Rectangular' },
  { value: 'blackmanHarris', label: 'Blackman-Harris' },
  { value: 'flatTop', label: 'Flat top' },
];

export function MeasurementPanel() {
  const processing = useSession((s) => s.status?.processing);
  const dataKind = useSession((s) => s.status?.source?.capabilities.dataKind);
  const { setProcessing, resetHolds } = useSession.getState();
  if (!processing) return null;
  const traceSource = dataKind === 'trace';
  const fftTitle = traceSource
    ? 'The source supplies measured traces; no FFT is computed'
    : undefined;

  return (
    <div className="panel-body">
      <div className="form-row">
        <label htmlFor="fft-size">FFT size</label>
        <select
          id="fft-size"
          value={processing.fftSize}
          disabled={traceSource}
          title={fftTitle}
          onChange={(e) => void setProcessing({ fftSize: Number(e.target.value) })}
        >
          {FFT_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="window">Window</label>
        <select
          id="window"
          value={processing.window}
          disabled={traceSource}
          title={fftTitle}
          onChange={(e) => void setProcessing({ window: e.target.value as WindowKind })}
        >
          {WINDOWS.map((w) => (
            <option key={w.value} value={w.value}>
              {w.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="averaging">Averaging</label>
        <span className="with-unit">
          <NumberInput
            id="averaging"
            label="Averaging"
            value={processing.averaging}
            min={1}
            max={1000}
            integer
            onCommit={(averaging) => void setProcessing({ averaging })}
          />
          <span className="unit">traces</span>
        </span>
      </div>
      <div className="form-row checks">
        <label>
          <input
            type="checkbox"
            checked={processing.maxHold}
            onChange={(e) => void setProcessing({ maxHold: e.target.checked })}
          />
          <span className="swatch max-hold" /> Max hold
        </label>
        <label>
          <input
            type="checkbox"
            checked={processing.minHold}
            onChange={(e) => void setProcessing({ minHold: e.target.checked })}
          />
          <span className="swatch min-hold" /> Min hold
        </label>
        <button
          className="small"
          onClick={() => void resetHolds()}
          disabled={!processing.maxHold && !processing.minHold}
        >
          Reset
        </button>
      </div>
    </div>
  );
}
