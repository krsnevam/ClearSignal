import { useEffect, useState } from 'react';
import { api } from '../api';
import { type DrillResult, drillCsv, saveDrill } from '../drill';
import { placeName, useT } from '../i18n';
import { useApp } from '../state';
import { refresh } from '../storage/sync';

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/** Facilitator overlay: hand-over screen → running timer → record result. */
export function DrillOverlay() {
  const { t, locale } = useT();
  const drill = useApp((s) => s.drill);
  const info = useApp((s) => s.api);
  const top = useApp((s) => s.ranking?.recommendations[0]);
  const set = useApp((s) => s.set);
  const [now, setNow] = useState(Date.now());
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!drill.startedAt || stoppedAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [drill.startedAt, stoppedAt]);

  if (!drill.active) return null;
  const participant = drill.results.length + 1;
  const exit = () => {
    setStoppedAt(null);
    setReason('');
    set({ drill: { ...drill, active: false, startedAt: null } });
  };

  const start = async () => {
    // Same frame for every participant: rewind the replay if this server allows it.
    if (info?.demo_controls && info.replay?.scenario) {
      await api.replayRestart().catch(() => {});
      await refresh();
    }
    set({
      selectedId: null,
      sheet: null,
      tab: 'list',
      query: '',
      bandFilter: null,
      drill: { ...drill, startedAt: Date.now() },
    });
    setStoppedAt(null);
    setReason('');
  };

  const record = (correct: boolean) => {
    if (!drill.startedAt || !stoppedAt) return;
    const result: DrillResult = {
      participant,
      seconds: (stoppedAt - drill.startedAt) / 1000,
      top_village: top?.place_name ?? '—',
      correct,
      reason: reason.trim(),
      at_iso: new Date().toISOString(),
    };
    const results = [...drill.results, result];
    saveDrill(results);
    set({ drill: { active: true, startedAt: null, results } });
    setStoppedAt(null);
    setReason('');
  };

  // 1. Hand-over screen
  if (!drill.startedAt) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('drill.dialog')}
        className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-chrome p-8 text-center text-on-chrome"
      >
        <p className="text-base font-semibold tracking-wide uppercase opacity-80">
          {t('drill.mode', { n: participant })}
        </p>
        <p className="text-2xl leading-snug font-bold">
          {t('drill.handOver')}
          <br />
          {t('drill.question')}
        </p>
        <button
          type="button"
          onClick={start}
          className="min-h-14 w-full max-w-sm rounded-2xl bg-high text-xl font-bold text-ink"
        >
          {t('drill.start')}
        </button>
        <button type="button" onClick={exit} className="min-h-12 text-base font-semibold underline">
          {t('drill.exit')}
        </button>
      </div>
    );
  }

  // 3. Record result
  if (stoppedAt) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('drill.recordDialog')}
        className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 lg:items-center"
      >
        <div className="cs-sheet w-full max-w-lg rounded-t-3xl bg-paper p-5 lg:rounded-3xl">
          <p className="text-base text-ink-2">{t('drill.participant', { n: participant })}</p>
          <p className="text-5xl font-bold tabular">{fmt(stoppedAt - drill.startedAt)}</p>
          <p className="mt-2 text-lg">
            {t('drill.topShown', { place: top ? placeName(top, locale) : '—' })}
          </p>
          <label className="mt-3 block text-base font-semibold" htmlFor="drill-reason">
            {t('drill.reason')}
          </label>
          <input
            id="drill-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 h-12 w-full rounded-xl bg-card px-3 text-base shadow-[0_0_0_1px_rgb(15_23_32/0.15)]"
            placeholder={t('drill.reasonPlaceholder')}
          />
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => record(true)}
              className="min-h-14 rounded-2xl bg-high text-lg font-bold text-ink"
            >
              {t('drill.correct')}
            </button>
            <button
              type="button"
              onClick={() => record(false)}
              className="min-h-14 rounded-2xl bg-low text-lg font-bold text-white"
            >
              {t('drill.wrong')}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setStoppedAt(null)}
            className="mt-2 min-h-12 w-full text-base font-semibold text-info"
          >
            {t('drill.resume')}
          </button>
        </div>
      </div>
    );
  }

  // 2. Running: small timer the facilitator can stop
  const elapsed = now - drill.startedAt;
  return (
    <div className="fixed top-16 left-1/2 z-40 -translate-x-1/2">
      <button
        type="button"
        onClick={() => setStoppedAt(Date.now())}
        className={`flex min-h-12 items-center gap-3 rounded-full px-5 text-lg font-bold shadow-xl ${
          elapsed > 90_000 ? 'bg-low text-white' : 'bg-chrome text-on-chrome'
        }`}
        aria-label={t('drill.timerAria', { time: fmt(elapsed) })}
      >
        <span className="tabular">{fmt(elapsed)}</span>
        <span className="rounded-full bg-white/20 px-3 py-0.5 text-base">{t('drill.stop')}</span>
      </button>
    </div>
  );
}

export function DrillResults() {
  const { t } = useT();
  const drill = useApp((s) => s.drill);
  const set = useApp((s) => s.set);
  const [copied, setCopied] = useState(false);
  if (drill.results.length === 0) return null;
  const csv = drillCsv(drill.results);
  return (
    <div className="mt-3">
      <table className="w-full text-left text-base">
        <thead className="text-ink-2">
          <tr>
            <th className="py-1 font-semibold">#</th>
            <th className="py-1 font-semibold">{t('drill.time')}</th>
            <th className="py-1 font-semibold">{t('drill.correct')}</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {drill.results.map((r) => (
            <tr key={r.at_iso} className="border-t border-line">
              <td className="py-1.5">{r.participant}</td>
              <td className="py-1.5">{r.seconds.toFixed(1)} s</td>
              <td className="py-1.5">{r.correct ? t('drill.yes') : t('drill.no')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard?.writeText(csv).catch(() => {});
            setCopied(true);
          }}
          className="min-h-12 rounded-xl bg-paper text-base font-semibold"
        >
          {copied ? t('drill.copied') : t('drill.copyCsv')}
        </button>
        <a
          href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`}
          download="clearsignal-drill.csv"
          className="flex min-h-12 items-center justify-center rounded-xl bg-paper text-base font-semibold"
        >
          {t('drill.download')}
        </a>
        <button
          type="button"
          onClick={() => {
            if (!confirm(t('drill.clearConfirm'))) return;
            saveDrill([]);
            set({ drill: { ...drill, results: [] } });
          }}
          className="min-h-12 rounded-xl bg-paper text-base font-semibold text-low-ink"
        >
          {t('drill.clear')}
        </button>
      </div>
    </div>
  );
}
