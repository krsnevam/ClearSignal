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
      timeout: 120_000,
      reuseExistingServer: true,
      env: { INGEST_TOKEN: 'e2e-token', REPLAY_ANCHOR_UTC: new Date().toISOString() },
    },
    // Local build: VITE_API_BASE empty → the app calls /api, proxied to :8787 by `vite preview`.
    {
      command: 'pnpm build && pnpm preview',
      url: 'http://localhost:4173',
      reuseExistingServer: true,
      timeout: 240_000,
      env: { VITE_API_BASE: '' },
    },
  ],
});
