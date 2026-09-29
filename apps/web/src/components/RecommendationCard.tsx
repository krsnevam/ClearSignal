import type { Recommendation } from '@clearsignal/schema';
import { sourceShort } from '../format';
import { BAND_FILL, ConfidenceBadge } from './ConfidenceBadge';
import { ConflictFlag } from './ConflictFlag';
import { ChevronRight, LayersIcon } from './Icons';
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
  const signals = rec.contributing_event_ids.length;
  return (
    <li className="list-none">
      <button
        type="button"
        onClick={() => onOpen(rec.id)}
        className={`relative w-full overflow-hidden rounded-2xl bg-card text-left shadow-[0_1px_2px_rgb(15_23_32/0.06),0_0_0_1px_rgb(15_23_32/0.05)] transition active:scale-[0.99] ${
          flash ? 'cs-flash' : ''
        }`}
        aria-label={`${rec.place_name}: ${rec.reason_text}. Tap for details.`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-0 left-0 w-1.5 ${BAND_FILL[rec.band]}`}
        />
        <div className="py-4 pr-4 pl-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-medium text-ink-3">
                <span className="tabular">#{rank}</span> · {rec.taluka} taluka
              </p>
              <h2 className="truncate text-[22px] leading-tight font-bold tracking-tight">
                {rec.place_name}
              </h2>
            </div>
            <ConfidenceBadge band={rec.band} score={rec.composite_score} />
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
                <span key={s} className="rounded-md bg-paper px-2 py-0.5 text-base text-ink-2">
                  {sourceShort(s)} silent
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-base text-ink-2">
                <LayersIcon className="size-[18px]" />
                <span className="tabular">
                  {signals} signal{signals === 1 ? '' : 's'}
                </span>
              </span>
              <SourceAge seconds={rec.oldest_source_age_sec} stale={rec.stale_flag} />
            </div>
            <ChevronRight className="size-5 text-ink-3" />
          </div>
        </div>
      </button>
    </li>
  );
}
