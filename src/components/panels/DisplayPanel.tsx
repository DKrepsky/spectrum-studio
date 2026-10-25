import { RANGE_LIMITS, REFERENCE_LIMITS, useView, type Palette } from '../../state/view';
import { NumberInput } from '../NumberInput';

export function DisplayPanel() {
  const v = useView();
  return (
    <div className="panel-body">
      <div className="form-row">
        <label htmlFor="ref-level">Reference level</label>
        <NumberInput
          id="ref-level"
          label="Reference level"
          value={v.referenceLevel}
          min={REFERENCE_LIMITS.min}
          max={REFERENCE_LIMITS.max}
          step={5}
          onCommit={v.setReferenceLevel}
        />
      </div>
      <div className="form-row">
        <label htmlFor="range">Range</label>
        <span className="with-unit">
          <NumberInput
            id="range"
            label="Range"
            value={v.rangeDb}
            min={RANGE_LIMITS.min}
            max={RANGE_LIMITS.max}
            step={10}
            onCommit={v.setRange}
          />
          <span className="unit">dB</span>
        </span>
      </div>
      <div className="form-row checks">
        <label>
          <input
            type="checkbox"
            checked={v.showWaterfall}
            onChange={(e) => v.setShowWaterfall(e.target.checked)}
          />
          Waterfall
        </label>
        <select
          aria-label="Waterfall palette"
          value={v.palette}
          onChange={(e) => v.setPalette(e.target.value as Palette)}
        >
          <option value="classic">Classic</option>
          <option value="viridis">Viridis</option>
          <option value="grayscale">Grayscale</option>
        </select>
      </div>
      <p className="hint">
        Wheel: zoom · drag: pan · double-click: full span · wheel on level axis: reference ·
        Ctrl+wheel: range
      </p>
    </div>
  );
}
