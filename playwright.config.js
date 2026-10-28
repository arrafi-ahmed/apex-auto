import { defineConfig, devices } from '@playwright/test'

const PORT = 4317

// The suite runs against a production build served by the real Express server, with its own
// throw-away database (see e2e/start-server.mjs). One worker: the tests share that server.
export default defineConfig({
  testDir: './e2e',
  workers: 1,
  fullyParallel: false,
  timeout: 45_000,
  expect: { timeout: 7_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'node e2e/start-server.mjs',
    url: `http://127.0.0.1:${PORT}/api/auth/status`,
    timeout: 120_000,
    reuseExistingServer: false,
    env: { E2E_PORT: String(PORT) }
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /\.mobile\.spec\.js$/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } }
    },
    {
      name: 'mobile',
      testMatch: /\.mobile\.spec\.js$/,
      use: { ...devices['Pixel 5'] }
    }
  ]
})
