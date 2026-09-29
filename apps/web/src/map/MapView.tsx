import type { Recommendation } from '@clearsignal/schema';
import type { Feature, FeatureCollection, Point } from 'geojson';
import maplibregl, { type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useRef, useState } from 'react';
import { BAND_FILL, ConfidenceBadge } from '../components/ConfidenceBadge';
import { ChevronRight } from '../components/Icons';
import { SourceAge } from '../components/SourceAge';
import { useApp } from '../state';
import { BASEMAP_URL, basemapAvailable, registerPmtiles, warmBasemapCache } from './pmtiles';
import { basemapStyle } from './style';

const BAND_COLOR = { H: '#0EA657', M: '#F0A020', L: '#B02020' };
const KODAGU: LngLatBoundsLike = [
  [75.4, 11.9],
  [76.2, 12.9],
];

function toGeoJSON(recs: readonly Recommendation[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: recs.map(
      (r, i): Feature<Point> => ({
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
      }),
    ),
  };
}

function boundsOf(recs: readonly Recommendation[]): LngLatBoundsLike {
  if (recs.length === 0) return KODAGU;
  const lons = recs.map((r) => r.centroid.lon);
  const lats = recs.map((r) => r.centroid.lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
}

export default function MapView() {
  const el = useRef<HTMLElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const ranking = useApp((s) => s.ranking);
  const set = useApp((s) => s.set);
  const recs = ranking?.recommendations ?? [];
  const [picked, setPicked] = useState<string | null>(null);
  const selected = recs.find((r) => r.id === picked) ?? recs[0] ?? null;
  const rank = selected ? recs.indexOf(selected) + 1 : 0;

  useEffect(() => {
    let cancelled = false;
    registerPmtiles();
    void basemapAvailable().then((ok) => {
      if (cancelled || !el.current) return;
      if (ok) void warmBasemapCache();
      const initial = useApp.getState().ranking?.recommendations ?? [];
      const m = new maplibregl.Map({
        container: el.current,
        style: basemapStyle(ok ? BASEMAP_URL : null),
        bounds: boundsOf(initial),
        fitBoundsOptions: { padding: { top: 64, left: 28, right: 110, bottom: 230 }, maxZoom: 11 },
        maxBounds: [
          [74.9, 11.5],
          [76.7, 13.3],
        ],
        minZoom: 8,
        maxZoom: 15,
        attributionControl: false,
        dragRotate: false,
        pitchWithRotate: false,
      });
      m.touchZoomRotate.disableRotation();
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      // Credit sits top-right, under the zoom buttons, so the preview card never covers it.
      m.addControl(new maplibregl.AttributionControl({ compact: true }), 'top-right');
      m.on('load', () => {
        m.addSource('villages', { type: 'geojson', data: toGeoJSON(initial) });
        m.addLayer({
          id: 'village-selected',
          type: 'circle',
          source: 'villages',
          filter: ['==', ['get', 'id'], ''],
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 15, 13, 22],
            'circle-color': '#0f1720',
            'circle-opacity': 0.18,
          },
        });
        m.addLayer({
          id: 'village-pins',
          type: 'circle',
          source: 'villages',
          layout: { 'circle-sort-key': ['get', 'score'] }, // highest score drawn on top
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 7, 13, 12],
            'circle-color': ['get', 'color'],
            'circle-stroke-color': '#ffffff',
            'circle-stroke-width': 2.5,
          },
        });
        m.addLayer({
          id: 'village-labels',
          type: 'symbol',
          source: 'villages',
          layout: {
            'symbol-sort-key': ['-', 100, ['get', 'score']], // best-ranked labels win collisions
            'text-field': ['get', 'name'],
            'text-font': ['Noto Sans Medium'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 8, 13, 13, 16],
            'text-anchor': 'left',
            'text-offset': [0.9, 0],
            'text-optional': true,
          },
          paint: { 'text-color': '#0f1720', 'text-halo-color': '#ffffff', 'text-halo-width': 1.6 },
        });
        const pick = (e: maplibregl.MapLayerMouseEvent) => {
          const id = e.features?.[0]?.properties?.id as string | undefined;
          if (id) setPicked(id);
        };
        for (const layer of ['village-pins', 'village-labels']) {
          m.on('click', layer, pick);
          m.on('mouseenter', layer, () => (m.getCanvas().style.cursor = 'pointer'));
          m.on('mouseleave', layer, () => (m.getCanvas().style.cursor = ''));
        }
      });
      map.current = m;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const src = map.current?.getSource('villages') as GeoJSONSource | undefined;
    src?.setData(toGeoJSON(ranking?.recommendations ?? []));
  }, [ranking]);

  useEffect(() => {
    const m = map.current;
    if (!m || !selected) return;
    if (m.getLayer('village-selected'))
      m.setFilter('village-selected', ['==', ['get', 'id'], selected.id]);
    if (picked) {
      m.easeTo({
        center: [selected.centroid.lon, selected.centroid.lat],
        padding: { top: 0, left: 0, right: 0, bottom: 200 },
        duration: 400,
      });
    }
  }, [selected, picked]);

  return (
    <div className="absolute inset-0">
      {/* Inline style: maplibre-gl.css (unlayered) sets position: relative and beats Tailwind's layered utilities. */}
      <section
        ref={el}
        style={{ position: 'absolute', inset: 0 }}
        aria-label="Map of ranked villages in Kodagu"
      />

      <div className="pointer-events-none absolute top-3 left-3 flex gap-1.5 rounded-full bg-card/95 px-3 py-1.5 text-base shadow-[0_1px_3px_rgb(15_23_32/0.15)]">
        {(['H', 'M', 'L'] as const).map((b) => (
          <span key={b} className="flex items-center gap-1 pr-1 text-ink-2">
            <span className={`size-2.5 rounded-full ${BAND_FILL[b]}`} />
            {b === 'H' ? 'High' : b === 'M' ? 'Med' : 'Low'}
          </span>
        ))}
      </div>

      {selected && (
        <div className="absolute right-3 bottom-3 left-3">
          <button
            type="button"
            onClick={() => set({ selectedId: selected.id })}
            className="relative w-full overflow-hidden rounded-2xl bg-card py-3.5 pr-4 pl-5 text-left shadow-[0_4px_16px_rgb(15_23_32/0.18)] active:scale-[0.99]"
            aria-label={`${selected.place_name}: ${selected.reason_text}. Tap for details.`}
          >
            <span
              aria-hidden="true"
              className={`absolute inset-y-0 left-0 w-1.5 ${BAND_FILL[selected.band]}`}
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-medium text-ink-3">
                  <span className="tabular">#{rank}</span> · {selected.taluka} taluka
                </p>
                <h2 className="truncate text-xl leading-tight font-bold tracking-tight">
                  {selected.place_name}
                </h2>
              </div>
              <ConfidenceBadge band={selected.band} score={selected.composite_score} />
            </div>
            <p className="mt-2 line-clamp-2 text-base leading-snug text-ink">
              {selected.reason_text}
            </p>
            <div className="mt-2 flex items-center justify-between">
              <SourceAge seconds={selected.oldest_source_age_sec} stale={selected.stale_flag} />
              <span className="flex items-center gap-0.5 text-base font-semibold text-info">
                Details <ChevronRight className="size-5" />
              </span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
