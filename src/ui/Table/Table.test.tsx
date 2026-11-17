import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Table, type TableRow } from './Table';

const columns = [
  { key: 'id', header: '' },
  { key: 'frequency', header: 'Frequency' },
  { key: 'level', header: 'Level' },
];

describe('Table', () => {
  it('names the table, renders headers and one cell per column', () => {
    const rows: TableRow[] = [{ key: 'm1', cells: ['M1', '2.4 GHz', '-40.0 dBm'] }];
    render(<Table label="Markers" columns={columns} rows={rows} emptyText="None." />);
    const table = screen.getByRole('table', { name: 'Markers' });
    expect(screen.getAllByRole('columnheader')).toHaveLength(3);
    expect(screen.getByRole('cell', { name: 'M1' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '-40.0 dBm' })).toBeInTheDocument();
    expect(table.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('marks the active row and no other', () => {
    const rows: TableRow[] = [
      { key: 'm1', cells: ['M1', 'a', 'b'] },
      { key: 'm2', active: true, cells: ['M2', 'c', 'd'] },
    ];
    const { container } = render(
      <Table label="Markers" columns={columns} rows={rows} emptyText="None." />,
    );
    const body = container.querySelectorAll('tbody tr');
    expect(body[0]).not.toHaveAttribute('data-active');
    expect(body[1]).toHaveAttribute('data-active', 'true');
  });

  it('shows the empty text in one row spanning every column', () => {
    const { container } = render(
      <Table
        label="Peaks"
        columns={columns}
        rows={[]}
        emptyText="No peaks above the detection criteria."
      />,
    );
    const cell = screen.getByText('No peaks above the detection criteria.');
    expect(cell.tagName).toBe('TD');
    expect(cell).toHaveAttribute('colspan', '3');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('is a pointer target only when a row has onSelect', async () => {
    const onSelect = vi.fn();
    const rows: TableRow[] = [
      { key: 'p1', onSelect, cells: ['P1', '1 GHz', '0 dBm'] },
      { key: 'p2', cells: ['P2', '2 GHz', '0 dBm'] },
    ];
    const { container } = render(
      <Table label="Peaks" columns={columns} rows={rows} emptyText="None." />,
    );
    const [selectable, fixed] = container.querySelectorAll('tbody tr');
    expect(selectable).toHaveAttribute('data-selectable', 'true');
    expect(fixed).not.toHaveAttribute('data-selectable');

    await userEvent.click(screen.getByRole('cell', { name: 'P1' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('cell', { name: 'P2' }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});
