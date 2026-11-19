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

/** Text for screen readers only, linked from the control by `aria-describedby` (DESIGN.md 5.4). */
function Described({ id, text }: { id: string; text: string | null | undefined }) {
  return text ? (
    <span id={id} className="visually-hidden">
      {text}
    </span>
  ) : null;
}

export interface ParamFieldProps {
  spec: ParamSpec;
  value: ParamValue;
  onChange: (value: ParamValue) => void;
  disabled?: boolean | undefined;
  readOnly?: boolean | undefined;
  id: string;
  layout: 'inline' | 'stacked';
  /** No value to show (no source): a number shows an em dash and a choice a single "—" option. */
  noValue?: boolean | undefined;
  /**
   * Why the field is unavailable. It is the tooltip and part of the accessible description, after
   * the driver's help text (DESIGN.md 5.4).
   */
  reason?: string | undefined;
}

/**
 * One parameter as a `ui/` field. The label keeps its required mark in the text (no danger colour).
 * The driver's help is the accessible description and the tooltip (DESIGN.md 4.4).
 */
export function ParamField({
  spec,
  value,
  onChange,
  disabled,
  readOnly,
  id,
  layout,
  noValue = false,
  reason,
}: ParamFieldProps) {
  const kind = spec.kind;
  const help = spec.help ?? undefined;
  const label = spec.required ? `${spec.label} *` : spec.label;
  const helpId = `${id}-help`;
  const reasonId = `${id}-reason`;
  const describedBy = (own: string | undefined) =>
    [own, help ? helpId : undefined, reason ? reasonId : undefined].filter(Boolean).join(' ') ||
    undefined;
  switch (kind.type) {
    case 'number': {
      const numeric = noValue ? null : typeof value === 'number' ? value : 0;
      return (
        <Field label={label} id={id} layout={layout} title={help}>
          {(c) => (
            <>
              {kind.unit === 'Hz' ? (
                <FrequencyField
                  id={c.id}
                  aria-describedby={describedBy(c.describedBy)}
                  label={spec.label}
                  value={numeric}
                  min={kind.min}
                  max={kind.max}
                  step={kind.step}
                  onCommit={onChange}
                  disabled={disabled}
                  readOnly={readOnly}
                  title={reason}
                />
              ) : (
                <NumberField
                  id={c.id}
                  aria-describedby={describedBy(c.describedBy)}
                  label={spec.label}
                  unit={kind.unit ?? undefined}
                  value={numeric}
                  min={kind.min}
                  max={kind.max}
                  step={kind.step}
                  integer={Number.isInteger(kind.step) && kind.step >= 1}
                  onCommit={onChange}
                  disabled={disabled}
                  readOnly={readOnly}
                  title={reason}
                />
              )}
              <Described id={helpId} text={help} />
              <Described id={reasonId} text={reason} />
            </>
          )}
        </Field>
      );
    }
    case 'bool':
      return (
        <div title={help}>
          <Checkbox
            label={spec.label}
            checked={value === true}
            disabled={disabled}
            readOnly={readOnly}
            aria-describedby={describedBy(undefined)}
            onChange={(checked) => onChange(checked)}
          />
          <Described id={helpId} text={help} />
          <Described id={reasonId} text={reason} />
        </div>
      );
    case 'choice':
      return (
        <Field label={label} id={id} layout={layout} title={help}>
          {(c) => (
            <>
              <Select
                id={c.id}
                aria-describedby={describedBy(c.describedBy)}
                label={spec.label}
                value={noValue ? '' : String(value)}
                options={noValue ? [{ value: '', label: '—' }] : kind.options}
                disabled={disabled}
                readOnly={readOnly}
                title={reason}
                onChange={(v) => onChange(v)}
              />
              <Described id={helpId} text={help} />
              <Described id={reasonId} text={reason} />
            </>
          )}
        </Field>
      );
    case 'text':
      return (
        <Field label={label} id={id} layout={layout} title={help}>
          {(c) => (
            <>
              <TextField
                id={c.id}
                aria-describedby={describedBy(c.describedBy)}
                aria-label={spec.label}
                maxLength={kind.maxLength}
                value={String(value)}
                disabled={disabled}
                readOnly={readOnly}
                onChange={(v) => onChange(v)}
              />
              <Described id={helpId} text={help} />
              <Described id={reasonId} text={reason} />
            </>
          )}
        </Field>
      );
  }
}
