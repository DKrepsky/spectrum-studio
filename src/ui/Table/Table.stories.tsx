import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';

import { Table } from './index';

const columns = [
  { key: 'id', header: 'Peak' },
  { key: 'freq', header: 'Frequency' },
  { key: 'level', header: 'Level' },
];

const meta = {
  title: 'UI/Table',
  component: Table,
  args: {
    label: 'Peaks',
    columns,
    rows: [
      { key: 'p1', cells: ['P1', '433.92 MHz', '-41.2 dBFS'] },
      { key: 'p2', cells: ['P2', '434.50 MHz', '-58.7 dBFS'] },
      { key: 'p3', cells: ['P3', '868.30 MHz', '-63.0 dBFS'] },
    ],
    emptyText: 'No peaks above the detection criteria.',
  },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The active row (the active marker) has the control surface. */
export const ActiveRow: Story = {
  args: {
    rows: [
      { key: 'm1', active: true, cells: ['M1', '433.92 MHz', '-41.2 dBFS'] },
      { key: 'm2', cells: ['M2', '434.50 MHz', '-58.7 dBFS'] },
    ],
  },
};

/** Rows that are pointer targets select on click; keyboard selection is the caller's (DESIGN.md 5.3). */
export const Selectable: Story = {
  args: {
    rows: [
      { key: 'p1', onSelect: fn(), cells: ['P1', '433.92 MHz', '-41.2 dBFS'] },
      { key: 'p2', onSelect: fn(), cells: ['P2', '434.50 MHz', '-58.7 dBFS'] },
    ],
  },
};

export const Empty: Story = {
  args: { rows: [] },
};

export const LongText: Story = {
  args: {
    columns: [
      { key: 'source', header: 'Source' },
      { key: 'level', header: 'Level' },
    ],
    rows: [
      {
        key: 'long',
        cells: [
          'Bench analyzer 3 on /dev/ttyACM0 (SA430 08FF41E50F8B3A34) with the long calibration file',
          '-41.2 dBFS',
        ],
      },
    ],
  },
};
