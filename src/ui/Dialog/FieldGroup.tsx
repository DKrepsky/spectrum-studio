import type { ReactNode } from 'react';

interface FieldGroupProps {
  /** The group's name, shown as its legend. */
  legend: string;
  children: ReactNode;
}

/** A group of related fields in a dialog. Its legend has no side padding, so it lines up (F11). */
export function FieldGroup({ legend, children }: FieldGroupProps) {
  return (
    <fieldset className="field-group">
      <legend className="field-group-legend">{legend}</legend>
      {children}
    </fieldset>
  );
}
