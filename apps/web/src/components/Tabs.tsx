import type { ReactNode } from 'react';
import { type MessageKey, useT } from '../i18n';
import { type Tab, useApp } from '../state';
import { ListIcon, MapIcon, SourcesIcon } from './Icons';

const TABS: { id: Tab; label: MessageKey; icon: ReactNode }[] = [
  { id: 'map', label: 'tab.map', icon: <MapIcon /> },
  { id: 'list', label: 'tab.list', icon: <ListIcon /> },
  { id: 'sources', label: 'tab.sources', icon: <SourcesIcon /> },
];

export function Tabs({ wide = false }: { wide?: boolean }) {
  const tab = useApp((s) => s.tab);
  const set = useApp((s) => s.set);
  const { t: tr } = useT();
  return (
    <nav
      className={`grid shrink-0 ${wide ? 'grid-cols-2 lg:w-[480px] lg:border-r' : 'grid-cols-3'} border-t border-line bg-card px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]`}
      aria-label={tr('app.views')}
    >
      {TABS.filter((t) => !(wide && t.id === 'map')).map((t) => {
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
                active ? 'bg-ink text-paper' : 'text-ink-2'
              }`}
            >
              {t.icon}
            </span>
            <span className={`text-base ${active ? 'font-semibold text-ink' : 'text-ink-2'}`}>
              {tr(t.label)}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
