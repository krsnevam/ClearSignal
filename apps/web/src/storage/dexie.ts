import type { Recommendation, RecommendationDetail, SourceStatus } from '@clearsignal/schema';
import Dexie, { type Table } from 'dexie';

export interface CachedRanking {
  district: string;
  computed_at_utc: string;
  scenario_clock_utc: string;
  scenario: string | null;
  recommendations: Recommendation[];
  sources_status: SourceStatus[];
  synced_at_local: number;
}

export interface CachedEvent {
  id: string;
  grid_cell_id: string;
  event_type: string;
  observed_at_utc: string;
  source_id: string;
  source_tier: 'T1' | 'T2' | 'T3' | 'T4';
  normalized_value: number | null;
}

export interface CachedDetail {
  id: string;
  detail: RecommendationDetail;
  synced_at_local: number;
}

class ClearSignalDb extends Dexie {
  rankings!: Table<CachedRanking, string>;
  events!: Table<CachedEvent, string>;
  sourcesStatus!: Table<{ source_id: string; last_seen_utc: string; healthy: boolean }, string>;
  details!: Table<CachedDetail, string>;

  constructor() {
    super('clearsignal');
    this.version(1).stores({
      rankings: 'district, computed_at_utc',
      events: 'id, [grid_cell_id+observed_at_utc], event_type, source_id',
      sourcesStatus: 'source_id, last_seen_utc',
    });
    // v2: cache the "why" view so tapping a card works offline.
    this.version(2).stores({ details: 'id, synced_at_local' });
  }
}

export const db = new ClearSignalDb();

/** Ask the browser not to evict our cache under storage pressure — before the event begins. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    // Not fatal: data is still cached, just evictable.
  }
  return false;
}
