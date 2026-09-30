import type { Band } from '@clearsignal/schema';
import { SOURCE_BY_ID } from '@clearsignal/schema';

export const BAND_LABEL: Record<Band, string> = { H: 'HIGH', M: 'MEDIUM', L: 'LOW' };

/** Kodagu is IST (UTC+05:30); the header and banners always show local time there. */
const IST = 'Asia/Kolkata';

export function istTime(iso: string | number): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));
}

export function istDate(iso: string | number, intl = 'en-GB'): string {
  return new Intl.DateTimeFormat(intl, { timeZone: IST, month: 'short', day: 'numeric' }).format(
    new Date(iso),
  );
}

export function localTime(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

/** "28 min", "3 h", "2 d" — compact, rounded up. */
export function shortAge(seconds: number): string {
  const min = Math.max(1, Math.ceil(seconds / 60));
  if (min < 90) return `${min} min`;
  const h = Math.ceil(seconds / 3600);
  if (h < 48) return `${h} h`;
  return `${Math.ceil(seconds / 86400)} d`;
}

export function sourceName(id: string): string {
  return SOURCE_BY_ID[id]?.display_name ?? id;
}

export function sourceShort(id: string): string {
  return SOURCE_BY_ID[id]?.short_label ?? id;
}
