import * as t from '@clearsignal/db-schema';
import type { RawEvent, Recommendation } from '@clearsignal/schema';
import { SOURCES } from '@clearsignal/schema';
import { neon } from '@neondatabase/serverless';
import { and, gt, lte, max, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import type { SourceHealthRow, Store } from './types';

/** Durable store on Neon Postgres (Mumbai). Used when DATABASE_URL is set. */
export class NeonStore implements Store {
  readonly kind = 'neon' as const;
  private db;
  private sourcesSeeded = false;

  constructor(url: string) {
    this.db = drizzle(neon(url));
  }

  private async ensureSources() {
    if (this.sourcesSeeded) return;
    await this.db
      .insert(t.sources)
      .values(
        SOURCES.map((s) => ({
          source_id: s.source_id,
          display_name: s.display_name,
          tier: s.tier,
          refresh_seconds: s.refresh_interval_seconds,
        })),
      )
      .onConflictDoNothing();
    this.sourcesSeeded = true;
  }

  async insertEvents(events: readonly RawEvent[]) {
    if (events.length === 0) return 0;
    await this.ensureSources();
    const rows = await this.db
      .insert(t.events)
      .values(
        events.map((e) => ({
          id: e.id,
          source_id: e.source_id,
          source_tier: e.source_tier,
          event_type: e.event_type,
          grid_cell_id: e.location.grid_cell_id,
          place_name: e.location.place_name,
          taluka: e.location.taluka,
          district: e.location.district,
          lat: e.location.lat,
          lon: e.location.lon,
          observed_at: e.observed_at_utc,
          received_at: e.received_at_utc,
          raw_value: e.raw_value,
          normalized_value: e.normalized_value,
          confidence_hint: e.confidence_hint,
          polarity: e.polarity,
        })),
      )
      .onConflictDoNothing()
      .returning({ id: t.events.id });
    return rows.length;
  }

  async eventsBetween(fromMs: number, toMs: number): Promise<RawEvent[]> {
    const rows = await this.db
      .select()
      .from(t.events)
      .where(
        and(
          gt(t.events.observed_at, new Date(fromMs).toISOString()),
          lte(t.events.observed_at, new Date(toMs).toISOString()),
        ),
      )
      .orderBy(t.events.observed_at);
    return rows.map((r) => ({
      id: r.id,
      source_id: r.source_id,
      source_tier: r.source_tier as RawEvent['source_tier'],
      event_type: r.event_type as RawEvent['event_type'],
      location: {
        lat: r.lat,
        lon: r.lon,
        grid_cell_id: r.grid_cell_id,
        place_name: r.place_name,
        taluka: r.taluka,
        district: 'kodagu',
      },
      observed_at_utc: new Date(r.observed_at).toISOString(),
      received_at_utc: new Date(r.received_at).toISOString(),
      raw_value: r.raw_value as Record<string, unknown>,
      normalized_value: r.normalized_value,
      confidence_hint: r.confidence_hint,
      polarity: r.polarity === -1 ? -1 : 1,
    }));
  }

  async lastSeenBySource(atMs: number) {
    const rows = await this.db
      .select({ source_id: t.events.source_id, last: max(t.events.observed_at) })
      .from(t.events)
      .where(lte(t.events.observed_at, new Date(atMs).toISOString()))
      .groupBy(t.events.source_id);
    return new Map(
      rows
        .filter((r) => r.last)
        .map((r) => [r.source_id, new Date(r.last as string).toISOString()]),
    );
  }

  async sourceHealth(): Promise<SourceHealthRow[]> {
    const rows = await this.db.select().from(t.sources);
    return rows.map((r) => ({
      source_id: r.source_id,
      last_success_at: r.last_success_at?.toISOString() ?? null,
      last_error_at: r.last_error_at?.toISOString() ?? null,
      last_error_msg: r.last_error_msg,
    }));
  }

  async recordSourceResult(sourceId: string, ok: boolean, error?: string) {
    await this.ensureSources();
    await this.db
      .update(t.sources)
      .set(
        ok
          ? { last_success_at: new Date() }
          : { last_error_at: new Date(), last_error_msg: (error ?? 'unknown error').slice(0, 500) },
      )
      .where(sql`${t.sources.source_id} = ${sourceId}`);
  }

  async saveRecommendations(computedAt: Date, recs: readonly Recommendation[]) {
    if (recs.length === 0) return;
    await this.db.insert(t.recommendations).values(
      recs.map((r) => ({
        computed_at: computedAt,
        village_id: r.village_id,
        grid_cell_id: r.grid_cell_id,
        composite_score: r.composite_score,
        band: r.band,
        reason_text: r.reason_text,
        oldest_source_age_sec: r.oldest_source_age_sec,
        conflict_flag: r.conflict_flag,
        contributing_event_ids: r.contributing_event_ids,
      })),
    );
  }
}
