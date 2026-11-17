import { Section } from '../ui/Section';
import { DisplayPanel } from './panels/DisplayPanel';
import { MarkersPanel } from './panels/MarkersPanel';
import { MeasurementPanel } from './panels/MeasurementPanel';
import { PeaksPanel } from './panels/PeaksPanel';
import { SourcePanel } from './panels/SourcePanel';

export function SidePanel() {
  return (
    <aside className="side-panel" aria-label="Analysis controls">
      <Section title="Measurement" open>
        <MeasurementPanel />
      </Section>
      <Section title="Markers" open>
        <MarkersPanel />
      </Section>
      <Section title="Peaks" open>
        <PeaksPanel />
      </Section>
      <Section title="Display" open>
        <DisplayPanel />
      </Section>
      <Section title="Source settings">
        <SourcePanel />
      </Section>
    </aside>
  );
}
