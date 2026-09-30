import { localTime } from '../format';
import { useT } from '../i18n';
import type { Banner } from '../status';
import { OfflineIcon } from './Icons';

export function OfflineBanner({ banner }: { banner: Banner }) {
  const { t } = useT();
  if (banner.kind === 'offline') {
    return (
      <div
        role="status"
        className="flex items-center gap-2 bg-info-bg px-4 py-2.5 text-base font-semibold text-ink"
      >
        <OfflineIcon className="size-5 shrink-0 text-info" />
        {t('banner.offline', { time: localTime(banner.since) })}
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
        {banner.since === null ? t('banner.noCache') : t('banner.expired')}
      </div>
    );
  }
  return null;
}
