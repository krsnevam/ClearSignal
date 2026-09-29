import { istDate, istTime } from '../format';
import { useApp } from '../state';

export function Header() {
  const ranking = useApp((s) => s.ranking);
  const syncing = useApp((s) => s.syncing);
  const connected = useApp((s) => s.online && s.reachable);
  const clock = ranking?.scenario_clock_utc;
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 bg-ink px-4 text-white">
      <span className="text-lg font-bold tracking-tight">ClearSignal</span>
      <span className="flex items-center gap-2 whitespace-nowrap text-base tabular-nums">
        {ranking?.scenario && (
          <span
            className="rounded bg-white/15 px-1 text-sm font-semibold"
            title="Kodagu August 2018 replay"
          >
            2018
          </span>
        )}
        <span>Kodagu{clock ? ` · ${istDate(clock)} · ${istTime(clock)}` : ''}</span>
        <span
          role="img"
          aria-label={connected ? 'Connected' : 'Offline'}
          className={`size-2.5 rounded-full ${!connected ? 'bg-white/40' : syncing ? 'bg-medium' : 'bg-high'}`}
        />
      </span>
    </header>
  );
}
