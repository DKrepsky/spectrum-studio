import { useState } from 'react';

interface NameFormProps {
  initial: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<void>;
  onCancel?: () => void;
}

export function NameForm({ initial, submitLabel, onSubmit, onCancel }: NameFormProps) {
  const [name, setName] = useState(initial);
  const valid = name.trim().length > 0 && name.trim().length <= 80;
  return (
    <form
      className="name-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) void onSubmit(name.trim());
      }}
    >
      <input
        type="text"
        aria-label="Configuration name"
        value={name}
        maxLength={80}
        autoFocus
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel?.()}
      />
      <button type="submit" className="small" disabled={!valid}>
        {submitLabel}
      </button>
      {onCancel && (
        <button type="button" className="small" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}
