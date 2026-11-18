import { CaptureControl } from './capture/CaptureControl';
import { SourceButton } from './source/SourceButton';

/**
 * The toolbar (DESIGN.md 3.3): brand and the source group (source button, capture control). The
 * tuning fields (Center, Span) live in the side panel's Measurement group. Every control comes
 * from `src/ui/`.
 */
export function Toolbar() {
  return (
    <header className="toolbar" aria-label="Main toolbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden>
          ▲
        </span>
        Spectrum Studio
      </div>

      <div className="toolbar-group toolbar-source">
        <SourceButton />
        <CaptureControl />
      </div>
    </header>
  );
}
