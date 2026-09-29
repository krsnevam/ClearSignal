import { shortAge } from '../format';
import { ClockIcon } from './Icons';

export function SourceAge({ seconds, stale }: { seconds: number; stale?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-base ${stale ? 'font-semibold text-low-ink' : 'text-ink-2'}`}
    >
      <ClockIcon className="size-[18px]" />
      <span className="tabular">oldest {shortAge(seconds)}</span>
      {stale && <span>· stale</span>}
    </span>
  );
}
