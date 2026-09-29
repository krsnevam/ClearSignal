import { defaultWeights } from '@clearsignal/fusion';
import { KODAGU_2018_EVENTS, VILLAGES } from '@clearsignal/kodagu-fixtures';
import type { Ranking, RecommendationDetail } from '@clearsignal/schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app';
import { Bus, type BusMessage } from './bus';
import { LoopingReplayClock } from './clock';
import { loadConfig } from './config';
import { hashSender, locate, polarity, stripPii } from './sms/parse';
import { twilioSignature } from './sms/twilio';
import { MemoryStore } from './store/memory';

const T0 = '2018-08-16T03:30:00Z';

function setup(env: Record<string, string> = {}) {
  const cfg = loadConfig({ INGEST_TOKEN: 'tok', ...env });
  let wall = Date.parse('2026-01-01T00:00:00Z'); // == default anchor → sim at T0
  const clock = new LoopingReplayClock('kodagu-2018', T0, 60, 3, cfg.REPLAY_ANCHOR_UTC, () => wall);
  const bus = new Bus();
  const store = new MemoryStore(KODAGU_2018_EVENTS);
  const app = createApp({ cfg, clock, bus, store, weights: defaultWeights, villages: VILLAGES });
  return { app, bus, store, clock, advance: (ms: number) => (wall += ms) };
}

describe('GET /rankings', () => {
  it('returns the Kodagu ranking at the replay clock', async () => {
    const { app } = setup();
    const res = await app.request('/rankings?district=kodagu');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Ranking;
    expect(body.scenario_clock_utc).toBe(new Date(T0).toISOString());
    expect(body.recommendations[0]?.band).toBe('H');
    expect(body.recommendations.map((r) => r.place_name).slice(0, 3)).toContain('Makkandur');
    expect(body.sources_status.find((s) => s.source_id === 'sentinel-1-cdse')?.healthy).toBe(true);
  });

  it('rejects other districts', async () => {
    const { app } = setup();
    expect((await app.request('/rankings?district=wayanad')).status).toBe(400);
  });

  it('the replay loop advances at 60×', async () => {
    const { app, advance } = setup();
    advance(60_000);
    const body = (await (await app.request('/rankings')).json()) as Ranking;
    expect(body.scenario_clock_utc).toBe('2018-08-16T04:30:00.000Z');
  });
});

describe('GET /recommendation/:id', () => {
  it('explains a card with its contributing events', async () => {
    const { app } = setup();
    const res = await app.request('/recommendation/kdg-mukkodlu');
    const body = (await res.json()) as RecommendationDetail;
    expect(body.recommendation.conflict_flag).toBe(true);
    expect(body.events.some((e) => e.polarity === -1)).toBe(true);
    expect(body.events.every((e) => e.summary.length > 0)).toBe(true);
    expect(body.formula.agreement_weight).toBe(0.45);
  });

  it('404s unknown ids', async () => {
    const { app } = setup();
    expect((await app.request('/recommendation/nope')).status).toBe(404);
  });
});

describe('POST /sms-webhook', () => {
  let ctx: ReturnType<typeof setup>;
  let messages: BusMessage[];
  beforeEach(() => {
    ctx = setup({
      TWILIO_AUTH_TOKEN: 'secret',
      PUBLIC_WEBHOOK_URL: 'https://api.clearsignal.app/sms-webhook',
    });
    messages = [];
    ctx.bus.subscribe((m) => messages.push(m));
  });

  async function twilioPost(params: Record<string, string>, sig?: string) {
    const signature =
      sig ?? (await twilioSignature('secret', 'https://api.clearsignal.app/sms-webhook', params));
    return ctx.app.request('/sms-webhook', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': signature,
      },
      body: new URLSearchParams(params).toString(),
    });
  }

  it('ingests a signed Twilio SMS and raises Bhagamandala within the same request', async () => {
    const before = (await (await ctx.app.request('/rankings')).json()) as Ranking;
    const b0 = before.recommendations.find((r) => r.place_name === 'Bhagamandala');
    const res = await twilioPost({
      From: '+919876543210',
      Body: 'Bhagamandala flooded near school',
      MessageSid: 'SM1',
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/xml');
    expect(messages).toHaveLength(1);
    expect(messages[0]?.place_name).toBe('Bhagamandala');
    const after = (await (await ctx.app.request('/rankings')).json()) as Ranking;
    const b1 = after.recommendations.find((r) => r.place_name === 'Bhagamandala');
    expect(b1?.contributing_event_ids.length).toBeGreaterThan(
      b0?.contributing_event_ids.length ?? 0,
    );
  });

  it('is idempotent on Twilio retries', async () => {
    await twilioPost({ From: '+91987', Body: 'Makkandur flooded', MessageSid: 'SM2' });
    await twilioPost({ From: '+91987', Body: 'Makkandur flooded', MessageSid: 'SM2' });
    expect(messages).toHaveLength(1);
  });

  it('rejects a bad signature', async () => {
    const res = await twilioPost(
      { From: '+91', Body: 'Makkandur flooded', MessageSid: 'SM3' },
      'forged',
    );
    expect(res.status).toBe(403);
  });

  it('never stores the phone number', async () => {
    await twilioPost({
      From: '+919876543210',
      Body: 'Makkandur call me 98765 43210',
      MessageSid: 'SM4',
    });
    const events = await ctx.store.eventsBetween(0, Date.parse('2019-01-01'));
    const stored = JSON.stringify(
      events.filter((e) => e.raw_value.from_hash && !e.raw_value.synthetic),
    );
    expect(stored).not.toContain('9876543210');
    expect(stored).not.toContain('98765 43210');
  });

  it('accepts MSG91 JSON with its token, and a safe report creates a conflict', async () => {
    const res = await ctx.app.request('/sms-webhook?token=m91', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: '919900000000',
        message: 'Makkandur water gone down we are safe',
        requestId: 'r1',
      }),
    });
    // MSG91 token not configured in this setup → accepted
    expect(res.status).toBe(200);
    expect(((await res.json()) as { polarity: number }).polarity).toBe(-1);
    const detail = (await (
      await ctx.app.request('/recommendation/kdg-makkandur')
    ).json()) as RecommendationDetail;
    expect(detail.recommendation.conflict_flag).toBe(true);
  });

  it('asks for a village name when it cannot locate the sender', async () => {
    const res = await twilioPost({ From: '+91', Body: 'help flooding here', MessageSid: 'SM5' });
    expect(await res.text()).toContain('village name');
    expect(messages).toHaveLength(0);
  });
});

