import type { Band } from '@clearsignal/schema';
import { BAND_LABEL } from '../format';

// High/Medium carry dark text, Low white text — every pairing ≥ 4.5:1 (§10.2).
const STYLE: Record<Band, string> = {
  H: 'bg-high text-ink',
  M: 'bg-medium text-ink',
  L: 'bg-low text-white',
};

const DOT: Record<Band, string> = { H: '●', M: '◆', L: '▲' }; // shape as well as colour

export function ConfidenceBadge({
  band,
  score,
  large = false,
}: {
  band: Band;
  score: number;
  large?: boolean;
}) {
  return (
    <span
      role="img"
      className={`inline-flex items-center gap-2 rounded-lg px-3 font-bold tracking-wide ${STYLE[band]} ${
        large ? 'h-12 text-2xl' : 'h-9 text-lg'
      }`}
      aria-label={`${BAND_LABEL[band]} confidence, score ${score} of 100`}
    >
      <span aria-hidden="true">{DOT[band]}</span>
      {BAND_LABEL[band]}
      <span className="tabular-nums">{score}</span>
    </span>
  );
}
