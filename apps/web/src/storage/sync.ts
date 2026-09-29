import type { Ranking } from '@clearsignal/schema';
import { api } from '../api';
import { useApp } from '../state';
import { db } from './dexie';

const POLL_MS = 5_000; // matches the replayer tick (§12.4)
let inFlight: Promise<void> | null = null;

function diff(prev: Ranking | null, next: Ranking): Set<string> {
  if (!prev) return new Set();
  const before = new Map(prev.recommendations.map((r) => [r.id, r]));
  const changed = new Set<string>();
  for (const r of next.recommendations) {
    const p = before.get(r.id);
    if (
      !p ||
      p.contributing_event_ids.length !== r.contributing_event_ids.length ||
      p.band !== r.band
    ) {
      changed.add(r.id);
    }
  }
  return changed;
}

/** Last-known-good from IndexedDB — renders instantly on cold start and when offline. */
export async function loadCached(): Promise<void> {
  const cached = await db.rankings.get('kodagu').catch(() => undefined);
  if (!cached || useApp.getState().ranking) return;
  const { synced_at_local, ...ranking } = cached;
  useApp.getState().set({ ranking: ranking as Ranking, syncedAt: synced_at_local });
}

export function refresh(): Promise<void> {
  inFlight ??= (async () => {
    const s = useApp.getState();
    s.set({ syncing: true });
    try {
      const next = await api.rankings();
      // A NetworkFirst SW fallback returns an old body; its computed_at gives it away.
      const fromCache = Date.now() - Date.parse(next.computed_at_utc) > 30_000;
      const syncedAt = fromCache ? Date.parse(next.computed_at_utc) : Date.now();
      s.set({
        ranking: next,
        syncedAt,
        reachable: !fromCache,
        changed: diff(useApp.getState().ranking, next),
      });
      if (!fromCache) {
        await db.rankings.put({ ...next, synced_at_local: syncedAt }).catch(() => {});
        await db.sourcesStatus
          .bulkPut(
            next.sources_status
              .filter((x) => x.last_seen_utc)
              .map((x) => ({
                source_id: x.source_id,
                last_seen_utc: x.last_seen_utc as string,
                healthy: x.healthy,
              })),
          )
          .catch(() => {});
      }
    } catch {
      s.set({ reachable: false });
      await loadCached();
    } finally {
      useApp.getState().set({ syncing: false });
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Push/pull loop: poll while visible + online, refetch instantly on SSE and on reconnect. */
export function startSyncLoop(): () => void {
  const set = useApp.getState().set;
  let es: EventSource | null = null;

  const openStream = () => {
    if (es || typeof EventSource === 'undefined') return;
    es = new EventSource(api.streamUrl());
    es.addEventListener('rankings-changed', () => void refresh());
    es.onerror = () => {
      es?.close();
      es = null;
      setTimeout(openStream, 5_000);
    };
  };

  const onOnline = () => {
    set({ online: true });
    void refresh();
    openStream();
  };
  const onOffline = () => {
    set({ online: false });
    es?.close();
    es = null;
  };

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  const timer = setInterval(() => {
    if (navigator.onLine && document.visibilityState === 'visible') void refresh();
  }, POLL_MS);

  void loadCached().then(() => refresh());
  if (navigator.onLine) openStream();

  return () => {
    clearInterval(timer);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    es?.close();
  };
}
