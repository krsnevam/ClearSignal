import type { RawEvent, Recommendation } from '@clearsignal/schema';

export interface SourceHealthRow {
  source_id: string;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error_msg: string | null;
}

export interface Store {
  readonly kind: 'memory' | 'neon';
  /** Inserts events, ignoring ids already stored. Returns the number inserted. */
  insertEvents(events: readonly RawEvent[]): Promise<number>;
  /** Events with observed_at in (fromMs, toMs]. */
  eventsBetween(fromMs: number, toMs: number): Promise<RawEvent[]>;
  /** Latest observed_at per source at or before `atMs` (for replay health). */
  lastSeenBySource(atMs: number): Promise<Map<string, string>>;
  sourceHealth(): Promise<SourceHealthRow[]>;
  recordSourceResult(sourceId: string, ok: boolean, error?: string): Promise<void>;
  saveRecommendations(computedAt: Date, recs: readonly Recommendation[]): Promise<void>;
}
