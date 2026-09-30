import type { Locale } from './types';

/** Starting language from the browser: kn-* or hi-* → that language, else English. */
export function detectLocale(): Locale {
  const langs =
    typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const l of langs) {
    const code = l.toLowerCase().slice(0, 2);
    if (code === 'kn' || code === 'hi') return code;
  }
  return 'en';
}
