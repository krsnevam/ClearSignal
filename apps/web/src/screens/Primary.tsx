import type { Band } from '@clearsignal/schema';
import { BAND_FILL } from '../components/ConfidenceBadge';
import { SearchIcon } from '../components/Icons';
import { RankedList } from '../components/RankedList';
import { istTime } from '../format';
import { useApp } from '../state';

export const DEFAULT_QUESTION = 'Which villages need evacuation support first?';

const BANDS: { band: Band; label: string }[] = [
  { band: 'H', label: 'High' },
  { band: 'M', label: 'Medium' },
  { band: 'L', label: 'Low' },
];

export function Primary() {
  const ranking = useApp((s) => s.ranking);
  const changed = useApp((s) => s.changed);
  const query = useApp((s) => s.query);
  const bandFilter = useApp((s) => s.bandFilter);
  const set = useApp((s) => s.set);

  const all = ranking?.recommendations ?? [];
  const q = query.trim().toLowerCase();
  const recs = all.filter(
    (r) =>
      (!bandFilter || r.band === bandFilter) &&
      (!q || r.place_name.toLowerCase().includes(q) || r.taluka.toLowerCase().includes(q)),
  );
  const counts = { H: 0, M: 0, L: 0 };
  for (const r of all) counts[r.band]++;

  return (
    <div className="flex flex-col">
      <section className="px-4 pt-5 pb-4">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-balance">
          {DEFAULT_QUESTION}
        </h1>
        <p className="mt-1 text-base text-ink-2">
          {ranking
            ? `${all.length} villages ranked by confidence · as of ${istTime(ranking.scenario_clock_utc)} IST`
            : 'Loading…'}
          {ranking?.scenario && ' · 2018 flood replay'}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Filter by confidence">
          {BANDS.map(({ band, label }) => {
            const active = bandFilter === band;
            return (
              <button
                key={band}
                type="button"
                aria-pressed={active}
                onClick={() => set({ bandFilter: active ? null : band })}
                className={`flex min-h-14 flex-col items-start justify-center rounded-xl px-3 text-left transition ${
                  active
                    ? 'bg-ink text-white'
                    : 'bg-card text-ink shadow-[0_0_0_1px_rgb(15_23_32/0.08)]'
                }`}
              >
                <span className="tabular text-2xl leading-none font-bold">{counts[band]}</span>
                <span
                  className={`mt-1 flex items-center gap-1.5 text-base ${active ? 'text-white/85' : 'text-ink-2'}`}
                >
                  <span aria-hidden="true" className={`size-2.5 rounded-full ${BAND_FILL[band]}`} />
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        <label className="mt-3 flex h-12 items-center gap-2 rounded-xl bg-card px-3 shadow-[0_0_0_1px_rgb(15_23_32/0.08)] focus-within:shadow-[0_0_0_2px_var(--color-info)]">
          <SearchIcon className="size-5 shrink-0 text-ink-3" />
          <span className="sr-only">Filter by village or taluka</span>
          <input
            type="search"
            value={query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="Filter by village or taluka"
            className="h-full min-w-0 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-3"
          />
        </label>
      </section>

      {!ranking ? (
        <p className="px-4 py-8 text-center text-lg text-ink-2">Loading ranked villages…</p>
      ) : (
        <RankedList recs={recs} changed={changed} onOpen={(id) => set({ selectedId: id })} />
      )}
    </div>
  );
}
