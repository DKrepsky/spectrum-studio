import { formatFrequency, formatLevel } from '../../format/frequency';
import { UNIT_SYMBOL } from '../../format/units';
import { useSession } from '../../state/session';
import { useFrameTick } from '../../state/useFrameTick';
import { useView } from '../../state/view';
import { Checkbox, Field, NumberField } from '../../ui/Field';
import { Table } from '../../ui/Table';

const COLUMNS = [
  { key: 'id', header: '' },
  { key: 'frequency', header: 'Frequency' },
  { key: 'level', header: 'Level' },
  {
    key: 'prominence',
    header: <span title="Height above surrounding signal">Prom.</span>,
  },
];

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
    <>
      <div className="panel-row">
        <Checkbox
          label="Detect peaks"
          checked={settings.enabled}
          onChange={(enabled) => update({ enabled })}
        />
        <NumberField
          label="Maximum peaks"
          unit="max"
          value={settings.maxCount}
          min={1}
          max={50}
          integer
          disabled={!settings.enabled}
          onCommit={(maxCount) => update({ maxCount })}
        />
      </div>
      <Field label="Above noise" id="peak-excess" layout="inline">
        {(c) => (
          <NumberField
            id={c.id}
            aria-describedby={c.describedBy}
            label="Minimum level above noise floor"
            title="Minimum height above the estimated noise floor"
            unit="dB"
            value={settings.minExcessDb}
            min={0}
            max={200}
            disabled={!settings.enabled}
            onCommit={(minExcessDb) => update({ minExcessDb })}
          />
        )}
      </Field>
      {settings.enabled && (
        <Table
          label="Peaks"
          data-testid="peak-table"
          columns={COLUMNS}
          emptyText={frame ? 'No peaks above the detection criteria.' : ''}
          rows={(frame?.header.peaks ?? []).map((p, i) => {
            const isSelected = selected !== null && Math.abs(selected - p.frequencyHz) < 1e-3;
            return {
              key: String(i),
              active: isSelected,
              onSelect: () => {
                const v = useView.getState();
                v.selectPeak(isSelected ? null : p.frequencyHz);
                v.placeMarker(p.frequencyHz);
              },
              cells: [
                <span className="peak-id">P{i + 1}</span>,
                formatFrequency(p.frequencyHz, resolution),
                formatLevel(p.amplitude, unit, 1),
                `${p.prominenceDb.toFixed(0)} dB`,
              ],
            };
          })}
        />
      )}
    </>
  );
}
