import { istDate, istTime } from '../format';
import { intlLocale, useT } from '../i18n';
import { useApp } from '../state';
import { GearIcon, Logo } from './Icons';

export function Header() {
  const ranking = useApp((s) => s.ranking);
  const syncing = useApp((s) => s.syncing);
  const connected = useApp((s) => s.online && s.reachable);
  const clock = ranking?.scenario_clock_utc;
  const set = useApp((s) => s.set);
  const { t, locale } = useT();
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 bg-chrome pr-1 pl-4 text-on-chrome">
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
        <span className="text-base text-on-chrome/75">
          {clock ? istDate(clock, intlLocale(locale)) : 'Kodagu'}
        </span>
        <span
          role="img"
          aria-label={connected ? t('app.connected') : t('app.offline')}
          className={`size-2.5 rounded-full ${!connected ? 'bg-on-chrome/40' : syncing ? 'bg-medium' : 'bg-high'}`}
        />
        <button
          type="button"
          onClick={() => set({ sheet: 'options' })}
          className="flex size-12 items-center justify-center rounded-full active:bg-on-chrome/15"
          aria-label={t('app.options')}
        >
          <GearIcon />
        </button>
      </span>
    </header>
  );
}
