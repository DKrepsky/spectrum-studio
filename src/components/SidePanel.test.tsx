import '../test/mockApi';

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';

import { SidePanel } from './SidePanel';

const HERE = __dirname;

/** Raw elements the side panel must not use any more: they are `src/ui/` components now (DESIGN.md 10.2). */
const RAW = /<(button|input|select|details|summary|table)[\s>/]/;

describe('SidePanel', () => {
  it('renders each section as a ui Section, open by default except Source settings', () => {
    const { container } = render(<SidePanel />);
    const sections = Array.from(container.querySelectorAll('details'));
    expect(sections.map((d) => d.querySelector('summary')?.textContent)).toEqual([
      'Measurement',
      'Markers',
      'Peaks',
      'Display',
      'Source settings',
    ]);
    expect(sections.map((d) => d.open)).toEqual([true, true, true, true, false]);
    expect(sections.every((d) => d.classList.contains('ui-section'))).toBe(true);
    expect(screen.getByRole('complementary', { name: 'Analysis controls' })).toBeInTheDocument();
  });

  it('uses no raw controls in the side panel or its parameter form', () => {
    const files = [
      resolve(HERE, 'SidePanel.tsx'),
      resolve(HERE, 'ParamForm.tsx'),
      ...readdirSync(resolve(HERE, 'panels'))
        .filter((name) => name.endsWith('.tsx'))
        .map((name) => resolve(HERE, 'panels', name)),
    ];
    const offenders = files.filter((file) => RAW.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});
