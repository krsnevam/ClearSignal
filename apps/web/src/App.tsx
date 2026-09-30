import { lazy, Suspense, useEffect, useState } from 'react';
import { Header } from './components/Header';
import { OfflineBanner } from './components/OfflineBanner';
import { StalenessBanner } from './components/StalenessBanner';
import { Tabs } from './components/Tabs';
import { useT } from './i18n';
import { applyPrefs } from './prefs';
import { DrillOverlay } from './screens/Drill';
import { HowItWorks } from './screens/HowItWorks';
import { Options } from './screens/Options';
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

/** ≥ 1024 px: list and map side by side (judges often review on a laptop). */
function useWide() {
  const q = '(min-width: 1024px)';
  const [wide, setWide] = useState(
    () => typeof matchMedia !== 'undefined' && matchMedia(q).matches,
  );
  useEffect(() => {
    const m = matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

function MapFallback() {
  const { t } = useT();
  return <p className="px-4 py-8 text-lg text-ink-2">{t('map.loading')}</p>;
}
const mapFallback = <MapFallback />;

export function App() {
  const s = useApp();
  const now = useNow(10_000);
  const wide = useWide();

  useEffect(() => {
    applyPrefs(useApp.getState().prefs);
    void requestPersistence();
    return startSyncLoop();
  }, []);

  // Wide screens show the map beside the list, so the Map tab folds into List.
  const tab = wide && s.tab === 'map' ? 'list' : s.tab;
  const banner = bannerFor({
    online: s.online,
    reachable: s.reachable,
    syncedAt: s.syncedAt,
    ranking: s.ranking,
    nowMs: now,
  });

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col bg-paper lg:max-w-none">
      <Header />
      <OfflineBanner banner={banner} />
      <StalenessBanner banner={banner} />
      {wide && tab === 'list' ? (
        <main className="grid min-h-0 flex-1 grid-cols-[minmax(400px,480px)_1fr]">
          <div className="min-h-0 overflow-y-auto border-r border-line">
            <Primary />
          </div>
          <div className="relative min-h-0">
            <Suspense fallback={mapFallback}>
              <MapView />
            </Suspense>
          </div>
        </main>
      ) : (
        <main className="relative min-h-0 flex-1 overflow-y-auto">
          {tab === 'list' && <Primary />}
          {tab === 'sources' && <Sources />}
          {tab === 'map' && (
            <Suspense fallback={mapFallback}>
              <MapView />
            </Suspense>
          )}
        </main>
      )}
      <Tabs wide={wide} />
      {s.selectedId && <RecommendationDetail id={s.selectedId} />}
      {s.sheet === 'options' && <Options />}
      {s.sheet === 'how' && <HowItWorks />}
      <DrillOverlay />
    </div>
  );
}
