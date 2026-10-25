/** Captures the documentation screenshot: `npm run docs:screenshot`. */
import { config as base } from './wdio.conf';

export const config: WebdriverIO.Config = {
  ...base,
  specs: ['./tools/screenshot.ts'],
};
