import type { Recommendation } from '@clearsignal/schema';
import { useT } from '../i18n';
import { RecommendationCard } from './RecommendationCard';

export function RankedList({
  recs,
  changed,
  onOpen,
}: {
  recs: readonly Recommendation[];
  changed: ReadonlySet<string>;
  onOpen: (id: string) => void;
}) {
  const { t } = useT();
  if (recs.length === 0) {
    return <p className="px-4 py-10 text-center text-lg text-ink-2">{t('primary.noMatch')}</p>;
  }
  return (
    <ol className="flex flex-col gap-3 px-4 pb-6" aria-label={t('primary.listLabel')}>
      {recs.map((r, i) => (
        <RecommendationCard
          key={r.id}
          rec={r}
          rank={i + 1}
          flash={changed.has(r.id)}
          onOpen={onOpen}
        />
      ))}
    </ol>
  );
}
