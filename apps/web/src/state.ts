import type { Band, Ranking } from '@clearsignal/schema';
import { create } from 'zustand';

export type Tab = 'map' | 'list' | 'sources';

interface AppState {
  ranking: Ranking | null;
  /** Local epoch ms when `ranking` was last fetched from the network. */
  syncedAt: number | null;
  /** navigator.onLine AND the API answered last time we asked. */
  online: boolean;
  reachable: boolean;
  syncing: boolean;
  tab: Tab;
  selectedId: string | null;
  query: string;
  bandFilter: Band | null;
  /** Ids whose card changed on the last sync — briefly highlighted. */
  changed: Set<string>;
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
  set: (patch) => set(patch),
}));
