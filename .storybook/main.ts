import type { StorybookConfig } from '@storybook/react-vite';

// Storybook is a dev-only catalogue of src/ui (ADR 0016). It never enters the app build: nothing
// under src/ imports it outside *.stories.tsx and tests (src/ui/stories.test.tsx enforces this).
const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  framework: '@storybook/react-vite',
  // The accessibility panel (axe) for each story. The same engine runs in `src/ui/stories.test.tsx`.
  addons: ['@storybook/addon-a11y'],
  core: {
    // Local-first app: no telemetry, no crash reports.
    disableTelemetry: true,
    enableCrashReports: false,
  },
  viteFinal: (config) => ({
    ...config,
    // vite.config.ts pins port 1420 with strictPort for `tauri dev`; Storybook must not clash.
    server: { ...config.server, port: undefined, strictPort: false },
  }),
};

export default config;
