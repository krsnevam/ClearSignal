// Node entry for local dev and the video shoot: one process, so SMS → SSE is instant.
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { loadConfig } from './config';
import { buildDeps } from './deps';

const cfg = loadConfig(process.env);
const deps = buildDeps(cfg);
const app = createApp(deps);
const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, () => {
  console.log(
    `ClearSignal API on http://localhost:${port} · store=${deps.store.kind} · scenario=${deps.clock.scenario ?? 'live'} · sim=${deps.clock.now().toISOString()}`,
  );
});
