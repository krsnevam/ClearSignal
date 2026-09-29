import { defineConfig, devices } from '@playwright/test';

// E2E (§14.1). Runs against `vite preview` + the Node edge server.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4173' },
  webServer: [
    {
      command: 'pnpm --filter edge start',
      url: 'http://localhost:8787/health',
      reuseExistingServer: true,
      env: { INGEST_TOKEN: 'e2e-token', REPLAY_ANCHOR_UTC: new Date().toISOString() },
    },
    {
      command: 'pnpm build && pnpm preview',
      url: 'http://localhost:4173',
      reuseExistingServer: true,
    },
  ],
});
