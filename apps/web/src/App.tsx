import { lazy, Suspense, useEffect, useState } from 'react';
import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { StalenessBanner } from './components/StalenessBanner';
import { Tabs } from './components/Tabs';
import { Primary } from './screens/Primary';
import { RecommendationDetail } from './screens/RecommendationDetail';
import { Sources } from './screens/Sources';
import { useApp } from './state';
import { bannerFor } from './status';
import { requestPersistence } from './storage/dexie';
import { startSyncLoop } from './storage/sync';

// MapLibre is ~800 KB; keep it off the critical path so the list renders in < 3 s.
const MapView = lazy(() => import('./map/MapView'));

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function App() {
  const s = useApp();
  const now = useNow(10_000);

  useEffect(() => {
    void requestPersistence();
    return startSyncLoop();
  }, []);

  const banner = bannerFor({
    online: s.online,
    reachable: s.reachable,
    syncedAt: s.syncedAt,
    ranking: s.ranking,
    nowMs: now,
  });

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col bg-paper">
      <Header />
      <OfflineBanner banner={banner} />
      <StalenessBanner banner={banner} />
      <main className="relative min-h-0 flex-1 overflow-y-auto">
        {s.tab === 'list' && <Primary />}
        {s.tab === 'sources' && <Sources />}
        {s.tab === 'map' && (
          <Suspense fallback={<p className="px-4 py-8 text-lg text-ink-2">Loading map…</p>}>
            <MapView />
          </Suspense>
        )}
      </main>
      <Tabs />
      {s.selectedId && <RecommendationDetail id={s.selectedId} />}
    </div>
  );
}
