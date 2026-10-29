import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// In some sandboxes Chromium is pre-installed at this path; locally Playwright uses its own.
const preinstalled = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests',
  testMatch: /.*\.spec\.ts/,
  timeout: 120_000,
  fullyParallel: false,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4322',
    launchOptions: existsSync(preinstalled) ? { executablePath: preinstalled } : {},
  },
  webServer: {
    command: 'npm run build:fast && node scripts/serve-dist.mjs 4322',
    url: 'http://127.0.0.1:4322',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } },
  ],
});
