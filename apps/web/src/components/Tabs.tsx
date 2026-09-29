import { type Tab, useApp } from '../state';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'map', label: 'Map', icon: '⌖' },
  { id: 'list', label: 'List', icon: '☰' },
  { id: 'sources', label: 'Sources', icon: '⇅' },
];

export function Tabs() {
  const tab = useApp((s) => s.tab);
  const set = useApp((s) => s.set);
  return (
    <nav className="grid h-14 shrink-0 grid-cols-3 border-t border-line bg-card" aria-label="Views">
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => set({ tab: t.id })}
          aria-current={tab === t.id ? 'page' : undefined}
          className={`flex min-h-12 items-center justify-center gap-2 text-lg font-semibold ${
            tab === t.id
              ? 'border-t-4 border-ink text-ink'
              : 'border-t-4 border-transparent text-ink-2'
          }`}
        >
          <span aria-hidden="true">{t.icon}</span>
          {t.label}
        </button>
      ))}
    </nav>
  );
}
