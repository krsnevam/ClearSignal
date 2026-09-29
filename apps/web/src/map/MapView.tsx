import type { Recommendation } from '@clearsignal/schema';
import type { FeatureCollection } from 'geojson';
import maplibregl, { type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef } from 'react';
import { useApp } from '../state';
import { BASEMAP_URL, basemapAvailable, registerPmtiles, warmBasemapCache } from './pmtiles';
import { basemapStyle } from './style';

const KODAGU_BOUNDS: [number, number, number, number] = [75.4, 11.9, 76.2, 12.9];
const BAND_COLOR = { H: '#0EA657', M: '#F0A020', L: '#B02020' };

function toGeoJSON(recs: readonly Recommendation[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: recs.map((r, i) => ({
      type: 'Feature',
      id: i,
      geometry: { type: 'Point', coordinates: [r.centroid.lon, r.centroid.lat] },
      properties: {
        id: r.id,
        name: r.place_name,
        score: r.composite_score,
        color: BAND_COLOR[r.band],
        rank: i + 1,
      },
    })),
  };
}

export default function MapView() {
  const el = useRef<HTMLElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ranking = useApp((s) => s.ranking);
  const set = useApp((s) => s.set);

  useEffect(() => {
    let cancelled = false;
    registerPmtiles();
    void basemapAvailable().then((ok) => {
      if (cancelled || !el.current) return;
      if (ok) void warmBasemapCache();
      const m = new maplibregl.Map({
        container: el.current,
        style: basemapStyle(ok ? BASEMAP_URL : null),
        bounds: KODAGU_BOUNDS,
        fitBoundsOptions: { padding: 24 },
        attributionControl: { compact: true },
      });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      m.on('load', () => {
        m.addSource('villages', {
          type: 'geojson',
          data: toGeoJSON(useApp.getState().ranking?.recommendations ?? []),
        });
        m.addLayer({
          id: 'village-pins',
          type: 'circle',
          source: 'villages',
          layout: { 'circle-sort-key': ['get', 'score'] }, // highest score drawn on top
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['get', 'score'], 0, 9, 100, 20],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#0B0F14',
            'circle-stroke-width': 2,
          },
        });
        m.on('click', 'village-pins', (e) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) set({ selectedId: id });
        });
        m.on('mouseenter', 'village-pins', () => (m.getCanvas().style.cursor = 'pointer'));
        m.on('mouseleave', 'village-pins', () => (m.getCanvas().style.cursor = ''));
      });
      map.current = m;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, [set]);

  useEffect(() => {
    const src = map.current?.getSource('villages') as GeoJSONSource | undefined;
    src?.setData(toGeoJSON(ranking?.recommendations ?? []));
  }, [ranking]);

  const top = ranking?.recommendations.slice(0, 3) ?? [];
  return (
    <div className="absolute inset-0">
      {/* Inline style: maplibre-gl.css (unlayered) sets position: relative and beats Tailwind's layered utilities. */}
      <section
        ref={el}
        style={{ position: 'absolute', inset: 0 }}
        aria-label="Map of ranked villages in Kodagu"
      />
      {/* Labels live in HTML, not map glyphs, so they render with no font server. */}
      <ol className="absolute right-3 bottom-3 left-3 flex flex-col gap-2">
        {top.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => set({ selectedId: r.id })}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-line bg-card/95 px-3 text-left text-base shadow"
            >
              <span
                className="size-4 shrink-0 rounded-full border-2 border-ink"
                style={{ background: BAND_COLOR[r.band] }}
              />
              <b className="tabular-nums">{i + 1}</b>
              <span className="flex-1 truncate font-semibold">{r.place_name}</span>
              <span className="tabular-nums">{r.composite_score}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
