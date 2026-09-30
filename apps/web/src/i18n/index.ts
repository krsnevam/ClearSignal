import type { Recommendation } from '@clearsignal/schema';
import { useMemo } from 'react';
import { useApp } from '../state';
import { en, type MessageKey } from './en';
import type { Dictionary, Locale, Message } from './types';

export { detectLocale } from './detect';
export type { Locale, MessageKey };

/** Add a language: write a Dictionary file and list it here. */
export const LOCALES: { code: Locale; label: string; intl: string }[] = [
  { code: 'en', label: 'English', intl: 'en-GB' },
  { code: 'kn', label: 'ಕನ್ನಡ', intl: 'kn-IN' },
  { code: 'hi', label: 'हिन्दी', intl: 'hi-IN' },
];

// English ships in the main bundle; other languages load on demand (and are precached for offline).
const DICTS: Partial<Record<Locale, Dictionary>> = { en };
const LOADERS: Record<Exclude<Locale, 'en'>, () => Promise<Dictionary>> = {
  kn: () => import('./kn').then((m) => m.kn),
  hi: () => import('./hi').then((m) => m.hi),
};

/** Make sure a language's dictionary is loaded before switching to it. */
export async function loadLocale(locale: Locale): Promise<void> {
  if (locale === 'en' || DICTS[locale]) return;
  DICTS[locale] = await LOADERS[locale]();
}

export function intlLocale(locale: Locale): string {
  return LOCALES.find((l) => l.code === locale)?.intl ?? 'en-GB';
}

export type Vars = Record<string, string | number>;
export type T = (key: MessageKey, vars?: Vars) => string;

const pluralRules = new Map<Locale, Intl.PluralRules>();

function resolve(msg: Message, locale: Locale, n: number | undefined): string {
  if (typeof msg === 'string') return msg;
  if (n === undefined) return msg.other;
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(intlLocale(locale));
    pluralRules.set(locale, rules);
  }
  return rules.select(n) === 'one' ? msg.one : msg.other;
}

export function translate(locale: Locale, key: MessageKey, vars: Vars = {}): string {
  const msg = DICTS[locale]?.[key] ?? en[key];
  const n = typeof vars.n === 'number' ? vars.n : undefined;
  return resolve(msg, locale, n).replace(/\{(\w+)\}/g, (_, k: string) =>
    vars[k] === undefined ? `{${k}}` : String(vars[k]),
  );
}

export function tFor(locale: Locale): T {
  return (key, vars) => translate(locale, key, vars);
}

/** Current language + a bound t(). Re-renders when the language changes. */
export function useT(): { t: T; locale: Locale } {
  const locale = useApp((s) => s.prefs.locale);
  return useMemo(() => ({ t: tFor(locale), locale }), [locale]);
}

export function joinList(items: string[], locale: Locale): string {
  return new Intl.ListFormat(intlLocale(locale), { style: 'long', type: 'conjunction' }).format(
    items,
  );
}

const TALUKA_KN: Record<string, string> = {
  Madikeri: 'ಮಡಿಕೇರಿ',
  Somwarpet: 'ಸೋಮವಾರಪೇಟೆ',
  Virajpet: 'ವಿರಾಜಪೇಟೆ',
};

/** Kannada UI shows Kannada-script names; Hindi keeps the Latin names teams use on maps. */
export function placeName(
  rec: Pick<Recommendation, 'place_name' | 'place_name_kn'>,
  locale: Locale,
): string {
  return locale === 'kn' ? (rec.place_name_kn ?? rec.place_name) : rec.place_name;
}

export function talukaName(taluka: string, locale: Locale): string {
  return locale === 'kn' ? (TALUKA_KN[taluka] ?? taluka) : taluka;
}

/** "28 minutes" — rounded up so the claim is never optimistic (mirrors fusion humanAge). */
export function longAge(seconds: number, locale: Locale): string {
  const min = Math.max(1, Math.ceil(seconds / 60));
  if (min < 90) return translate(locale, 'age.min', { n: min });
  const h = Math.ceil(seconds / 3600);
  if (h < 48) return translate(locale, 'age.hour', { n: h });
  return translate(locale, 'age.day', { n: Math.ceil(seconds / 86400) });
}

/** "28 min" / "3 h" — compact, rounded up. */
export function shortAge(seconds: number, locale: Locale): string {
  const min = Math.max(1, Math.ceil(seconds / 60));
  if (min < 90) return translate(locale, 'age.short.min', { n: min });
  const h = Math.ceil(seconds / 3600);
  if (h < 48) return translate(locale, 'age.short.hour', { n: h });
  return translate(locale, 'age.short.day', { n: Math.ceil(seconds / 86400) });
}

export function sourceName(id: string, locale: Locale): string {
  const key = `source.${id}` as MessageKey;
  return key in en ? translate(locale, key) : id;
}

export function sourceShort(id: string, locale: Locale): string {
  const key = `sourceShort.${id}` as MessageKey;
  return key in en ? translate(locale, key) : sourceName(id, locale);
}
