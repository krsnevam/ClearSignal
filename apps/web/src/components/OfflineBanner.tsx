import { localTime } from '../format';
import type { Banner } from '../status';
import { OfflineIcon } from './Icons';

export function OfflineBanner({ banner }: { banner: Banner }) {
  if (banner.kind === 'offline') {
    return (
      <div
        role="status"
        className="flex items-center gap-2 bg-info-bg px-4 py-2.5 text-base font-semibold text-ink"
      >
        <OfflineIcon className="size-5 shrink-0 text-info" />
        Offline · showing last data from {localTime(banner.since)}
      </div>
    );
  }
  if (banner.kind === 'expired') {
    return (
      <div
        role="alert"
        className="flex items-center gap-2 bg-err-bg px-4 py-2.5 text-base font-semibold text-low-ink"
      >
        <OfflineIcon className="size-5 shrink-0" />
        {banner.since === null
          ? 'Offline · no data cached on this phone yet'
          : 'Offline · data older than 24 hours'}
      </div>
    );
  }
  return null;
}
