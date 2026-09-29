import { istDate, istTime } from '../format';
import { useApp } from '../state';
import { Logo } from './Icons';

export function Header() {
  const ranking = useApp((s) => s.ranking);
  const syncing = useApp((s) => s.syncing);
  const connected = useApp((s) => s.online && s.reachable);
  const clock = ranking?.scenario_clock_utc;
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 bg-ink px-4 text-white">
      <span className="flex items-center gap-2.5">
        <Logo className="size-7" />
        <span className="text-lg font-bold tracking-tight">ClearSignal</span>
      </span>
      <span className="flex items-center gap-2.5 whitespace-nowrap">
        <span className="text-right leading-tight">
          <span className="block text-base font-semibold tabular">
            {clock ? istTime(clock) : '--:--'}
          </span>
        </span>
        <span className="text-base text-white/75">
          {clock ? `Kodagu · ${istDate(clock)}` : 'Kodagu'}
        </span>
        <span
          role="img"
          aria-label={connected ? 'Connected' : 'Offline'}
          className={`size-2.5 rounded-full ${!connected ? 'bg-white/40' : syncing ? 'bg-medium' : 'bg-high'}`}
        />
      </span>
    </header>
  );
}
