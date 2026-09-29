import { localTime } from '../format';
import type { Banner } from '../status';

export function OfflineBanner({ banner }: { banner: Banner }) {
  if (banner.kind === 'offline') {
    return (
      <div role="status" className="bg-info-bg px-4 py-3 text-base font-semibold text-ink">
        <span aria-hidden="true">✈ </span>Offline · showing last data from {localTime(banner.since)}
      </div>
    );
  }
  if (banner.kind === 'expired') {
    return (
      <div role="alert" className="bg-err-bg px-4 py-3 text-base font-semibold text-low">
        <span aria-hidden="true">✈ </span>
        {banner.since === null
          ? 'Offline · no data cached on this phone yet'
          : 'Offline · data older than 24 hours'}
      </div>
    );
  }
  return null;
}
