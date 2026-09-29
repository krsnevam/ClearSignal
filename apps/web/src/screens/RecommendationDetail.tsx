import type { ContributingEvent, RecommendationDetail as Detail } from '@clearsignal/schema';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { ConfidenceBadge } from '../components/ConfidenceBadge';
import { ConflictFlag } from '../components/ConflictFlag';
import { shortAge, sourceName } from '../format';
import { useApp } from '../state';
import { db } from '../storage/dexie';

const TIER_TEXT = {
  T1: 'Official sensor',
  T2: 'Satellite',
  T3: 'Partner data',
  T4: 'Citizen',
} as const;

function ComponentBar({
  label,
  gloss,
  value,
  weight,
}: {
  label: string;
  gloss: string;
  value: number;
  weight: number;
}) {
  const points = Math.round(value * weight * 100);
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-lg font-semibold">{label}</span>
        <span className="text-base tabular-nums text-ink-2">
          {value.toFixed(2)} × {weight.toFixed(2)} = <b className="text-ink">{points}</b>
        </span>
      </div>
      <p className="text-base text-ink-2">{gloss}</p>
      <div className="mt-1 h-3 rounded bg-paper" aria-hidden="true">
        <div className="h-3 rounded bg-ink" style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
    </div>
  );
}

function Signal({ e }: { e: ContributingEvent }) {
  return (
    <li className="flex gap-3 border-b border-line py-3 last:border-0">
      <span
        className={`mt-1 h-fit shrink-0 rounded px-1.5 text-sm font-bold ${e.polarity === -1 ? 'bg-medium text-ink' : 'bg-paper text-ink'}`}
      >
        {e.source_tier}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-base font-semibold">{sourceName(e.source_id)}</span>
          <span className="shrink-0 text-base tabular-nums text-ink-2">
            {shortAge(e.age_sec)} ago
          </span>
        </div>
        <p className="text-base text-ink-2">
          {TIER_TEXT[e.source_tier]} ·{' '}
          {e.polarity === -1 ? <b className="text-ink">says safe</b> : 'reports hazard'}
        </p>
        <p className="text-base break-words text-ink">{e.summary}</p>
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Recommendation details"
      className="fixed inset-0 z-20 flex flex-col bg-paper"
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-card px-2">
        <button
          type="button"
          onClick={() => set({ selectedId: null })}
          className="flex size-12 items-center justify-center rounded-lg text-2xl"
          aria-label="Back to list"
        >
          ←
        </button>
        <h1 className="truncate text-xl font-bold">
          {rec ? `${rec.place_name} · ${rec.taluka}` : 'Loading…'}
        </h1>
      </div>

      <div className="cs-sheet flex-1 overflow-y-auto px-4 pb-8">
        {!detail && error && (
          <p className="py-8 text-lg">Can’t load details offline for this village yet.</p>
        )}
        {rec && f && (
          <>
            <section className="mt-4 rounded-xl border border-line bg-card p-4">
              <ConfidenceBadge band={rec.band} score={rec.composite_score} large />
              <div className="mt-2">
                <a
                  className="flex min-h-12 items-center text-base font-semibold text-info underline"
                  href={`geo:${rec.centroid.lat},${rec.centroid.lon}?q=${rec.centroid.lat},${rec.centroid.lon}(${encodeURIComponent(rec.place_name)})`}
                >
                  {rec.centroid.lat.toFixed(4)}° N, {rec.centroid.lon.toFixed(4)}° E
                </a>
              </div>
              {rec.conflict_flag && (
                <div className="mt-3">
                  <ConflictFlag />
                </div>
              )}
              <p className="mt-3 text-lg leading-snug">{rec.reason_text}</p>
            </section>

            <section className="mt-4 rounded-xl border border-line bg-card p-4">
              <h2 className="text-xl font-bold">Why {rec.composite_score}?</h2>
              <p className="text-base text-ink-2">
                Three parts, added up. Same formula for every village.
              </p>
              <ComponentBar
                label="Fresh"
                gloss="How recent is the newest signal?"
                value={rec.components.recency}
                weight={f.recency_weight}
              />
              <ComponentBar
                label="Agreement"
                gloss="How many independent sources say the same thing?"
                value={rec.components.agreement}
                weight={f.agreement_weight}
              />
              <ComponentBar
                label="Trust"
                gloss="How reliable are those sources? Sensors > satellite > partner data > SMS."
                value={rec.components.reliability}
                weight={f.reliability_weight}
              />
            </section>

            {oppose.length > 0 && (
              <section className="mt-4 rounded-xl border-2 border-medium bg-card p-4">
                <h2 className="text-xl font-bold">Says safe ({oppose.length})</h2>
                <ul>
                  {oppose.map((e) => (
                    <Signal key={e.id} e={e} />
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-4 rounded-xl border border-line bg-card p-4">
              <h2 className="text-xl font-bold">
                {oppose.length > 0 ? 'Says hazard' : 'Signals'} ({support.length})
              </h2>
              <ul>
                {support.map((e) => (
                  <Signal key={e.id} e={e} />
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
