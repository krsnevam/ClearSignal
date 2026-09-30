import { type ReactNode, useEffect } from 'react';
import { useT } from '../i18n';
import { useApp } from '../state';

/** Bottom sheet on phones, centred panel on desktop. Esc / backdrop closes. */
export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
}) {
  const set = useApp((s) => s.set);
  const { t } = useT();
  const close = onClose ?? (() => set({ sheet: null }));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center lg:items-center">
      <button
        type="button"
        aria-label={t('common.close')}
        onClick={close}
        className="absolute inset-0 bg-black/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="cs-sheet relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-3xl bg-paper shadow-2xl lg:rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={close}
            className="flex min-h-12 items-center rounded-full px-4 text-base font-semibold text-info active:bg-info-bg"
          >
            {t('common.done')}
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Section({
  title,
  children,
  note,
}: {
  title: string;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <section className="mt-4">
      <h3 className="mb-2 text-base font-semibold text-ink-2">{title}</h3>
      <div className="cs-card rounded-2xl bg-card p-3 shadow-[0_0_0_1px_rgb(15_23_32/0.08)]">
        {children}
      </div>
      {note && <p className="mt-1.5 px-1 text-base text-ink-2">{note}</p>}
    </section>
  );
}

/** Segmented control — each option is a ≥ 48 px target. */
export function Segmented<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-1 rounded-xl bg-paper p-1"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-12 rounded-lg px-2 text-base font-semibold transition ${
            value === o.value
              ? 'bg-card text-ink shadow-[0_1px_3px_rgb(15_23_32/0.2)]'
              : 'text-ink-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
