import type { ContributingEvent } from '@clearsignal/schema';
import { type Locale, sourceName, translate } from './index';

/** Per-language version of the server's one-line signal summary (edge pipeline.ts summarize()). */
export function signalSummary(e: ContributingEvent, locale: Locale): string {
  if (locale === 'en') return e.summary;
  const r = e.raw_value;
  const num = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : null);
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) =>
    translate(locale, k, v);
  switch (e.event_type) {
    case 'river_danger':
      return t('sum.river', {
        station: String(r.station ?? 'Gauge'),
        level: num('level_m') ?? '?',
        danger: num('danger_m') ?? '?',
      });
    case 'flood_extent':
      return e.normalized_value !== null && e.normalized_value < 1
        ? t('sum.floodProb', { p: Math.round(e.normalized_value * 100) })
        : t('sum.flood');
    case 'heavy_rain':
      if (num('rain_1h_mm') !== null) return t('sum.rainRate', { mm: num('rain_1h_mm') as number });
      if (num('district_total_mm') !== null)
        return t('sum.rainDay', { mm: num('district_total_mm') as number });
      return t('sum.rainWarning');
    case 'road_impassable': {
      const road = String(r.road ?? t('sum.roadDefault'));
      return r.cause === 'landslide' ? t('sum.roadLandslide', { road }) : t('sum.road', { road });
    }
    case 'power_outage':
      return t('sum.power', { feeder: String(r.feeder ?? '') });
    case 'citizen_report':
      // Citizens' own words are never translated.
      return `“${String(r.body ?? '').slice(0, 140)}”${r.synthetic ? ` ${t('sum.synthetic')}` : ''}`;
    default:
      return sourceName(e.source_id, locale);
  }
}
