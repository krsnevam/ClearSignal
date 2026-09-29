import maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';

let registered = false;

/** Register the pmtiles:// protocol once so MapLibre can read the offline basemap. */
export function registerPmtiles() {
  if (registered) return;
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  registered = true;
}

export const BASEMAP_URL = '/kodagu.pmtiles';

/** True when the Kodagu PMTiles clip has been deployed alongside the app. */
export async function basemapAvailable(): Promise<boolean> {
  try {
    const res = await fetch(BASEMAP_URL, { method: 'HEAD' });
    return res.ok && !(res.headers.get('content-type') ?? '').includes('text/html');
  } catch {
    return false;
  }
}

/** Pull the whole clip into the SW cache so range reads work offline (§10.4). */
export async function warmBasemapCache() {
  if (!('caches' in window) || !navigator.onLine) return;
  try {
    const cache = await caches.open('basemap');
    if (!(await cache.match(BASEMAP_URL))) await cache.add(BASEMAP_URL);
  } catch {
    // Best effort — the map still works online.
  }
}
