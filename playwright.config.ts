import { defineConfig, devices } from '@playwright/test';

/** Browser tests on the sample-data preview, at a phone's width and a computer's. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    // Figures that count up would be read part way; with reduced motion they show at once.
    contextOptions: { reducedMotion: 'reduce' },
  },
  projects: [
    {
      name: 'phone',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'npm run dev:preview',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
