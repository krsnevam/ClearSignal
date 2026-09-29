// Cloudflare Workers entry.
import type { Hono } from 'hono';
import { createApp } from './app';
import { loadConfig } from './config';
import { buildDeps } from './deps';

let app: Hono | null = null;

export default {
  fetch(req: Request, env: Record<string, unknown>, ctx: ExecutionContext) {
    app ??= createApp(buildDeps(loadConfig(env)));
    return app.fetch(req, env, ctx);
  },
};
