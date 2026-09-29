import type { Banner } from '../status';

export function StalenessBanner({ banner }: { banner: Banner }) {
  if (banner.kind !== 'stale') return null;
  return (
    <div role="status" className="bg-warn-bg px-4 py-3 text-base font-semibold text-ink">
      <span aria-hidden="true">⟳ </span>Sources refreshing…
    </div>
  );
}
