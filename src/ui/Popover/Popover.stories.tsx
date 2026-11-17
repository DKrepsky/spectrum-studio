import { useRef, type ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Badge } from '../Badge';
import { Button } from '../Button';
import { Field, TextField } from '../Field';
import { IconButton } from '../IconButton';
import { InlineMessage } from '../InlineMessage';
import { Popover } from './Popover';
import { PopoverGroup } from './PopoverGroup';
import { ListRow } from './ListRow';

type PopoverProps = ComponentProps<typeof Popover>;

/** The popover is anchored to its trigger (DESIGN.md 4.11); the story supplies the trigger. */
function PopoverOnTrigger({ children, ...rest }: Omit<PopoverProps, 'anchorRef'>) {
  const anchor = useRef<HTMLButtonElement>(null);
  return (
    <div style={{ position: 'relative', width: 'var(--popover-width)' }}>
      <Button ref={anchor}>Source: Simulator</Button>
      <Popover {...rest} anchorRef={anchor}>
        {children}
      </Popover>
    </div>
  );
}

/**
 * Axe's `label-content-name-mismatch` is off in the stories that show a transport badge. A row's
 * accessible name is its name and status word (DESIGN.md 9.12); the badge (and a port or device id)
 * is supplementary text the name leaves out, which axe reads as a mismatch. Open for the PM (work
 * 010): if the transport belongs in the name, `ListRow`'s `label` changes, and this goes.
 */
const BADGE_OUTSIDE_NAME = {
  a11y: { config: { rules: [{ id: 'label-content-name-mismatch', enabled: false }] } },
};

const meta = {
  title: 'UI/Popover',
  component: PopoverOnTrigger,
  args: {
    label: 'Sources',
    onClose: fn(),
    children: (
      <>
        <PopoverGroup label="Sources">
          <ListRow label="Simulator, Available" current onSelect={fn()}>
            <span>Simulator</span>
            <Badge variant="chip">Built-in</Badge>
          </ListRow>
          <ListRow label="SA430 08FF41E50F8B3A34, Connected" onSelect={fn()}>
            <span>SA430 08FF41E50F8B3A34</span>
            <Badge variant="chip">USB</Badge>
          </ListRow>
        </PopoverGroup>
        <PopoverGroup label="Add a source" divided>
          <ListRow label="Add a source, Serial" onSelect={fn()}>
            <span>Add a source…</span>
          </ListRow>
        </PopoverGroup>
      </>
    ),
  },
} satisfies Meta<typeof PopoverOnTrigger>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The list: the current row has focus on open, Up and Down move between rows. */
export const Default: Story = { parameters: BADGE_OUTSIDE_NAME };

/** Row actions sit in the badge column; they are ordinary buttons (DESIGN.md 4.11, I5). */
export const RowActions: Story = {
  parameters: BADGE_OUTSIDE_NAME,
  args: {
    children: (
      <PopoverGroup label="Sources">
        <ListRow
          label="Bench SA430, Connected"
          current
          onSelect={fn()}
          actions={
            <>
              <IconButton variant="filled" label="Edit Bench SA430">
                ✎
              </IconButton>
              <IconButton variant="filled" label="Forget Bench SA430">
                🗑
              </IconButton>
            </>
          }
        >
          <span>Bench SA430</span>
          <Badge variant="chip">USB</Badge>
        </ListRow>
      </PopoverGroup>
    ),
  },
};

/** Visible and focusable, not actionable: the reason is in the row's description (DESIGN.md 5.4). */
export const RowUnavailable: Story = {
  args: {
    children: (
      <PopoverGroup label="Sources">
        <ListRow label="Bench SA430, Not detected, unavailable" unavailable dimmed onSelect={fn()}>
          <span>Bench SA430</span> <span>Not detected</span>
        </ListRow>
      </PopoverGroup>
    ),
  },
};

/** A row that was just saved is briefly highlighted. */
export const RowHighlight: Story = {
  args: {
    children: (
      <PopoverGroup label="Sources">
        <ListRow label="Bench SA430, Saved" highlight current onSelect={fn()}>
          <span>Bench SA430</span>
        </ListRow>
      </PopoverGroup>
    ),
  },
};

/** A fixed, single-line item (the add action in the list). */
export const RowSingle: Story = {
  args: {
    children: (
      <PopoverGroup label="Add a source">
        <ListRow label="Add a source" size="single" onSelect={fn()}>
          <span>Add a source…</span>
        </ListRow>
      </PopoverGroup>
    ),
  },
};

export const Empty: Story = {
  args: {
    children: (
      <PopoverGroup label="Sources">
        <InlineMessage variant="hint">No sources yet. Add one below.</InlineMessage>
      </PopoverGroup>
    ),
  },
};

/** The connect form inside the popover: the first field takes focus (DESIGN.md 5.2). */
export const ConnectForm: Story = {
  args: {
    children: (
      <PopoverGroup label="Connection" divided>
        <Field label="Name" layout="stacked">
          {(control) => (
            <TextField
              id={control.id}
              aria-describedby={control.describedBy}
              invalid={control.invalid}
              value=""
              placeholder="e.g. Bench SA430"
              onChange={fn()}
            />
          )}
        </Field>
        <Button variant="primary" size="small">
          Connect
        </Button>
      </PopoverGroup>
    ),
  },
};

export const LongName: Story = {
  parameters: BADGE_OUTSIDE_NAME,
  args: {
    children: (
      <PopoverGroup label="Sources">
        <ListRow
          label="Bench analyzer 3 on /dev/ttyACM0 (SA430 08FF41E50F8B3A34), Connected"
          current
          onSelect={fn()}
        >
          <span>Bench analyzer 3 on /dev/ttyACM0 (SA430 08FF41E50F8B3A34)</span>
          <Badge variant="chip">USB</Badge>
        </ListRow>
      </PopoverGroup>
    ),
  },
};

/** The `mode` variant: a fixed-width short menu. */
export const ModeVariant: Story = {
  args: {
    variant: 'mode',
    label: 'Mode',
    children: (
      <PopoverGroup label="Mode">
        <ListRow label="Continuous" current onSelect={fn()}>
          <span>Continuous</span>
        </ListRow>
        <ListRow label="Single" onSelect={fn()}>
          <span>Single</span>
        </ListRow>
      </PopoverGroup>
    ),
  },
};
