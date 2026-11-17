import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';

import tokensCss from './tokens.css?raw';
import { parseTokens, resolveToken } from '../test/tokens';

/*
 * The token page (DESIGN.md 2.18). It is derived from tokens.css at build time, so it cannot drift
 * from the file: a token added there appears here, a removed one disappears. Values are resolved
 * with the same helper the token tests use. Styles are `var()` references only.
 */

const tokens = parseTokens(tokensCss);
const aliasBlock = /\/\* alias: migration only \*\/[\s\S]*?:root \{([\s\S]*?)\n\}/.exec(tokensCss);
const aliases = new Set([...(aliasBlock?.[1] ?? '').matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]!));

const names = (prefix: string) =>
  [...tokens.keys()].filter((name) => name.startsWith(prefix) && !aliases.has(name));

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 'var(--space-5)',
  marginBottom: 'var(--space-7)',
};
const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: 'var(--font-size-lg)',
  fontWeight: 'var(--font-weight-bold)',
  color: 'var(--color-text-primary)',
};
const captionStyle: CSSProperties = {
  color: 'var(--color-text-secondary)',
  fontSize: 'var(--font-size-sm)',
  fontFamily: 'var(--font-family-mono)',
};
const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'var(--popover-width) 1fr',
  alignItems: 'center',
  gap: 'var(--space-4)',
};
const swatchStyle = (value: string): CSSProperties => ({
  width: 'var(--control-height)',
  height: 'var(--control-height)',
  borderRadius: 'var(--radius-sm)',
  border: 'var(--focus-ring-width) solid var(--color-border-default)',
  background: value,
});

function Swatches({ prefix, title }: { prefix: string; title: string }) {
  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>{title}</h2>
      {names(prefix).map((name) => (
        <div key={name} style={rowStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <span style={swatchStyle(`var(${name})`)} />
            <span>{name}</span>
          </div>
          <span style={captionStyle}>{resolveToken(name, tokens)}</span>
        </div>
      ))}
    </section>
  );
}

function TypeScale() {
  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>Type scale</h2>
      {names('--font-size-').map((name) => (
        <div key={name} style={rowStyle}>
          <span style={captionStyle}>
            {name} {resolveToken(name, tokens)}
          </span>
          <span style={{ fontSize: `var(${name})` }}>The quick brown fox 0123456789</span>
        </div>
      ))}
      {names('--font-weight-').map((name) => (
        <div key={name} style={rowStyle}>
          <span style={captionStyle}>
            {name} {resolveToken(name, tokens)}
          </span>
          <span style={{ fontWeight: `var(${name})` }}>The quick brown fox 0123456789</span>
        </div>
      ))}
      {names('--line-height-').map((name) => (
        <div key={name} style={rowStyle}>
          <span style={captionStyle}>
            {name} {resolveToken(name, tokens)}
          </span>
          <span style={{ lineHeight: `var(${name})` }}>
            Line one of a two-line sample.
            <br />
            Line two uses the same line height token.
          </span>
        </div>
      ))}
    </section>
  );
}

function Spacing() {
  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>Spacing</h2>
      {names('--space-').map((name) => (
        <div key={name} style={rowStyle}>
          <span style={captionStyle}>
            {name} {resolveToken(name, tokens)}
          </span>
          <span
            style={{
              display: 'block',
              width: `var(${name})`,
              height: 'var(--space-5)',
              background: 'var(--color-accent)',
            }}
          />
        </div>
      ))}
    </section>
  );
}

function Radius() {
  return (
    <section style={sectionStyle}>
      <h2 style={headingStyle}>Radius</h2>
      {names('--radius-').map((name) => (
        <div key={name} style={rowStyle}>
          <span style={captionStyle}>
            {name} {resolveToken(name, tokens)}
          </span>
          <span
            style={{
              display: 'block',
              width: 'var(--control-height)',
              height: 'var(--control-height)',
              borderRadius: `var(${name})`,
              background: 'var(--color-surface-control)',
              border: 'var(--focus-ring-width) solid var(--color-border-default)',
            }}
          />
        </div>
      ))}
    </section>
  );
}

function TokensPage() {
  return (
    <div>
      <Swatches prefix="--palette-" title="Palette (primitives)" />
      <Swatches prefix="--color-" title="Colour (semantic)" />
      <TypeScale />
      <Spacing />
      <Radius />
    </div>
  );
}

const meta = {
  title: 'Design system/Tokens',
  component: TokensPage,
} satisfies Meta<typeof TokensPage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Tokens: Story = {};
