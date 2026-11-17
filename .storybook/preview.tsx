import type { Preview } from '@storybook/react-vite';

// Same CSS, same order as src/main.tsx: the tokens first, then the app's global rules.
import '../src/styles/tokens.css';
import '../src/styles/app.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    backgrounds: { disable: true },
    controls: { matchers: { color: /(background|color)$/i } },
  },
  decorators: [
    (Story) => (
      <div style={{ padding: 'var(--space-6)' }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
