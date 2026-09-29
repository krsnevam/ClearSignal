import type { RawEvent, Recommendation } from '@clearsignal/schema';
import type { SourceHealthRow, Store } from './types';

/** Default store for local dev and the replay demo. Holds everything in RAM. */
export class MemoryStore implements Store {
  readonly kind = 'memory' as const;
  private events = new Map<string, RawEvent>();
  private sorted: RawEvent[] | null = null;
  private health = new Map<string, SourceHealthRow>();
  latestRecommendations: readonly Recommendation[] = [];

  constructor(seed: readonly RawEvent[] = []) {
    for (const e of seed) this.events.set(e.id, e);
  }

  async insertEvents(events: readonly RawEvent[]) {
    let n = 0;
    for (const e of events) {
      if (this.events.has(e.id)) continue;
      this.events.set(e.id, e);
      n++;
    }
    if (n > 0) this.sorted = null;
    return n;
  }

  private all(): RawEvent[] {
    this.sorted ??= [...this.events.values()].sort((a, b) =>
      a.observed_at_utc.localeCompare(b.observed_at_utc),
    );
    return this.sorted;
  }

  async eventsBetween(fromMs: number, toMs: number) {
    return this.all().filter((e) => {
      const t = Date.parse(e.observed_at_utc);
      return t > fromMs && t <= toMs;
    });
  }

  async lastSeenBySource(atMs: number) {
    const out = new Map<string, string>();
    for (const e of this.all()) {
      if (Date.parse(e.observed_at_utc) > atMs) break;
      out.set(e.source_id, e.observed_at_utc);
    }
    return out;
  }

  async sourceHealth() {
    return [...this.health.values()];
  }

  async recordSourceResult(sourceId: string, ok: boolean, error?: string) {
    const row = this.health.get(sourceId) ?? {
      source_id: sourceId,
      last_success_at: null,
      last_error_at: null,
      last_error_msg: null,
    };
    const now = new Date().toISOString();
    if (ok) row.last_success_at = now;
    else {
      row.last_error_at = now;
      row.last_error_msg = error ?? 'unknown error';
    }
    this.health.set(sourceId, row);
  }

  async saveRecommendations(_computedAt: Date, recs: readonly Recommendation[]) {
    this.latestRecommendations = recs;
  }
}
