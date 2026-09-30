import type { EventType, Reason, Recommendation } from '@clearsignal/schema';
import type { MessageKey } from './en';
import { joinList, type Locale, longAge, translate } from './index';

function groupsText(groups: Reason['groups'], more: number, locale: Locale): string {
  const parts = groups.map((g) =>
    translate(locale, 'reason.count', {
      n: g.count,
      what: translate(locale, `ev.${g.type}` as MessageKey, { n: g.count }),
    }),
  );
  if (more > 0) parts.push(translate(locale, 'reason.more', { n: more }));
  return joinList(parts, locale);
}

function evLabel(type: EventType, locale: Locale) {
  return translate(locale, `ev.${type}` as MessageKey, { n: 1 });
}

/**
 * The card's "why" sentence in the chosen language. English uses the server's
 * sentence verbatim (it is the reference and matches the API and dispatch);
 * other languages build it from the structured reason.
 */
export function reasonText(
  rec: Pick<Recommendation, 'reason' | 'reason_text'>,
  locale: Locale,
): string {
  const r = rec.reason;
  if (locale === 'en' || !r) return rec.reason_text;
  const age = longAge(r.oldest_age_sec, locale);
  let body: string;
  switch (r.kind) {
    case 'none':
      return translate(locale, 'reason.none');
    case 'single': {
      const g = r.groups[0];
      body = translate(locale, r.unverified ? 'reason.singleUnverified' : 'reason.single', {
        what: g ? evLabel(g.type, locale) : '',
        age,
      });
      break;
    }
    case 'conflict':
      body = translate(locale, 'reason.conflict', {
        support: groupsText(r.groups, r.more, locale),
        oppose: groupsText(r.oppose_groups, r.oppose_more, locale),
        age,
      });
      break;
    default:
      body = translate(locale, 'reason.agree', { list: groupsText(r.groups, r.more, locale), age });
  }
  return r.stale ? translate(locale, 'reason.stale') + body : body;
}
