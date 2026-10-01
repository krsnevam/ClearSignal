import { layers, namedFlavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';

/**
 * Basemap style: Protomaps "light" flavour over the Kodagu PMTiles clip.
 * Glyphs and sprites are self-hosted under /basemap so labels render offline.
 * Without the clip we fall back to a plain background (pins still work).
 */
export function basemapStyle(pmtilesUrl: string | null, dark = false): StyleSpecification {
  const origin = typeof location === 'undefined' ? '' : location.origin;
  const common = {
    version: 8 as const,
    glyphs: `${origin}/basemap/fonts/{fontstack}/{range}.pbf`,
    sprite: `${origin}/basemap/sprites/${dark ? 'dark' : 'light'}`,
  };
  if (!pmtilesUrl) {
    return {
      ...common,
      sources: {},
      layers: [
        {
          id: 'bg',
          type: 'background',
          paint: { 'background-color': dark ? '#11161d' : '#eef0ea' },
        },
      ],
    };
  }
  return {
    ...common,
    sources: {
      protomaps: {
        type: 'vector',
        url: pmtilesUrl,
        attribution:
          '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> · Protomaps',
      },
    },
    layers: layers('protomaps', namedFlavor(dark ? 'dark' : 'light'), { lang: 'en' }),
  };
}
