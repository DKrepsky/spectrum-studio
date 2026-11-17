import { Checkbox, Field, NumberField, Select } from '../../ui/Field';
import { InlineMessage } from '../../ui/InlineMessage';
import { RANGE_LIMITS, REFERENCE_LIMITS, useView, type Palette } from '../../state/view';

const PALETTES: { value: Palette; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'viridis', label: 'Viridis' },
  { value: 'grayscale', label: 'Grayscale' },
];

export function DisplayPanel() {
  const v = useView();
  return (
    <>
      <Field label="Reference level" id="ref-level" layout="inline">
        {(c) => (
          <NumberField
            id={c.id}
            aria-describedby={c.describedBy}
            label="Reference level"
            value={v.referenceLevel}
            min={REFERENCE_LIMITS.min}
            max={REFERENCE_LIMITS.max}
            step={5}
            onCommit={v.setReferenceLevel}
          />
        )}
      </Field>
      <Field label="Range" id="range" layout="inline">
        {(c) => (
          <NumberField
            id={c.id}
            aria-describedby={c.describedBy}
            label="Range"
            unit="dB"
            value={v.rangeDb}
            min={RANGE_LIMITS.min}
            max={RANGE_LIMITS.max}
            step={10}
            onCommit={v.setRange}
          />
        )}
      </Field>
      <div className="panel-row">
        <Checkbox
          label="Waterfall"
          checked={v.showWaterfall}
          onChange={(checked) => v.setShowWaterfall(checked)}
        />
        <Select
          label="Waterfall palette"
          value={v.palette}
          options={PALETTES}
          onChange={(value) => v.setPalette(value as Palette)}
        />
      </div>
      <InlineMessage variant="hint">
        Wheel: zoom · drag: pan · double-click: full span · wheel on level axis: reference ·
        Ctrl+wheel: range
      </InlineMessage>
    </>
  );
}
