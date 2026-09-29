import type { Banner } from '../status';
import { RefreshIcon } from './Icons';

export function StalenessBanner({ banner }: { banner: Banner }) {
  if (banner.kind !== 'stale') return null;
  return (
    <div
      role="status"
      className="flex items-center gap-2 bg-warn-bg px-4 py-2.5 text-base font-semibold text-ink"
    >
      <RefreshIcon className="size-5 shrink-0 text-medium-ink" />
      Sources refreshing…
    </div>
  );
}
