/**
 * The toolbar (DESIGN.md 3.3): the brand only. The source button and the capture control are the
 * first and last items of the side panel's Measurement group (3.6).
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
    </header>
  );
}
