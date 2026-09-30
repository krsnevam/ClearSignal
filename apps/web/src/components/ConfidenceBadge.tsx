import type { Band } from '@clearsignal/schema';
import { useT } from '../i18n';

export const BAND_FILL: Record<Band, string> = { H: 'bg-high', M: 'bg-medium', L: 'bg-low' };
export const BAND_SOFT: Record<Band, string> = {
  H: 'bg-high-soft',
  M: 'bg-medium-soft',
  L: 'bg-low-soft',
};
export const BAND_TEXT: Record<Band, string> = {
  H: 'text-high-ink',
  M: 'text-medium-ink',
  L: 'text-low-ink',
};

/** Score + band, stacked. Band is carried by colour, word and shape together. */
export function ConfidenceBadge({
  band,
  score,
  large = false,
}: {
  band: Band;
  score: number;
  large?: boolean;
}) {
  const { t } = useT();
  const label = t(`band.${band}`);
  return (
    <span
      role="img"
      aria-label={t('band.aria', { band: label, score })}
      className="flex shrink-0 flex-col items-end"
    >
      <span
        className={`tabular font-bold leading-none tracking-tight text-ink ${large ? 'text-5xl' : 'text-[34px]'}`}
      >
        {score}
      </span>
      <span
        className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-base font-semibold ${BAND_SOFT[band]} ${BAND_TEXT[band]}`}
      >
        <span aria-hidden="true" className={`size-2.5 rounded-full ${BAND_FILL[band]}`} />
        {label}
      </span>
    </span>
  );
}
