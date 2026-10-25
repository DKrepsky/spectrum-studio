import { formatFrequency, formatLevel } from '../../format/frequency';
import { UNIT_SYMBOL } from '../../format/units';
import { useSession } from '../../state/session';
import { useFrameTick } from '../../state/useFrameTick';
import { useView } from '../../state/view';
import { NumberInput } from '../NumberInput';

export function PeaksPanel() {
  const frame = useFrameTick();
  const settings = useSession((s) => s.status?.processing.peaks);
  const selected = useView((s) => s.selectedPeakHz);
  const { setProcessing } = useSession.getState();
  if (!settings) return null;
  const update = (change: Partial<typeof settings>) =>
    void setProcessing({ peaks: { ...settings, ...change } });
  const unit = frame ? UNIT_SYMBOL[frame.header.unit] : '';
  const resolution = frame ? frame.header.binHz / 10 : 1;

  return (
    <div className="panel-body">
      <div className="form-row checks">
        <label>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
          />
          Detect peaks
        </label>
        <span className="with-unit">
          <NumberInput
            label="Maximum peaks"
            value={settings.maxCount}
            min={1}
            max={50}
            integer
            disabled={!settings.enabled}
            onCommit={(maxCount) => update({ maxCount })}
          />
          <span className="unit">max</span>
        </span>
      </div>
      <div className="form-row">
        <label htmlFor="peak-excess" title="Minimum height above the estimated noise floor">
          Above noise
        </label>
        <span className="with-unit">
          <NumberInput
            id="peak-excess"
            label="Minimum level above noise floor"
            value={settings.minExcessDb}
            min={0}
            max={200}
            disabled={!settings.enabled}
            onCommit={(minExcessDb) => update({ minExcessDb })}
          />
          <span className="unit">dB</span>
        </span>
      </div>
      {settings.enabled && (
        <table className="readout-table selectable" data-testid="peak-table">
          <thead>
            <tr>
              <th />
              <th>Frequency</th>
              <th>Level</th>
              <th title="Height above surrounding signal">Prom.</th>
            </tr>
          </thead>
          <tbody>
            {(frame?.header.peaks ?? []).map((p, i) => {
              const isSelected = selected !== null && Math.abs(selected - p.frequencyHz) < 1e-3;
              return (
                <tr
                  key={i}
                  className={isSelected ? 'active' : undefined}
                  onClick={() => {
                    const v = useView.getState();
                    v.selectPeak(isSelected ? null : p.frequencyHz);
                    v.placeMarker(p.frequencyHz);
                  }}
                >
                  <td className="peak-id">P{i + 1}</td>
                  <td>{formatFrequency(p.frequencyHz, resolution)}</td>
                  <td>{formatLevel(p.amplitude, unit, 1)}</td>
                  <td>{p.prominenceDb.toFixed(0)} dB</td>
                </tr>
              );
            })}
            {frame && frame.header.peaks.length === 0 && (
              <tr>
                <td colSpan={4} className="hint">
                  No peaks above the detection criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
