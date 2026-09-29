import type { ReactNode } from 'react';
import { type Tab, useApp } from '../state';
import { ListIcon, MapIcon, SourcesIcon } from './Icons';

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: 'map', label: 'Map', icon: <MapIcon /> },
  { id: 'list', label: 'List', icon: <ListIcon /> },
  { id: 'sources', label: 'Sources', icon: <SourcesIcon /> },
];

export function Tabs() {
  const tab = useApp((s) => s.tab);
  const set = useApp((s) => s.set);
  return (
    <nav
      className="grid shrink-0 grid-cols-3 border-t border-line bg-card px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
      aria-label="Views"
    >
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => set({ tab: t.id })}
            aria-current={active ? 'page' : undefined}
            className="group flex min-h-14 flex-col items-center justify-center gap-0.5"
          >
            <span
              className={`flex h-8 w-16 items-center justify-center rounded-full transition ${
                active ? 'bg-ink text-white' : 'text-ink-2'
              }`}
            >
              {t.icon}
            </span>
            <span className={`text-base ${active ? 'font-semibold text-ink' : 'text-ink-2'}`}>
              {t.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
