import type {
  ContributingEvent,
  RecommendationDetail as Detail,
  SourceTier,
} from '@clearsignal/schema';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { BAND_FILL, ConfidenceBadge } from '../components/ConfidenceBadge';
import { ConflictFlag } from '../components/ConflictFlag';
import { BackIcon, PinIcon } from '../components/Icons';
import { SourceAge } from '../components/SourceAge';
import { shortAge, sourceName } from '../format';
import { useApp } from '../state';
import { db } from '../storage/dexie';

const TIER: Record<SourceTier, { label: string; cls: string }> = {
  T1: { label: 'Official sensor', cls: 'bg-ink text-white' },
  T2: { label: 'Satellite', cls: 'bg-[#dbe7ff] text-[#1e3a8a]' },
  T3: { label: 'Partner data', cls: 'bg-paper text-ink' },
  T4: { label: 'Citizen', cls: 'bg-medium-soft text-medium-ink' },
};

const PARTS = [
  {
    key: 'recency',
    label: 'Fresh',
    gloss: 'How recent is the newest signal',
    color: 'bg-part-fresh',
    w: 'recency_weight',
  },
  {
    key: 'agreement',
    label: 'Agreement',
    gloss: 'Independent sources saying the same',
    color: 'bg-part-agree',
    w: 'agreement_weight',
  },
  {
    key: 'reliability',
    label: 'Trust',
    gloss: 'Sensors › satellite › partners › SMS',
    color: 'bg-part-trust',
    w: 'reliability_weight',
  },
] as const;

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section
      className={`rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgb(15_23_32/0.06),0_0_0_1px_rgb(15_23_32/0.05)] ${className}`}
    >
      {children}
    </section>
  );
}

function Signal({ e }: { e: ContributingEvent }) {
  const t = TIER[e.source_tier];
  return (
    <li className="flex gap-3 border-b border-line py-3 last:border-0 last:pb-0">
      <span
        className={`mt-0.5 h-fit shrink-0 rounded-md px-1.5 py-0.5 text-sm font-bold tabular ${t.cls}`}
      >
        {e.source_tier}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-base font-semibold">{sourceName(e.source_id)}</span>
          <span className="shrink-0 text-base text-ink-3 tabular">{shortAge(e.age_sec)} ago</span>
        </div>
        <p className="mt-0.5 text-base break-words text-ink-2">{e.summary}</p>
      </div>
    </li>
  );
}

export function RecommendationDetail({ id }: { id: string }) {
  const set = useApp((s) => s.set);
  const syncedAt = useApp((s) => s.syncedAt);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState(false);

  // Refetch whenever a sync lands (syncedAt changes).
  useEffect(() => {
    let live = true;
    db.details
      .get(id)
      .then((c) => live && c && setDetail((d) => d ?? c.detail))
      .catch(() => {});
    api
      .recommendation(id)
      .then((d) => {
        if (!live) return;
        setDetail(d);
        setError(false);
        db.details.put({ id, detail: d, synced_at_local: Date.now() }).catch(() => {});
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [id, syncedAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && set({ selectedId: null });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [set]);

  const rec = detail?.recommendation;
  const f = detail?.formula;
  const support = detail?.events.filter((e) => e.polarity === 1) ?? [];
  const oppose = detail?.events.filter((e) => e.polarity === -1) ?? [];
  const points = rec && f ? PARTS.map((p) => rec.components[p.key] * f[p.w] * 100) : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recommendation details"
      className="fixed inset-0 z-20 mx-auto flex max-w-2xl flex-col bg-paper"
    >
      <div className="flex h-14 shrink-0 items-center gap-1 bg-card px-1 shadow-[0_1px_0_rgb(15_23_32/0.08)]">
        <button
          type="button"
          onClick={() => set({ selectedId: null })}
          className="flex size-12 items-center justify-center rounded-full active:bg-paper"
          aria-label="Back to list"
        >
          <BackIcon />
        </button>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-lg font-bold">{rec?.place_name ?? 'Loading…'}</h1>
          {rec && <p className="text-base text-ink-2">{rec.taluka} taluka</p>}
        </div>
      </div>

      <div className="cs-sheet flex-1 space-y-3 overflow-y-auto px-4 pt-4 pb-8">
        {!detail && error && (
          <p className="py-8 text-lg">Can’t load details offline for this village yet.</p>
        )}
        {rec && f && (
          <>
            <Card className="relative overflow-hidden pl-5">
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-1.5 ${BAND_FILL[rec.band]}`}
              />
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg leading-snug font-medium">{rec.reason_text}</p>
                <ConfidenceBadge band={rec.band} score={rec.composite_score} large />
              </div>
              {rec.conflict_flag && (
                <div className="mt-3">
                  <ConflictFlag />
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <SourceAge seconds={rec.oldest_source_age_sec} stale={rec.stale_flag} />
                <a
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-xl px-3 text-base font-semibold text-info active:bg-info-bg"
                  href={`geo:${rec.centroid.lat},${rec.centroid.lon}?q=${rec.centroid.lat},${rec.centroid.lon}(${encodeURIComponent(rec.place_name)})`}
                  aria-label={`Open ${rec.place_name} in maps, ${rec.centroid.lat.toFixed(4)} north, ${rec.centroid.lon.toFixed(4)} east`}
                >
                  <PinIcon className="size-5" />
                  Open in maps
                </a>
              </div>
            </Card>

            <Card>
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl font-bold">Why {rec.composite_score}?</h2>
                <span className="text-base text-ink-2">same formula everywhere</span>
              </div>
              {/* One bar: the three parts add up to the score. */}
              <div
                className="mt-3 flex h-4 overflow-hidden rounded-full bg-paper"
                aria-hidden="true"
              >
                {PARTS.map((p, i) => (
                  <div
                    key={p.key}
                    className={`${p.color} h-full`}
                    style={{ width: `${points[i]}%` }}
                  />
                ))}
              </div>
              <ul className="mt-2">
                {PARTS.map((p, i) => (
                  <li
                    key={p.key}
                    className="flex items-center gap-3 border-b border-line py-2.5 last:border-0"
                  >
                    <span
                      aria-hidden="true"
                      className={`size-3 shrink-0 rounded-full ${p.color}`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold">{p.label}</p>
                      <p className="text-base text-ink-2">{p.gloss}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold tabular">+{Math.round(points[i] ?? 0)}</p>
                      <p className="text-base text-ink-3 tabular">
                        {rec.components[p.key].toFixed(2)} × {f[p.w].toFixed(2)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            {oppose.length > 0 && (
              <Card className="shadow-[0_0_0_2px_var(--color-medium)]">
                <h2 className="text-xl font-bold">Says safe ({oppose.length})</h2>
                <ul className="mt-1">
                  {oppose.map((e) => (
                    <Signal key={e.id} e={e} />
                  ))}
                </ul>
              </Card>
            )}

            <Card>
              <h2 className="text-xl font-bold">
                {oppose.length > 0 ? 'Says hazard' : 'Signals'} ({support.length})
              </h2>
              <ul className="mt-1">
                {support.map((e) => (
                  <Signal key={e.id} e={e} />
                ))}
              </ul>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
