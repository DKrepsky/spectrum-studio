import type { ReactNode } from 'react';

import { DisplayPanel } from './panels/DisplayPanel';
import { MarkersPanel } from './panels/MarkersPanel';
import { MeasurementPanel } from './panels/MeasurementPanel';
import { PeaksPanel } from './panels/PeaksPanel';
import { SourcePanel } from './panels/SourcePanel';

function Section({
  title,
  children,
  open = true,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="panel" open={open}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

export function SidePanel() {
  return (
    <aside className="side-panel" aria-label="Analysis controls">
      <Section title="Measurement">
        <MeasurementPanel />
      </Section>
      <Section title="Markers">
        <MarkersPanel />
      </Section>
      <Section title="Peaks">
        <PeaksPanel />
      </Section>
      <Section title="Display">
        <DisplayPanel />
      </Section>
      <Section title="Source settings" open={false}>
        <SourcePanel />
      </Section>
    </aside>
  );
}
