import maplibregl from 'maplibre-gl';
import { FileSource, PMTiles, Protocol } from 'pmtiles';

export const BASEMAP_URL = '/kodagu.pmtiles';
const FILE_NAME = 'kodagu.pmtiles';

const protocol = new Protocol();
let registered = false;
let loading: Promise<string | null> | null = null;

/** Register the pmtiles:// protocol once so MapLibre can read the offline basemap. */
export function registerPmtiles() {
  if (registered) return;
  maplibregl.addProtocol('pmtiles', protocol.tile);
  registered = true;
}

/**
 * Loads the Kodagu basemap (~14 MB) in one request and serves tiles from memory.
 *
 * Why not HTTP range requests? Some static hosts (Cloudflare Pages among them)
 * ignore `Range` and return the whole file every time, so a range-reading map
 * would re-download 14 MB per tile. One full download is also what an
 * offline-first app wants: the service worker caches it (CacheFirst), and
 * from then on the map opens instantly with no network.
 *
 * Resolves to the style URL (`pmtiles://kodagu.pmtiles`), or null when the clip
 * isn't deployed. Only downloads once per page load.
 */
export function loadBasemap(onProgress?: (fraction: number) => void): Promise<string | null> {
  loading ??= (async () => {
    try {
      const res = await fetch(BASEMAP_URL);
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || type.includes('text/html') || !res.body) return null;
      const total = Number(res.headers.get('content-length')) || 0;
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) onProgress?.(received / total);
      }
      const file = new File(chunks as BlobPart[], FILE_NAME);
      protocol.add(new PMTiles(new FileSource(file)));
      return `pmtiles://${FILE_NAME}`;
    } catch {
      loading = null; // allow a retry later (e.g. back online)
      return null;
    }
  })();
  return loading;
}
