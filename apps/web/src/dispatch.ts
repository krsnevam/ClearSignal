import type { Recommendation } from '@clearsignal/schema';
import { istDate, istTime } from './format';
import { intlLocale, type Locale, placeName, shortAge, talukaName, translate } from './i18n';
import { reasonText } from './i18n/reason';

/**
 * Plain-text dispatch message for a rescue team, in the officer's language.
 * Short enough for one or two SMS segments, readable on a feature phone, and
 * no app needed at the other end. Coordinates and the maps link are universal.
 */
export function dispatchMessage(
  rec: Recommendation,
  rank: number | null,
  clockIso: string,
  locale: Locale = 'en',
): string {
  const t = (k: Parameters<typeof translate>[1], v?: Record<string, string | number>) =>
    translate(locale, k, v);
  const { lat, lon } = rec.centroid;
  const lines = [
    t('dispatch.head', { date: istDate(clockIso, intlLocale(locale)), time: istTime(clockIso) }),
    `${rank ? t('dispatch.priority', { rank }) : ''}${t('dispatch.place', {
      place: placeName(rec, locale),
      taluka: talukaName(rec.taluka, locale),
    })}`,
    t('dispatch.confidence', {
      band: t(`band.${rec.band}`).toUpperCase(),
      score: rec.composite_score,
      age: shortAge(rec.oldest_source_age_sec, locale),
    }),
    t('dispatch.why', { reason: reasonText(rec, locale) }),
  ];
  if (rec.conflict_flag) lines.push(t('dispatch.caution'));
  lines.push(
    t('dispatch.location', {
      lat: lat.toFixed(4),
      lon: lon.toFixed(4),
      url: `https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`,
    }),
  );
  return lines.join('\n');
}

/** sms: URI that opens the phone's own SMS app — works with no data connection. */
export function smsHref(text: string): string {
  const sep = /iphone|ipad|mac/i.test(typeof navigator === 'undefined' ? '' : navigator.userAgent)
    ? '&'
    : '?';
  return `sms:${sep}body=${encodeURIComponent(text)}`;
}
