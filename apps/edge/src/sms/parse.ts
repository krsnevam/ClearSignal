import { nearestVillage, type Village } from '@clearsignal/fusion';

/**
 * Citizen SMS → location + polarity. Feature phones can't send GPS, so we look
 * for (1) explicit coordinates, (2) a village name, (3) a registered volunteer
 * number, in that order.
 */

const COORDS = /(-?\d{1,2}\.\d{2,})\s*[, ]\s*(-?\d{1,3}\.\d{2,})/;

export interface Located {
  lat: number;
  lon: number;
  village: Village | null;
  method: 'coordinates' | 'village_name' | 'registered_number';
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9 ]/g, ' ');
}

export function locate(
  body: string,
  villages: readonly Village[],
  registry: Readonly<Record<string, string>> = {},
  fromHash?: string,
): Located | null {
  const m = body.match(COORDS);
  if (m) {
    const lat = Number(m[1]);
    const lon = Number(m[2]);
    // Must fall inside (a generous box around) Kodagu.
    if (lat > 11.8 && lat < 13.0 && lon > 75.3 && lon < 76.3) {
      return { lat, lon, village: nearestVillage(lat, lon, villages), method: 'coordinates' };
    }
  }
  const text = ` ${norm(body)} `;
  // Longest name first so "Madikeri" doesn't shadow a longer match.
  const byLength = [...villages].sort((a, b) => b.place_name.length - a.place_name.length);
  for (const v of byLength) {
    if (text.includes(` ${norm(v.place_name).trim()} `)) {
      return { lat: v.lat, lon: v.lon, village: v, method: 'village_name' };
    }
  }
  if (fromHash) {
    const vid = registry[fromHash];
    const v = villages.find((x) => x.village_id === vid);
    if (v) return { lat: v.lat, lon: v.lon, village: v, method: 'registered_number' };
  }
  return null;
}

const SAFE =
  /\b(safe|receded|water (?:has )?gone( down)?|gone down|all clear|no flood(?:ing)?|road open|we are ok|we are fine)\b/;
const NEGATED_SAFE = /\b(not|un|no longer)\s*safe\b/;

/** +1 hazard, −1 all-clear. Ambiguous messages default to hazard. */
export function polarity(body: string): 1 | -1 {
  const t = body.toLowerCase();
  if (NEGATED_SAFE.test(t)) return 1;
  return SAFE.test(t) ? -1 : 1;
}

const PHONE = /\+?\d[\d\s-]{8,}\d/g;

/** Remove anything that looks like a phone number from the message body. */
export function stripPii(body: string): string {
  return body.replace(PHONE, '[number removed]').slice(0, 320);
}

export async function hashSender(from: string, salt: string): Promise<string> {
  const digits = from.replace(/[^\d+]/g, '');
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${digits}`));
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex.slice(0, 16)}`;
}
