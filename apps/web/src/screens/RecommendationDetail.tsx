import type {
  ContributingEvent,
  RecommendationDetail as Detail,
  SourceTier,
} from '@clearsignal/schema';
import { type ReactNode, useEffect, useState } from 'react';
import { api } from '../api';
import { BAND_FILL, ConfidenceBadge } from '../components/ConfidenceBadge';
import { ConflictFlag } from '../components/ConflictFlag';
import { BackIcon, PinIcon } from '../components/Icons';
import { SourceAge } from '../components/SourceAge';
import { dispatchMessage, smsHref } from '../dispatch';
import { type MessageKey, placeName, shortAge, sourceName, talukaName, useT } from '../i18n';
import { reasonText } from '../i18n/reason';
import { signalSummary } from '../i18n/summary';
import { useApp } from '../state';
import { db } from '../storage/dexie';

const TIER_CLS: Record<SourceTier, string> = {
  T1: 'bg-ink text-paper',
  T2: 'bg-t2-bg text-t2-ink',
  T3: 'bg-paper text-ink',
  T4: 'bg-medium-soft text-medium-ink',
};

const PARTS = [
  { key: 'recency', label: 'detail.part.fresh', color: 'bg-part-fresh', w: 'recency_weight' },
  { key: 'agreement', label: 'detail.part.agree', color: 'bg-part-agree', w: 'agreement_weight' },
  {
    key: 'reliability',
    label: 'detail.part.trust',
    color: 'bg-part-trust',
    w: 'reliability_weight',
  },
] as const;

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={`cs-card rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgb(15_23_32/0.06),0_0_0_1px_rgb(15_23_32/0.05)] ${className}`}
    >
      {children}
    </section>
  );
}

function Signal({ e }: { e: ContributingEvent }) {
  const { t, locale } = useT();
  return (
    <li className="flex gap-3 border-b border-line py-3 last:border-0 last:pb-0">
      <span
        className={`mt-0.5 h-fit shrink-0 rounded-md px-1.5 py-0.5 text-sm font-bold tabular ${TIER_CLS[e.source_tier]}`}
        title={t(`tier.${e.source_tier}`)}
      >
        {e.source_tier}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-base font-semibold">{sourceName(e.source_id, locale)}</span>
          <span className="shrink-0 text-base text-ink-3 tabular">
            {t('detail.ago', { age: shortAge(e.age_sec, locale) })}
          </span>
        </div>
        <p className="mt-0.5 text-base break-words text-ink-2">{signalSummary(e, locale)}</p>
      </div>
    </li>
  );
}

function DispatchBar({ text, title }: { text: string; title: string }) {
  const { t } = useT();
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title, text }).catch(() => {});
    } else {
      window.location.href = smsHref(text);
    }
  };
  return (
    <div className="shrink-0 border-t border-line bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <button
          type="button"
          onClick={share}
          className="min-h-12 rounded-xl bg-ink px-4 text-base font-semibold text-paper"
        >
          {t('detail.send')}
        </button>
        <a
          href={smsHref(text)}
          className="flex min-h-12 items-center rounded-xl bg-paper px-4 text-base font-semibold"
          aria-label={t('detail.smsAria')}
        >
          {t('detail.sms')}
        </a>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(text).catch(() => {});
            setCopied(true);
          }}
          className="min-h-12 rounded-xl bg-paper px-4 text-base font-semibold"
          aria-label={t('detail.copyAria')}
        >
          {copied ? t('detail.copied') : t('detail.copy')}
        </button>
      </div>
    </div>
  );
}

export function RecommendationDetail({ id }: { id: string }) {
  const set = useApp((s) => s.set);
  const ranking = useApp((s) => s.ranking);
  const syncedAt = useApp((s) => s.syncedAt);
  const { t, locale } = useT();
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
  const place = rec ? placeName(rec, locale) : '';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('detail.dialog')}
      className="fixed inset-0 z-20 mx-auto flex max-w-2xl flex-col bg-paper lg:right-0 lg:left-auto lg:mx-0 lg:w-[520px] lg:shadow-[-8px_0_32px_rgb(0_0_0/0.18)]"
    >
      <div className="flex h-14 shrink-0 items-center gap-1 bg-card px-1 shadow-[0_1px_0_rgb(15_23_32/0.08)]">
        <button
          type="button"
          onClick={() => set({ selectedId: null })}
          className="flex size-12 items-center justify-center rounded-full active:bg-paper"
          aria-label={t('common.back')}
        >
          <BackIcon />
        </button>
        <div className="min-w-0 leading-tight">
          <h1 className="truncate text-lg font-bold">{rec ? place : t('common.loading')}</h1>
          {rec && (
            <p className="text-base text-ink-2">
              {t('card.taluka', { taluka: talukaName(rec.taluka, locale) })}
            </p>
          )}
        </div>
      </div>

      <div className="cs-sheet flex-1 space-y-3 overflow-y-auto px-4 pt-4 pb-8">
        {!detail && error && <p className="py-8 text-lg">{t('detail.offlineMissing')}</p>}
        {rec && f && (
          <>
            <Card className="relative overflow-hidden pl-5">
              <span
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 w-1.5 ${BAND_FILL[rec.band]}`}
              />
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg leading-snug font-medium">{reasonText(rec, locale)}</p>
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
                  aria-label={t('detail.openMapsAria', {
                    place,
                    lat: rec.centroid.lat.toFixed(4),
                    lon: rec.centroid.lon.toFixed(4),
                  })}
                >
                  <PinIcon className="size-5" />
                  {t('detail.openMaps')}
                </a>
              </div>
            </Card>

            <Card>
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold">
                  {t('detail.why', { score: rec.composite_score })}
                </h2>
                <span className="text-right text-base text-ink-2">{t('detail.sameFormula')}</span>
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
                      <p className="text-base font-semibold">{t(p.label)}</p>
                      <p className="text-base text-ink-2">{t(`${p.label}.gloss` as MessageKey)}</p>
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
                <h2 className="text-xl font-bold">{t('detail.saysSafe', { n: oppose.length })}</h2>
                <ul className="mt-1">
                  {oppose.map((e) => (
                    <Signal key={e.id} e={e} />
                  ))}
                </ul>
              </Card>
            )}

            <Card>
              <h2 className="text-xl font-bold">
                {oppose.length > 0
                  ? t('detail.saysHazard', { n: support.length })
                  : t('detail.signals', { n: support.length })}
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
      {rec && ranking && (
        <DispatchBar
          title={`ClearSignal: ${place}`}
          text={dispatchMessage(
            rec,
            ranking.recommendations.findIndex((r) => r.id === rec.id) + 1 || null,
            ranking.scenario_clock_utc,
            locale,
          )}
        />
      )}
    </div>
  );
}
