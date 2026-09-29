import { shortAge } from '../format';

export function SourceAge({ seconds, stale }: { seconds: number; stale?: boolean }) {
  return (
    <span className={`text-base tabular-nums ${stale ? 'font-semibold text-low' : 'text-ink-2'}`}>
      oldest {shortAge(seconds)}
    </span>
  );
}
