import type { Band } from '@clearsignal/schema';
import { BAND_FILL } from '../components/ConfidenceBadge';
import { SearchIcon } from '../components/Icons';
import { RankedList } from '../components/RankedList';
import { UpdatesFeed } from '../components/UpdatesFeed';
import { istTime } from '../format';
import { placeName, talukaName, useT } from '../i18n';
import { savePrefs } from '../prefs';
import { useApp } from '../state';

const BANDS: Band[] = ['H', 'M', 'L'];

export function Primary() {
  const ranking = useApp((s) => s.ranking);
  const changed = useApp((s) => s.changed);
  const query = useApp((s) => s.query);
  const bandFilter = useApp((s) => s.bandFilter);
  const set = useApp((s) => s.set);
  const prefs = useApp((s) => s.prefs);
  const { t, locale } = useT();

  const dismissHint = () => {
    const next = { ...prefs, hintDismissed: true };
    savePrefs(next);
    set({ prefs: next });
  };

  const all = ranking?.recommendations ?? [];
  const q = query.trim().toLowerCase();
  // Search matches English and Kannada names, whatever the UI language.
  const matches = (r: (typeof all)[number]) =>
    [r.place_name, r.taluka, placeName(r, 'kn'), talukaName(r.taluka, 'kn')].some((s) =>
      s.toLowerCase().includes(q),
    );
  const recs = all.filter((r) => (!bandFilter || r.band === bandFilter) && (!q || matches(r)));
  const counts = { H: 0, M: 0, L: 0 };
  for (const r of all) counts[r.band]++;

  return (
    <div className="flex flex-col">
      <section className="px-4 pt-5 pb-4">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-balance">
          {t('primary.question')}
        </h1>
        <p className="mt-1 text-base text-ink-2">
          {ranking
            ? t('primary.subtitle', { n: all.length, time: istTime(ranking.scenario_clock_utc) })
            : t('common.loading')}
          {ranking?.scenario && t('primary.replay')}
        </p>

        {!prefs.hintDismissed && (
          <div className="mt-3 flex items-center gap-1 rounded-2xl bg-info-bg py-1 pr-1 pl-3">
            <p className="flex-1 text-base">
              <b>{t('primary.hint')}</b>{' '}
              <button
                type="button"
                onClick={() => set({ sheet: 'how' })}
                className="min-h-12 font-semibold text-info underline"
              >
                {t('primary.hintLink')}
              </button>
            </p>
            <button
              type="button"
              onClick={dismissHint}
              aria-label={t('primary.hintDismiss')}
              className="flex size-12 shrink-0 items-center justify-center rounded-full text-xl text-ink-2"
            >
              ×
            </button>
          </div>
        )}

        <div
          className="mt-4 grid grid-cols-3 gap-2"
          role="group"
          aria-label={t('primary.filterGroup')}
        >
          {BANDS.map((band) => {
            const active = bandFilter === band;
            return (
              <button
                key={band}
                type="button"
                aria-pressed={active}
                onClick={() => set({ bandFilter: active ? null : band })}
                className={`flex min-h-14 flex-col items-start justify-center rounded-xl px-3 text-left transition ${
                  active
                    ? 'bg-ink text-paper'
                    : 'cs-card bg-card text-ink shadow-[0_0_0_1px_rgb(15_23_32/0.08)]'
                }`}
              >
                <span className="tabular text-2xl leading-none font-bold">{counts[band]}</span>
                <span
                  className={`mt-1 flex items-center gap-1.5 text-base ${active ? 'text-paper/85' : 'text-ink-2'}`}
                >
                  <span aria-hidden="true" className={`size-2.5 rounded-full ${BAND_FILL[band]}`} />
                  {t(`band.${band}`)}
                </span>
              </button>
            );
          })}
        </div>

        <UpdatesFeed />

        <label className="cs-card mt-3 flex h-12 items-center gap-2 rounded-xl bg-card px-3 shadow-[0_0_0_1px_rgb(15_23_32/0.08)] focus-within:shadow-[0_0_0_2px_var(--color-info)]">
          <SearchIcon className="size-5 shrink-0 text-ink-3" />
          <span className="sr-only">{t('primary.filterPlaceholder')}</span>
          <input
            type="search"
            value={query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder={t('primary.filterPlaceholder')}
            className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
          />
        </label>
      </section>

      {!ranking ? (
        <p className="px-4 py-8 text-center text-lg text-ink-2">{t('primary.loading')}</p>
      ) : (
        <RankedList recs={recs} changed={changed} onOpen={(id) => set({ selectedId: id })} />
      )}
    </div>
  );
}
