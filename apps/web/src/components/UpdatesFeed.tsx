import { type ReactNode, useState } from 'react';
import { istTime } from '../format';
import { placeName, useT } from '../i18n';
import { type Update, useApp } from '../state';
import { AlertIcon, ArrowDown, ArrowUp, DotIcon } from './Icons';

const ICON: Record<Update['kind'], { el: ReactNode; cls: string }> = {
  up: { el: <ArrowUp />, cls: 'text-low-ink' },
  new: { el: <DotIcon />, cls: 'text-info' },
  down: { el: <ArrowDown />, cls: 'text-high-ink' },
  conflict: { el: <AlertIcon className="size-4" />, cls: 'text-medium-ink' },
  resolved: { el: <DotIcon />, cls: 'text-ink-3' },
  report: { el: <DotIcon />, cls: 'text-info' },
};

/** "What changed": situational awareness is about deltas, not the whole list. */
export function UpdatesFeed() {
  const updates = useApp((s) => s.updates);
  const set = useApp((s) => s.set);
  const { t, locale } = useT();
  const [open, setOpen] = useState(false);
  if (updates.length === 0) return null;
  const shown = open ? updates.slice(0, 12) : updates.slice(0, 2);
  const text = (u: Update) =>
    t(`upd.${u.kind}`, {
      place: placeName(u, locale),
      band: t(`band.${u.band}`),
      rank: u.rank,
      score: u.to,
      from: u.from,
      to: u.to,
      n: u.n,
    });
  return (
    <section
      aria-label={t('upd.title')}
      className="cs-card mt-3 rounded-2xl bg-card px-3 py-2 shadow-[0_0_0_1px_rgb(15_23_32/0.08)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink-2">{t('upd.title')}</h2>
        {updates.length > 2 && (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="min-h-12 px-2 text-base font-semibold text-info"
            aria-expanded={open}
          >
            {open ? t('upd.less') : t('upd.all', { n: Math.min(updates.length, 12) })}
          </button>
        )}
      </div>
      <ul aria-live="polite">
        {shown.map((u) => (
          <li key={u.key}>
            <button
              type="button"
              onClick={() => set({ selectedId: u.rec_id })}
              className="flex min-h-12 w-full items-center gap-2.5 text-left text-base"
            >
              <span className={`shrink-0 ${ICON[u.kind].cls}`}>{ICON[u.kind].el}</span>
              <span className="min-w-0 flex-1">{text(u)}</span>
              <span className="shrink-0 text-ink-3 tabular">{istTime(u.at_utc)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
