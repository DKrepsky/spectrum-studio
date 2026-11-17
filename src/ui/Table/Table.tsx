import type { ComponentProps, ReactNode } from 'react';

import './Table.css';

export interface TableColumn {
  key: string;
  header: ReactNode;
}

export interface TableRow {
  key: string;
  /** The active row (for example the active marker). */
  active?: boolean;
  /** Makes the whole row a pointer target. Keyboard selection is the caller's (DESIGN.md 5.3). */
  onSelect?: () => void;
  /** One node per column, in column order. */
  cells: ReactNode[];
}

export interface TableProps extends Omit<ComponentProps<'table'>, 'children'> {
  /** The accessible name of the table. */
  label: string;
  columns: TableColumn[];
  rows: TableRow[];
  /** Shown in one row spanning all columns when `rows` is empty. */
  emptyText: ReactNode;
}

/** A readout table of measured values: mono cells, a header, an active row, an empty row. */
export function Table({ label, columns, rows, emptyText, className, ...rest }: TableProps) {
  return (
    <table
      {...rest}
      aria-label={label}
      className={['ui-table', className].filter(Boolean).join(' ')}
    >
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column.key} scope="col">
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr className="ui-table-empty">
            <td colSpan={Math.max(columns.length, 1)}>{emptyText}</td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={row.key}
              className="ui-table-row"
              data-active={row.active ? 'true' : undefined}
              data-selectable={row.onSelect ? 'true' : undefined}
              onClick={row.onSelect}
            >
              {row.cells.map((cell, index) => (
                <td key={index}>{cell}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
