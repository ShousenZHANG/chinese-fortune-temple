import { defineConfig, devices } from '@playwright/test';

// Tests run against the built site (npm run build), the same files Cloudflare Pages serves.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? 'github' : 'list',
  // The interface follows the browser language; tests read Chinese labels unless a spec asks for English.
  use: { baseURL: 'http://127.0.0.1:4780', trace: 'retain-on-failure', locale: 'zh-CN',
    // A service worker would precache the whole 24 MB site in every fresh context; only offline.spec turns it on.
    serviceWorkers: 'block' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4780', reuseExistingServer: !process.env.CI },
});
