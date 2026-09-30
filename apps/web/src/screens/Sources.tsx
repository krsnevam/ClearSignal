import type { SourceStatus } from '@clearsignal/schema';
import { API_BASE } from '../api';
import { type Locale, type MessageKey, shortAge, sourceName, translate, useT } from '../i18n';
import { useApp } from '../state';

/** Named failure modes and what the system does about each (judged: reliability). */
const FAILURES = [1, 2, 3, 4] as const;

function latencyText(s: SourceStatus, locale: Locale): string {
  if (s.median_latency_seconds === null) return '—';
  if (s.median_latency_seconds < 60)
    return translate(locale, 'age.short.sec', { n: s.median_latency_seconds });
  return shortAge(s.median_latency_seconds, locale);
}

export function Sources() {
  const ranking = useApp((s) => s.ranking);
  const { t, locale } = useT();
  if (!ranking) return <p className="px-4 py-8 text-lg text-ink-2">{t('common.loading')}</p>;
  const now = Date.parse(ranking.scenario_clock_utc);
  const byTier = (['T1', 'T2', 'T3', 'T4'] as const).map((tier) => ({
    tier,
    sources: ranking.sources_status.filter((s) => s.tier === tier),
  }));
  const reporting = ranking.sources_status.filter((s) => s.events_24h > 0).length;

  return (
    <div className="px-4 py-5 lg:mx-auto lg:max-w-3xl">
      <h1 className="text-[22px] leading-tight font-bold tracking-tight">{t('src.title')}</h1>
      <p className="mt-1 text-base text-ink-2">
        {t('src.subtitle', { n: reporting, total: ranking.sources_status.length })}
      </p>

      {byTier.map(({ tier, sources }) => (
        <section key={tier} className="mt-5">
          <h2 className="mb-2 text-base font-semibold text-ink-2">
            {tier} · {t(`tierGroup.${tier}`)}
          </h2>
          <ul className="cs-card overflow-hidden rounded-2xl bg-card shadow-[0_0_0_1px_rgb(15_23_32/0.08)]">
            {sources.map((s) => {
              const age = s.last_seen_utc ? (now - Date.parse(s.last_seen_utc)) / 1000 : null;
              const absent = age === null && s.mode === 'replay';
              const dot = absent ? 'bg-line' : s.healthy ? 'bg-high' : 'bg-low';
              return (
                <li
                  key={s.source_id}
                  className="flex items-center gap-3 border-b border-line px-3 py-3 last:border-0"
                >
                  <span
                    role="img"
                    aria-label={
                      absent
                        ? t('src.notInReplay')
                        : s.healthy
                          ? t('src.healthy')
                          : t('src.notReporting')
                    }
                    className={`size-3.5 shrink-0 rounded-full ${dot}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold">{sourceName(s.source_id, locale)}</p>
                    <p className="text-base text-ink-2">
                      {t(`src.mode.${s.mode}`)} ·{' '}
                      {absent
                        ? t('src.notInArchive')
                        : age === null
                          ? t('src.noData')
                          : t('src.last', { age: shortAge(Math.max(0, age), locale) })}
                      {s.events_24h > 0 && (
                        <>
                          {' · '}
                          <span className="whitespace-nowrap">
                            {t('src.count24h', { n: s.events_24h })}
                          </span>
                        </>
                      )}
                    </p>
                    {s.last_error_msg && (
                      <p className="text-base text-low-ink">
                        {t('src.error', { msg: s.last_error_msg })}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-base font-semibold tabular">{latencyText(s, locale)}</p>
                    <p className="text-base text-ink-3">{t('src.delay')}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <section className="mt-6">
        <h2 className="mb-2 text-base font-semibold text-ink-2">{t('src.failTitle')}</h2>
        <ol className="cs-card rounded-2xl bg-card shadow-[0_0_0_1px_rgb(15_23_32/0.08)]">
          {FAILURES.map((i) => (
            <li key={i} className="flex gap-3 border-b border-line p-3 last:border-0">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-paper text-base font-bold tabular">
                {i}
              </span>
              <div>
                <p className="text-base font-semibold">{t(`src.fail${i}.t` as MessageKey)}</p>
                <p className="text-base text-ink-2">{t(`src.fail${i}.b` as MessageKey)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-4 text-base text-ink-2">
        {t('src.weights')}{' '}
        <a
          className="font-semibold text-info underline"
          href={`${API_BASE}/weights`}
          target="_blank"
          rel="noreferrer"
        >
          weights.yaml
        </a>
      </p>
    </div>
  );
}
