import type { Recommendation } from '@clearsignal/schema';
import { sourceShort } from '../format';
import { ConfidenceBadge } from './ConfidenceBadge';
import { ConflictFlag } from './ConflictFlag';
import { SourceAge } from './SourceAge';

export function RecommendationCard({
  rec,
  rank,
  flash,
  onOpen,
}: {
  rec: Recommendation;
  rank: number;
  flash?: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <li className="list-none">
      <h2 className="mb-1 flex items-baseline gap-2 px-1 text-base font-semibold text-ink-2">
        <span className="tabular-nums text-ink">{rank}</span>
        <span className="uppercase tracking-wide text-ink">{rec.place_name}</span>
        <span>· {rec.taluka} taluka</span>
      </h2>
      <button
        type="button"
        onClick={() => onOpen(rec.id)}
        className={`w-full rounded-xl border border-line bg-card p-4 text-left shadow-sm active:bg-paper ${
          flash ? 'cs-flash' : ''
        }`}
        aria-label={`${rec.place_name}: ${rec.reason_text}. Tap for details.`}
      >
        <div className="flex min-h-12 items-center justify-between gap-3">
          <ConfidenceBadge band={rec.band} score={rec.composite_score} />
          <SourceAge seconds={rec.oldest_source_age_sec} stale={rec.stale_flag} />
        </div>
        {rec.conflict_flag && (
          <div className="mt-3">
            <ConflictFlag />
          </div>
        )}
        <p className="mt-3 text-lg leading-snug text-ink">{rec.reason_text}</p>
        {rec.missing_sources.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {rec.missing_sources.map((s) => (
              <span key={s} className="rounded-md bg-paper px-2 py-1 text-base text-ink-2">
                {sourceShort(s)} silent
              </span>
            ))}
          </div>
        )}
      </button>
    </li>
  );
}
