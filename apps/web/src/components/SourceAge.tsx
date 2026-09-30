import { shortAge, useT } from '../i18n';
import { ClockIcon } from './Icons';

export function SourceAge({ seconds, stale }: { seconds: number; stale?: boolean }) {
  const { t, locale } = useT();
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-base ${stale ? 'font-semibold text-low-ink' : 'text-ink-2'}`}
    >
      <ClockIcon className="size-[18px]" />
      <span className="tabular">{t('card.oldest', { age: shortAge(seconds, locale) })}</span>
      {stale && <span>· {t('card.stale')}</span>}
    </span>
  );
}
