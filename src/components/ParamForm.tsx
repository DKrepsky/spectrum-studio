import { open } from '@tauri-apps/plugin-dialog';

import type { ParamSpec } from '../bindings/ParamSpec';
import type { ParamValue } from '../bindings/ParamValue';
import { FrequencyInput } from './FrequencyInput';
import { NumberInput } from './NumberInput';

interface Props {
  specs: readonly ParamSpec[];
  values: Partial<Record<string, ParamValue>>;
  onChange: (id: string, value: ParamValue) => void;
  disabled?: boolean;
  /** Prefix for element ids, so several forms can coexist. */
  idPrefix: string;
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
export function ParamForm({ specs, values, onChange, disabled, idPrefix }: Props) {
  return (
    <div className="param-form">
      {groupSpecs(specs).map(([group, list]) => (
        <fieldset key={group} className="param-group">
          {group && <legend>{group}</legend>}
          {list.map((spec) => (
            <ParamField
              key={spec.id}
              spec={spec}
              value={values[spec.id] ?? spec.default}
              onChange={(v) => onChange(spec.id, v)}
              disabled={disabled}
              id={`${idPrefix}-${spec.id}`}
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
  id: string;
}

function ParamField({ spec, value, onChange, disabled, id }: FieldProps) {
  const kind = spec.kind;
  let control;
  switch (kind.type) {
    case 'number': {
      const n = typeof value === 'number' ? value : 0;
      control =
        kind.unit === 'Hz' ? (
          <FrequencyInput
            id={id}
            label={spec.label}
            value={n}
            min={kind.min}
            max={kind.max}
            step={kind.step}
            onCommit={onChange}
            disabled={disabled}
          />
        ) : (
          <span className="with-unit">
            <NumberInput
              id={id}
              label={spec.label}
              value={n}
              min={kind.min}
              max={kind.max}
              step={kind.step}
              integer={Number.isInteger(kind.step) && kind.step >= 1}
              onCommit={onChange}
              disabled={disabled}
            />
            {kind.unit && <span className="unit">{kind.unit}</span>}
          </span>
        );
      break;
    }
    case 'bool':
      control = (
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
      break;
    case 'choice':
      control = (
        <select
          id={id}
          value={String(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          {kind.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    case 'text':
      control = (
        <input
          id={id}
          type="text"
          maxLength={kind.maxLength}
          value={String(value)}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case 'path':
      control = (
        <span className="path-field">
          <input
            id={id}
            type="text"
            value={String(value)}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              void open({
                multiple: false,
                directory: false,
                filters: kind.extensions.length
                  ? [{ name: spec.label, extensions: kind.extensions }]
                  : [],
              }).then((path) => {
                if (typeof path === 'string') onChange(path);
              });
            }}
          >
            Browse…
          </button>
        </span>
      );
      break;
  }
  return (
    <div className="param-field" title={spec.help ?? undefined}>
      <label htmlFor={id}>
        {spec.label}
        {spec.required && <span className="required"> *</span>}
      </label>
      {control}
    </div>
  );
}
