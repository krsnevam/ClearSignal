import { API_BASE } from '../api';
import { shortAge } from '../format';
import { useApp } from '../state';

const MODE_TEXT = { live: 'Live', replay: 'Replay 2018', mock: 'Mock adapter' } as const;

export function Sources() {
  const ranking = useApp((s) => s.ranking);
  if (!ranking) return <p className="px-4 py-8 text-lg text-ink-2">Loading sources…</p>;
  const now = Date.parse(ranking.scenario_clock_utc);
  const sources = [...ranking.sources_status].sort((a, b) => a.tier.localeCompare(b.tier));
  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold">Data sources</h1>
      <p className="mb-3 text-base text-ink-2">
        Trust tier is fixed per source. T1 official sensors · T2 satellite · T3 partner data · T4
        citizen.
      </p>
      <ul className="flex flex-col gap-2">
        {sources.map((s) => {
          const age = s.last_seen_utc ? (now - Date.parse(s.last_seen_utc)) / 1000 : null;
          // In the replay, a source with no 2018 archive data isn't failing — it's absent.
          const absent = age === null && s.mode === 'replay';
          const dot = absent ? 'bg-line' : s.healthy ? 'bg-high' : 'bg-low';
          return (
            <li
              key={s.source_id}
              className="flex items-center gap-3 rounded-xl border border-line bg-card p-3"
            >
              <span
                role="img"
                aria-label={absent ? 'not in replay' : s.healthy ? 'healthy' : 'not reporting'}
                className={`size-4 shrink-0 rounded-full ${dot}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold">{s.display_name}</p>
                <p className="text-base text-ink-2">
                  {s.tier} · {MODE_TEXT[s.mode]} ·{' '}
                  {absent
                    ? 'not in 2018 archive'
                    : age === null
                      ? 'no data yet'
                      : `last ${shortAge(Math.max(0, age))} ago`}
                </p>
                {s.last_error_msg && (
                  <p className="text-base text-low">Error: {s.last_error_msg}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-base text-ink-2">
        Confidence weights are public:{' '}
        <a className="font-semibold text-info underline" href={`${API_BASE}/weights`}>
          weights.yaml
        </a>
      </p>
    </div>
  );
}