describe('POST /ingest', () => {
  const event = {
    id: '11111111-2222-4333-8444-555555555555',
    source_id: 'cwc-wris',
    source_tier: 'T4', // lies about its tier
    event_type: 'river_danger',
    location: {
      lat: 12.3858,
      lon: 75.5333,
      grid_cell_id: '',
      place_name: null,
      taluka: null,
      district: 'kodagu',
    },
    observed_at_utc: '2018-08-16T03:29:00Z',
    received_at_utc: '2018-08-16T03:29:30Z',
    raw_value: { level_m: 7.9, danger_m: 6.5 },
    normalized_value: 1.2,
    confidence_hint: null,
  };

  it('requires the bearer token', async () => {
    const { app } = setup();
    const res = await app.request('/ingest', {
      method: 'POST',
      body: JSON.stringify({ events: [event] }),
    });
    expect(res.status).toBe(401);
  });

  it('normalizes, overrides the claimed tier from the registry, and reports rejects', async () => {
    const { app, store } = setup();
    const res = await app.request('/ingest', {
      method: 'POST',
      headers: { authorization: 'Bearer tok', 'content-type': 'application/json' },
      body: JSON.stringify({
        events: [event, { ...event, id: 'not-a-uuid' }],
        source_results: [{ source_id: 'imd', ok: false, error: 'HTTP 503' }],
      }),
    });
    const body = (await res.json()) as { inserted: number; rejected: unknown[] };
    expect(body.inserted).toBe(1);
    expect(body.rejected).toHaveLength(1);
    const stored = (await store.eventsBetween(0, Date.parse('2019-01-01'))).find(
      (e) => e.id === event.id,
    );
    expect(stored?.source_tier).toBe('T1');
    expect(stored?.location.place_name).toBe('Bhagamandala');
    const status = (await (await app.request('/sources/status')).json()) as {
      sources: { source_id: string; healthy: boolean; last_error_msg: string | null }[];
    };
    expect(status.sources.find((s) => s.source_id === 'imd')).toMatchObject({
      healthy: false,
      last_error_msg: 'HTTP 503',
    });
  });
});

describe('GET /weights', () => {
  it('serves the YAML verbatim', async () => {
    const { app } = setup();
    expect(await (await app.request('/weights')).text()).toContain('agreement_weight: 0.45');
  });
});

describe('SMS parsing', () => {
  it('locates by coordinates, then name, then registry', async () => {
    expect(locate('flood at 12.4632, 75.7628', VILLAGES)?.method).toBe('coordinates');
    expect(locate('MAKKANDUR flooded!!', VILLAGES)?.village?.village_id).toBe('kdg-makkandur');
    const h = await hashSender('+91 99000 11111', 'salt');
    expect(locate('water rising', VILLAGES, { [h]: 'kdg-napoklu' }, h)?.village?.place_name).toBe(
      'Napoklu',
    );
    expect(locate('water rising', VILLAGES)).toBeNull();
  });

  it('reads polarity, respecting negation', () => {
    expect(polarity('flooded near school')).toBe(1);
    expect(polarity('we are safe now')).toBe(-1);
    expect(polarity('NOT safe, water rising')).toBe(1);
    expect(polarity('water gone down')).toBe(-1);
  });

  it('strips phone numbers', () => {
    expect(stripPii('call +91 98765 43210 now')).toBe('call [number removed] now');
  });
});
