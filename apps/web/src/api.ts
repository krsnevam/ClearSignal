import { Ranking, RecommendationDetail, SourceStatus } from '@clearsignal/schema';
import { z } from 'zod';

// Default '/api' is same-origin: Vite (dev + preview) proxies it to the edge API on :8787,
// so any device on the network needs just one address. Production builds set VITE_API_BASE.
export const API_BASE: string = (import.meta.env.VITE_API_BASE as string | undefined) || '/api';

export class ApiError extends Error {}

async function get<T>(
  path: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  timeoutMs = 3000,
): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { signal: ctl.signal });
    if (!res.ok) throw new ApiError(`${path}: HTTP ${res.status}`);
    return schema.parse(await res.json());
  } finally {
    clearTimeout(timer);
  }
}

const ApiInfo = z.object({
  demo_controls: z.boolean().default(false),
  replay: z
    .object({ scenario: z.string().nullable(), speed: z.number(), paused: z.boolean() })
    .nullable()
    .default(null),
});

async function post(path: string, body?: unknown): Promise<void> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(`${path}: HTTP ${res.status}`);
}

export const api = {
  info: () => get('/', ApiInfo),
  replayRestart: () => post('/replay/restart'),
  replaySpeed: (speed: number) => post('/replay/speed', { speed }),
  rankings: () => get('/rankings?district=kodagu', Ranking),
  recommendation: (id: string) =>
    get(`/recommendation/${encodeURIComponent(id)}`, RecommendationDetail),
  sources: () => get('/sources/status', z.object({ sources: z.array(SourceStatus) })),
  streamUrl: () => `${API_BASE}/stream`,
};
