import type { ParamSpec } from '../bindings/ParamSpec';
import type { ParamValue } from '../bindings/ParamValue';
import { Checkbox, Field, FrequencyField, NumberField, Select, TextField } from '../ui/Field';
import './ParamForm.css';

interface Props {
  specs: readonly ParamSpec[];
  values: Partial<Record<string, ParamValue>>;
  onChange: (id: string, value: ParamValue) => void;
  disabled?: boolean;
  /**
   * Read-only in use: the values stay visible and focus stays in the control, but changes are
   * ignored. Use it while a change is applying; `disabled` would drop keyboard focus (DESIGN.md 9.8).
   */
  readOnly?: boolean;
  /** Prefix for element ids, so several forms can coexist. */
  idPrefix: string;
  /**
   * `stacked` (default): label above the control, for dialogs. `inline`: label left of the
   * control, for the side panel (DESIGN.md 4.4).
   */
  layout?: 'inline' | 'stacked';
  /**
   * `true` (default): each group has a border and padding, as in the side panel. `false`: no frame
   * (the source dialog, whose connection fields were never framed).
   */
  framed?: boolean;
}

function groupSpecs(specs: readonly ParamSpec[]): [string, ParamSpec[]][] {
  const groups = new Map<string, ParamSpec[]>();
  for (const spec of specs) {
    const key = spec.group ?? '';
    const list = groups.get(key) ?? [];
    list.push(spec);
    groups.set(key, list);
  }
  return [...groups.entries()];
}

/** Renders driver-described parameters generically (see `ParamSpec` in the core). */
export function ParamForm({
  specs,
  values,
  onChange,
  disabled,
  readOnly,
  idPrefix,
  layout = 'stacked',
  framed = true,
}: Props) {
  return (
    <div className="param-form">
      {groupSpecs(specs).map(([group, list]) => (
        <fieldset key={group} className={framed ? 'param-group' : 'param-group param-group--bare'}>
          {group && <legend>{group}</legend>}
          {list.map((spec) => (
            <ParamField
              key={spec.id}
              spec={spec}
              value={values[spec.id] ?? spec.default}
              onChange={(v) => onChange(spec.id, v)}
              disabled={disabled}
              readOnly={readOnly}
              id={`${idPrefix}-${spec.id}`}
              layout={layout}
            />
          ))}
        </fieldset>
      ))}
    </div>
  );
}

interface FieldProps {
  spec: ParamSpec;
  value: ParamValue;
  onChange: (value: ParamValue) => void;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  id: string;
  layout: 'inline' | 'stacked';
}

/** One parameter as a `ui/` field. The label keeps its required mark in the text (no danger colour). */
function ParamField({ spec, value, onChange, disabled, readOnly, id, layout }: FieldProps) {
  const kind = spec.kind;
  const title = spec.help ?? undefined;
  const label = spec.required ? `${spec.label} *` : spec.label;
  switch (kind.type) {
    case 'number':
      return (
        <Field label={label} id={id} layout={layout} title={title}>
          {(c) =>
            kind.unit === 'Hz' ? (
              <FrequencyField
                id={c.id}
                aria-describedby={c.describedBy}
                label={spec.label}
                value={typeof value === 'number' ? value : 0}
                min={kind.min}
                max={kind.max}
                step={kind.step}
                onCommit={onChange}
                disabled={disabled}
                readOnly={readOnly}
              />
            ) : (
              <NumberField
                id={c.id}
                aria-describedby={c.describedBy}
                label={spec.label}
                unit={kind.unit ?? undefined}
                value={typeof value === 'number' ? value : 0}
                min={kind.min}
                max={kind.max}
                step={kind.step}
                integer={Number.isInteger(kind.step) && kind.step >= 1}
                onCommit={onChange}
                disabled={disabled}
                readOnly={readOnly}
              />
            )
          }
        </Field>
      );
    case 'bool':
      return (
        <div title={title}>
          <Checkbox
            label={spec.label}
            checked={value === true}
            disabled={disabled}
            readOnly={readOnly}
            onChange={(checked) => onChange(checked)}
          />
        </div>
      );
    case 'choice':
      return (
        <Field label={label} id={id} layout={layout} title={title}>
          {(c) => (
            <Select
              id={c.id}
              aria-describedby={c.describedBy}
              label={spec.label}
              value={String(value)}
              options={kind.options}
              disabled={disabled}
              readOnly={readOnly}
              onChange={(v) => onChange(v)}
            />
          )}
        </Field>
      );
    case 'text':
      return (
        <Field label={label} id={id} layout={layout} title={title}>
          {(c) => (
            <TextField
              id={c.id}
              aria-describedby={c.describedBy}
              aria-label={spec.label}
              maxLength={kind.maxLength}
              value={String(value)}
              disabled={disabled}
              readOnly={readOnly}
              onChange={(v) => onChange(v)}
            />
          )}
        </Field>
      );
  }
}
