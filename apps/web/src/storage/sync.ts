import type { Ranking } from '@clearsignal/schema';
import { api } from '../api';
import { type Update, useApp } from '../state';
import { db } from './dexie';

const POLL_MS = 5_000; // matches the replayer tick (§12.4)
let inFlight: Promise<void> | null = null;

function diff(prev: Ranking | null, next: Ranking): { changed: Set<string>; updates: Update[] } {
  const changed = new Set<string>();
  const updates: Update[] = [];
  if (!prev) return { changed, updates };
  const at = next.scenario_clock_utc;
  const before = new Map(prev.recommendations.map((r) => [r.id, r]));
  const order = { H: 3, M: 2, L: 1 } as const;
  next.recommendations.forEach((r, i) => {
    const p = before.get(r.id);
    const add = (kind: Update['kind'], extra: Partial<Update> = {}) =>
      updates.push({
        key: `${r.id}:${kind}:${at}`,
        rec_id: r.id,
        kind,
        place_name: r.place_name,
        place_name_kn: r.place_name_kn ?? null,
        band: r.band,
        rank: i + 1,
        from: p?.composite_score ?? r.composite_score,
        to: r.composite_score,
        n: 0,
        at_utc: at,
        ...extra,
      });
    if (!p) {
      changed.add(r.id);
      add('new');
      return;
    }
    if (p.band !== r.band) {
      changed.add(r.id);
      add(order[r.band] > order[p.band] ? 'up' : 'down');
    }
    if (!p.conflict_flag && r.conflict_flag) {
      changed.add(r.id);
      add('conflict');
    } else if (p.conflict_flag && !r.conflict_flag) {
      add('resolved');
    }
    const grew = r.contributing_event_ids.filter(
      (id) => !p.contributing_event_ids.includes(id),
    ).length;
    if (grew > 0) {
      changed.add(r.id);
      if (p.band === r.band) add('report', { n: grew });
    }
  });
  return { changed, updates };
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
      const prev = useApp.getState().ranking;
      // Replay looped or restarted: the clock went backwards, so start the feed afresh.
      const rewound =
        !!prev && Date.parse(next.scenario_clock_utc) < Date.parse(prev.scenario_clock_utc);
      const d = diff(rewound ? null : prev, next);
      s.set({
        ranking: next,
        syncedAt,
        reachable: !fromCache,
        changed: d.changed,
        updates: rewound ? [] : [...d.updates.reverse(), ...useApp.getState().updates].slice(0, 30),
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
    void loadInfo();
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

  const loadInfo = () =>
    api
      .info()
      .then((info) => set({ api: info }))
      .catch(() => {});
  void loadInfo();
  void loadCached().then(() => refresh());
  if (navigator.onLine) openStream();

  return () => {
    clearInterval(timer);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    es?.close();
  };
}
