import type { StyleSpecification } from 'maplibre-gl';

/**
 * Basemap style. With the PMTiles clip present we draw a minimal Protomaps
 * vector style (water, roads, places); without it, a plain background so
 * village pins still render fully offline.
 */
export function basemapStyle(pmtilesUrl: string | null): StyleSpecification {
  const base: StyleSpecification = {
    version: 8,
    sources: {},
    layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#eef1ec' } }],
  };
  if (!pmtilesUrl) return base;
  return {
    ...base,
    sources: {
      protomaps: {
        type: 'vector',
        url: `pmtiles://${pmtilesUrl}`,
        attribution: '© OpenStreetMap contributors · Protomaps',
      },
    },
    layers: [
      ...base.layers,
      {
        id: 'earth',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'earth',
        paint: { 'fill-color': '#eef1ec' },
      },
      {
        id: 'landuse',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'landuse',
        paint: { 'fill-color': '#dfe8d8' },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'protomaps',
        'source-layer': 'water',
        paint: { 'fill-color': '#a9c8e8' },
      },
      {
        id: 'roads',
        type: 'line',
        source: 'protomaps',
        'source-layer': 'roads',
        paint: {
          'line-color': '#ffffff',
          'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 3],
        },
      },
    ],
  };
}
