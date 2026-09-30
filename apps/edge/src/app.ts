import { dedupe, normalizeEvent, type Village, weightsYaml } from '@clearsignal/fusion';
import { type RawEvent, type RawEventInput, tierOf, type Weights } from '@clearsignal/schema';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import type { Bus } from './bus';
import type { Clock } from './clock';
import type { Config } from './config';
import { computeRanking, sourcesStatus, toContributing } from './pipeline';
import { hashSender, locate, polarity, SenderRateLimiter, stripPii } from './sms/parse';
import { twiml, verifyTwilio } from './sms/twilio';
import type { Store } from './store/types';

export interface AppDeps {
  cfg: Config;
  store: Store;
  clock: Clock;
  bus: Bus;
  weights: Weights;
  villages: readonly Village[];
  /** sha256 sender hash → village_id, for volunteers who pre-registered. */
  volunteerRegistry?: Readonly<Record<string, string>>;
}

const IngestBody = z.object({
  events: z.array(z.unknown()).default([]),
  source_results: z
    .array(z.object({ source_id: z.string(), ok: z.boolean(), error: z.string().optional() }))
    .default([]),
});

export function createApp(d: AppDeps) {
  const app = new Hono();
  const origins = d.cfg.ALLOWED_ORIGINS.split(',').map((s) => s.trim());

  app.use(
    '*',
    cors({
      origin: origins.includes('*') ? '*' : origins,
      allowMethods: ['GET', 'POST', 'OPTIONS'],
    }),
  );

  app.use('*', secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }));
  const smsLimiter = new SenderRateLimiter(d.cfg.SMS_RATE_LIMIT);

  /** Presenter controls are open when DEMO_CONTROLS=on, otherwise need the ingest token. */
  const canControl = (auth: string | undefined) =>
    d.cfg.DEMO_CONTROLS === 'on' ||
    (!!d.cfg.INGEST_TOKEN && auth === `Bearer ${d.cfg.INGEST_TOKEN}`);

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: 'internal_error' }, 500);
  });

  app.get('/', (c) =>
    c.json({
      name: 'ClearSignal API',
      district: 'kodagu',
      scenario: d.clock.scenario,
      store: d.store.kind,
      replay: d.clock.info(),
      demo_controls: d.cfg.DEMO_CONTROLS === 'on',
    }),
  );
  app.get('/health', (c) => c.json({ ok: true }));

  // ── GET /rankings ─────────────────────────────────────────────────────────
  app.get('/rankings', async (c) => {
    const district = c.req.query('district') ?? 'kodagu';
    if (district !== 'kodagu')
      return c.json({ error: 'only district=kodagu is supported in v1' }, 400);
    const { ranking } = await computeRanking(d);
    c.header('Cache-Control', 'no-cache');
    return c.json(ranking);
  });

  // ── GET /recommendation/:id ───────────────────────────────────────────────
  app.get('/recommendation/:id', async (c) => {
    const { ranking, events } = await computeRanking(d);
    const rec = ranking.recommendations.find((r) => r.id === c.req.param('id'));
    if (!rec) return c.json({ error: 'not_found' }, 404);
    const now = new Date(ranking.scenario_clock_utc);
    const ids = new Set(rec.contributing_event_ids);
    return c.json({
      recommendation: rec,
      events: events
        .filter((e) => ids.has(e.id))
        .map((e) => toContributing(e, now))
        .sort((a, b) => a.age_sec - b.age_sec),
      formula: d.weights.formula,
    });
  });

  // ── GET /sources/status ───────────────────────────────────────────────────
  app.get('/sources/status', async (c) => c.json({ sources: await sourcesStatus(d) }));

  // ── GET /weights — auditable formula, served verbatim ─────────────────────
  app.get('/weights', (c) =>
    c.text(weightsYaml, 200, { 'Content-Type': 'text/yaml; charset=utf-8' }),
  );

  // ── GET /stream — Server-Sent Events: tells clients to refetch ────────────
  app.get('/stream', (c) =>
    streamSSE(c, async (stream) => {
      let open = true;
      const unsubscribe = d.bus.subscribe((m) => {
        stream.writeSSE({ event: m.type, data: JSON.stringify(m) }).catch(() => {});
      });
      stream.onAbort(() => {
        open = false;
        unsubscribe();
      });
      await stream.writeSSE({
        event: 'hello',
        data: JSON.stringify({ scenario: d.clock.scenario }),
      });
      while (open) {
        await stream.sleep(15_000);
        if (open) await stream.writeSSE({ event: 'ping', data: '{}' });
      }
    }),
  );

  // ── POST /sms-webhook — Twilio (form) or MSG91 (JSON) ─────────────────────
  app.post('/sms-webhook', async (c) => {
    const twilioSig = c.req.header('x-twilio-signature');
    let from: string;
    let body: string;
    let messageId: string;
    let sourceId: 'twilio-sms' | 'msg91-sms';

    if (twilioSig !== undefined) {
      const form = await c.req.parseBody();
      const params = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, String(v)]));
      if (d.cfg.TWILIO_AUTH_TOKEN) {
        const url = d.cfg.PUBLIC_WEBHOOK_URL ?? c.req.url;
        if (!(await verifyTwilio(d.cfg.TWILIO_AUTH_TOKEN, url, params, twilioSig))) {
          return c.text('invalid signature', 403);
        }
      }
      from = params.From ?? '';
      body = params.Body ?? '';
      messageId = params.MessageSid ?? crypto.randomUUID();
      sourceId = 'twilio-sms';
    } else {
      if (d.cfg.MSG91_WEBHOOK_TOKEN && c.req.query('token') !== d.cfg.MSG91_WEBHOOK_TOKEN) {
        return c.json({ error: 'unauthorized' }, 401);
      }
      const json = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
      from = String(json.sender ?? json.number ?? json.mobile ?? json.from ?? '');
      body = String(json.message ?? json.content ?? json.text ?? json.body ?? '');
      messageId = String(json.requestId ?? json.id ?? crypto.randomUUID());
      sourceId = 'msg91-sms';
    }

    if (!body.trim()) return reply(c, sourceId, 'Empty message', 400);

    const fromHash = await hashSender(from, d.cfg.SMS_HASH_SALT);
    if (!smsLimiter.allow(fromHash)) {
      return reply(
        c,
        sourceId,
        'ClearSignal: we already have your recent reports. Thank you.',
        202,
        {
          rate_limited: true,
        },
      );
    }
    const loc = locate(body, d.villages, d.volunteerRegistry, fromHash);
    if (!loc) {
      return reply(
        c,
        sourceId,
        'ClearSignal: please include your village name (e.g. "Makkandur flooded").',
        202,
      );
    }

    const now = d.clock.now();
    const received = new Date();
    const event = normalizeEvent(
      {
        id: await uuidFrom(`${sourceId}:${messageId}`),
        source_id: sourceId,
        source_tier: tierOf(sourceId),
        event_type: 'citizen_report',
        location: {
          lat: loc.lat,
          lon: loc.lon,
          grid_cell_id: '',
          place_name: loc.village?.place_name ?? null,
          taluka: loc.village?.taluka ?? null,
          district: 'kodagu',
        },
        observed_at_utc: now.toISOString(),
        received_at_utc: received.toISOString(),
        raw_value: { body: stripPii(body), from_hash: fromHash, located_by: loc.method },
        normalized_value: null,
        confidence_hint: null,
        polarity: polarity(body),
      },
      d.villages,
    );
    const inserted = await d.store.insertEvents([event]);
    await d.store.recordSourceResult(sourceId, true);
    if (inserted > 0) {
      d.bus.publish({
        type: 'rankings-changed',
        reason: 'sms',
        place_name: event.location.place_name,
        at_utc: received.toISOString(),
      });
    }
    const ack =
      d.cfg.SMS_ACK === 'on'
        ? `ClearSignal: ${event.polarity === -1 ? 'all-clear' : 'flood'} report for ${
            event.location.place_name ?? 'your area'
          } received. Thank you.${event.polarity === -1 ? '' : ' Text SAFE when the water goes down.'}`
        : null;
    return reply(c, sourceId, ack, 200, {
      event_id: event.id,
      place_name: event.location.place_name,
      polarity: event.polarity,
    });
  });

  // ── POST /ingest — normalized batches from the Python worker ──────────────
  app.post('/ingest', async (c) => {
    if (!d.cfg.INGEST_TOKEN || c.req.header('authorization') !== `Bearer ${d.cfg.INGEST_TOKEN}`) {
      return c.json({ error: 'unauthorized' }, 401);
    }
    const parsed = IngestBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: 'bad_request', issues: parsed.error.issues }, 400);

    const accepted: RawEvent[] = [];
    const rejected: { index: number; error: string }[] = [];
    parsed.data.events.forEach((raw, index) => {
      try {
        const input = raw as RawEventInput;
        // Tier is fixed by the registry — a feed cannot promote itself (§3.3).
        const tier = tierOf(input.source_id);
        accepted.push(normalizeEvent({ ...input, source_tier: tier }, d.villages));
      } catch (err) {
        rejected.push({ index, error: err instanceof Error ? err.message : String(err) });
      }
    });
    const inserted = await d.store.insertEvents(dedupe(accepted));
    for (const r of parsed.data.source_results)
      await d.store.recordSourceResult(r.source_id, r.ok, r.error);
    if (inserted > 0) {
      d.bus.publish({
        type: 'rankings-changed',
        reason: 'ingest',
        at_utc: new Date().toISOString(),
      });
    }
    return c.json({ inserted, rejected });
  });

  // ── POST /replay/restart — jump the replay loop back to its first frame ───
  app.post('/replay/restart', (c) => {
    if (!canControl(c.req.header('authorization'))) return c.json({ error: 'unauthorized' }, 401);
    d.clock.restart();
    d.bus.publish({
      type: 'rankings-changed',
      reason: 'replay-restart',
      at_utc: new Date().toISOString(),
    });
    return c.json({ scenario_clock_utc: d.clock.now().toISOString(), replay: d.clock.info() });
  });

  // ── POST /replay/speed {speed} — 0 pauses, 1 real time, 60 default ───────
  app.post('/replay/speed', async (c) => {
    if (!canControl(c.req.header('authorization'))) return c.json({ error: 'unauthorized' }, 401);
    const body = z
      .object({ speed: z.number().min(0).max(600) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'speed must be a number 0–600' }, 400);
    d.clock.setSpeed(body.data.speed);
    d.bus.publish({
      type: 'rankings-changed',
      reason: 'replay-restart',
      at_utc: new Date().toISOString(),
    });
    return c.json({ scenario_clock_utc: d.clock.now().toISOString(), replay: d.clock.info() });
  });

  return app;
}

// Twilio expects TwiML; MSG91 expects JSON.
function reply(
  c: import('hono').Context,
  source: 'twilio-sms' | 'msg91-sms',
  message: string | null,
  status: 200 | 202 | 400,
  extra: Record<string, unknown> = {},
) {
  if (source === 'twilio-sms') {
    // Twilio treats non-2xx as failure and retries; always 200 with TwiML.
    return c.body(twiml(message ?? undefined), 200, { 'Content-Type': 'text/xml' });
  }
  return c.json({ ok: status < 300, message, ...extra }, status);
}

/** Deterministic UUID (v4-shaped) from a provider message id → idempotent retries. */
async function uuidFrom(key: string): Promise<string> {
  const buf = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)));
  buf[6] = ((buf[6] ?? 0) & 0x0f) | 0x40;
  buf[8] = ((buf[8] ?? 0) & 0x3f) | 0x80;
  const h = [...buf.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}
