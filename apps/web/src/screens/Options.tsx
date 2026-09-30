import { useState } from 'react';
import { api } from '../api';
import { Section, Segmented, Sheet } from '../components/Sheet';
import { median } from '../drill';
import { LOCALES, loadLocale, useT } from '../i18n';
import { applyPrefs, type Prefs, savePrefs } from '../prefs';
import { useApp } from '../state';
import { refresh } from '../storage/sync';
import { DrillResults } from './Drill';

export function Options() {
  const prefs = useApp((s) => s.prefs);
  const info = useApp((s) => s.api);
  const installPrompt = useApp((s) => s.installPrompt);
  const drill = useApp((s) => s.drill);
  const set = useApp((s) => s.set);
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const update = (patch: Partial<Prefs>) => {
    const next = { ...prefs, ...patch };
    applyPrefs(next);
    savePrefs(next);
    set({ prefs: next });
  };

  const control = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      set({ api: await api.info() });
      await refresh();
      setMsg(done);
    } catch {
      setMsg(t('opt.unreachable'));
    } finally {
      setBusy(false);
    }
  };

  const speed = info?.replay?.speed ?? 60;
  const med = median(drill.results.map((r) => r.seconds));
  const isIos = typeof navigator !== 'undefined' && /iphone|ipad/i.test(navigator.userAgent);

  return (
    <Sheet title={t('app.options')}>
      <Section title={t('opt.language')} note={t('opt.languageNote')}>
        <Segmented
          label={t('opt.language')}
          value={prefs.locale}
          onChange={(locale) => void loadLocale(locale).then(() => update({ locale }))}
          options={LOCALES.map((l) => ({ value: l.code, label: l.label }))}
        />
      </Section>

      <Section title={t('opt.display')}>
        <Segmented
          label={t('opt.theme')}
          value={prefs.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: 'light', label: t('opt.day') },
            { value: 'dark', label: t('opt.night') },
            { value: 'sun', label: t('opt.sun') },
          ]}
        />
        <div className="mt-2">
          <Segmented
            label={t('opt.textSize')}
            value={prefs.text}
            onChange={(text) => update({ text })}
            options={[
              { value: 'standard', label: t('opt.standard') },
              { value: 'large', label: t('opt.large') },
            ]}
          />
        </div>
      </Section>

      <Section title={t('opt.understand')}>
        <button
          type="button"
          onClick={() => set({ sheet: 'how' })}
          className="flex min-h-12 w-full items-center justify-between rounded-xl px-2 text-left text-base font-semibold"
        >
          {t('how.title')} <span aria-hidden="true">›</span>
        </button>
      </Section>

      {info?.replay?.scenario && (
        <Section
          title={t('opt.presenter')}
          note={info.demo_controls ? t('opt.presenterNote') : t('opt.presenterLocked')}
        >
          {info.demo_controls ? (
            <>
              <Segmented
                label={t('opt.replaySpeed')}
                value={info.replay.paused ? 0 : speed}
                onChange={(s) =>
                  control(
                    () => api.replaySpeed(s),
                    s === 0 ? t('opt.paused') : t('opt.running', { speed: s }),
                  )
                }
                options={[
                  { value: 0, label: t('opt.pause') },
                  { value: 1, label: '1×' },
                  { value: 60, label: '60×' },
                  { value: 300, label: '300×' },
                ]}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => control(api.replayRestart, t('opt.restarted'))}
                className="mt-2 min-h-12 w-full rounded-xl bg-ink text-base font-semibold text-paper disabled:opacity-50"
              >
                {t('opt.restart')}
              </button>
              {msg && (
                <p role="status" className="mt-2 text-base text-ink-2">
                  {msg}
                </p>
              )}
            </>
          ) : (
            <p className="text-base text-ink-2">{t('opt.speedIs', { speed })}</p>
          )}
        </Section>
      )}

      <Section title={t('opt.drill')} note={t('opt.drillNote')}>
        <button
          type="button"
          onClick={() => set({ sheet: null, drill: { ...drill, active: true, startedAt: null } })}
          className="min-h-12 w-full rounded-xl bg-ink text-base font-semibold text-paper"
        >
          {t('opt.drillStart')}
        </button>
        {drill.results.length > 0 && (
          <p className="mt-2 text-base text-ink-2">
            {t('opt.drillRuns', { n: drill.results.length, median: med?.toFixed(0) ?? '—' })}
          </p>
        )}
        <DrillResults />
      </Section>

      <Section title={t('opt.phone')}>
        {installPrompt ? (
          <button
            type="button"
            onClick={async () => {
              await installPrompt.prompt();
              set({ installPrompt: null });
            }}
            className="min-h-12 w-full rounded-xl bg-ink text-base font-semibold text-paper"
          >
            {t('opt.install')}
          </button>
        ) : (
          <p className="text-base text-ink-2">
            {isIos ? t('opt.installIos') : t('opt.installOther')}
          </p>
        )}
        <p className="mt-2 text-base text-ink-2">
          {t('opt.offlineNote', { version: __APP_VERSION__ })}
        </p>
      </Section>
    </Sheet>
  );
}
