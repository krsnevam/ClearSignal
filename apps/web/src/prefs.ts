import { detectLocale } from './i18n/detect';
import type { Locale } from './i18n/types';

/**
 * Per-phone display preferences. localStorage is a convenience only: every
 * read/write is guarded and the app renders correctly without it.
 */
export type Theme = 'light' | 'dark' | 'sun';
export type TextSize = 'standard' | 'large';

export interface Prefs {
  theme: Theme;
  text: TextSize;
  locale: Locale;
  hintDismissed: boolean;
}

const KEY = 'clearsignal:prefs';
const DEFAULTS: Omit<Prefs, 'locale'> = { theme: 'light', text: 'standard', hintDismissed: false };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, locale: detectLocale(), ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    // private mode / blocked storage
  }
  const prefersDark =
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
  return { ...DEFAULTS, locale: detectLocale(), theme: prefersDark ? 'dark' : 'light' };
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // ignore
  }
}

export function applyPrefs(p: Prefs) {
  const el = document.documentElement;
  el.dataset.theme = p.theme;
  el.dataset.text = p.text;
  el.lang = p.locale;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute(
    'content',
    p.theme === 'sun' ? '#000000' : p.theme === 'dark' ? '#05080c' : '#0f1720',
  );
}
