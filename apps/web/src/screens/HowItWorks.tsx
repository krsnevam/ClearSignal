import { API_BASE } from '../api';
import { BAND_FILL } from '../components/ConfidenceBadge';
import { AlertIcon, ClockIcon } from '../components/Icons';
import { Section, Sheet } from '../components/Sheet';
import { useT } from '../i18n';
import { useApp } from '../state';

// Fallback only; the live values come from the server's weights.yaml via /rankings.
const DEFAULT_FORMULA = {
  recency_weight: 0.35,
  agreement_weight: 0.45,
  reliability_weight: 0.2,
  high_threshold: 70,
  medium_threshold: 40,
};

const PARTS = [
  { label: 'detail.part.fresh', key: 'recency_weight', color: 'bg-part-fresh', text: 'how.fresh' },
  {
    label: 'detail.part.agree',
    key: 'agreement_weight',
    color: 'bg-part-agree',
    text: 'how.agree',
  },
  {
    label: 'detail.part.trust',
    key: 'reliability_weight',
    color: 'bg-part-trust',
    text: 'how.trust',
  },
] as const;

const TIERS = ['T1', 'T2', 'T3', 'T4'] as const;

export function HowItWorks() {
  const { t } = useT();
  const f = useApp((s) => s.ranking?.formula) ?? DEFAULT_FORMULA;
  const hi = f.high_threshold;
  const mid = f.medium_threshold;
  const bands = [
    { b: 'H', from: hi, to: 100 },
    { b: 'M', from: mid, to: hi - 1 },
    { b: 'L', from: 0, to: mid - 1 },
  ] as const;

  return (
    <Sheet title={t('how.title')}>
      <p className="text-lg leading-snug">{t('how.intro')}</p>

      <Section title={t('how.parts')}>
        <ul>
          {PARTS.map((p) => (
            <li key={p.key} className="flex gap-3 border-b border-line py-2.5 last:border-0">
              <span
                aria-hidden="true"
                className={`mt-1.5 size-3 shrink-0 rounded-full ${p.color}`}
              />
              <div>
                <p className="text-base font-semibold">
                  {t('how.upTo', { part: t(p.label), points: Math.round(f[p.key] * 100) })}
                </p>
                <p className="text-base text-ink-2">{t(p.text)}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t('how.colours')}>
        {bands.map(({ b, from, to }) => (
          <div key={b} className="flex gap-3 border-b border-line py-2.5 last:border-0">
            <span
              aria-hidden="true"
              className={`mt-1 h-5 w-1.5 shrink-0 rounded-full ${BAND_FILL[b]}`}
            />
            <div>
              <p className="text-base font-semibold">
                {t('how.range', { band: t(`band.${b}`), from, to })}
              </p>
              <p className="text-base text-ink-2">{t(`how.${b}`)}</p>
            </div>
          </div>
        ))}
      </Section>

      <Section title={t('how.warnings')}>
        <div className="flex gap-3 border-b border-line py-2.5">
          <AlertIcon className="mt-0.5 size-5 shrink-0 text-medium-ink" />
          <p className="text-base">{t('how.conflict')}</p>
        </div>
        <div className="flex gap-3 py-2.5">
          <ClockIcon className="mt-0.5 size-5 shrink-0 text-low-ink" />
          <p className="text-base">{t('how.stale')}</p>
        </div>
      </Section>

      <Section title={t('how.tiers')}>
        <table className="w-full text-left text-base">
          <tbody>
            {TIERS.map((tier) => (
              <tr key={tier} className="border-b border-line align-top last:border-0">
                <td className="py-2 pr-3 font-bold tabular">{tier}</td>
                <td className="py-2">
                  <p className="font-semibold">{t(`tierGroup.${tier}`)}</p>
                  <p className="text-ink-2">{t(`how.tier.${tier}`)}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title={t('how.data')}>
        <p className="text-base">{t('how.dataBody')}</p>
      </Section>

      <p className="mt-4 mb-2 text-base text-ink-2">
        {t('how.weights')}{' '}
        <a
          className="font-semibold text-info underline"
          href={`${API_BASE}/weights`}
          target="_blank"
          rel="noreferrer"
        >
          weights.yaml
        </a>
      </p>
    </Sheet>
  );
}
