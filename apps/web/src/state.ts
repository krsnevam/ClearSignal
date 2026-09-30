import type { Band, Ranking } from '@clearsignal/schema';
import { create } from 'zustand';
import { type DrillResult, loadDrill } from './drill';
import { loadPrefs, type Prefs } from './prefs';

export type Tab = 'map' | 'list' | 'sources';
export type Sheet = null | 'options' | 'how';

export interface Update {
  key: string;
  rec_id: string;
  kind: 'up' | 'down' | 'new' | 'conflict' | 'resolved' | 'report';
  /** Language-neutral facts; the feed renders them in the chosen language. */
  place_name: string;
  place_name_kn: string | null;
  band: Band;
  rank: number;
  from: number;
  to: number;
  n: number;
  /** Scenario-clock time the change was seen. */
  at_utc: string;
}

export interface ApiInfo {
  demo_controls: boolean;
  replay: { scenario: string | null; speed: number; paused: boolean } | null;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

interface AppState {
  ranking: Ranking | null;
  /** Local epoch ms when `ranking` was last fetched from the network. */
  syncedAt: number | null;
  online: boolean;
  /** The API answered last time we asked. */
  reachable: boolean;
  syncing: boolean;
  tab: Tab;
  selectedId: string | null;
  query: string;
  bandFilter: Band | null;
  /** Ids whose card changed on the last sync — briefly highlighted. */
  changed: Set<string>;
  /** Newest first. */
  updates: Update[];
  sheet: Sheet;
  prefs: Prefs;
  api: ApiInfo | null;
  installPrompt: BeforeInstallPromptEvent | null;
  drill: { active: boolean; startedAt: number | null; results: DrillResult[] };
  set: (patch: Partial<AppState>) => void;
}

export const useApp = create<AppState>((set) => ({
  ranking: null,
  syncedAt: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  reachable: true,
  syncing: false,
  tab: 'list',
  selectedId: null,
  query: '',
  bandFilter: null,
  changed: new Set(),
  updates: [],
  sheet: null,
  prefs:
    typeof window === 'undefined'
      ? { theme: 'light', text: 'standard', locale: 'en', hintDismissed: false }
      : loadPrefs(),
  api: null,
  installPrompt: null,
  drill: {
    active: false,
    startedAt: null,
    results: typeof window === 'undefined' ? [] : loadDrill(),
  },
  set: (patch) => set(patch),
}));
