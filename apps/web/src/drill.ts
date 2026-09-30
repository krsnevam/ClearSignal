/** 90-second comprehension drill (docs/DRILL_PROTOCOL.md): timer + local results log. */
export interface DrillResult {
  participant: number;
  seconds: number;
  top_village: string;
  correct: boolean;
  reason: string;
  at_iso: string;
}

const KEY = 'clearsignal:drill';

export function loadDrill(): DrillResult[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as DrillResult[];
  } catch {
    return [];
  }
}

export function saveDrill(results: DrillResult[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(results));
  } catch {
    // ignore — results stay in memory for this session
  }
}

export function median(xs: readonly number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

export function drillCsv(results: readonly DrillResult[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = results.map((r) =>
    [
      r.participant,
      r.seconds.toFixed(1),
      esc(r.top_village),
      r.correct ? 'yes' : 'no',
      esc(r.reason),
      r.at_iso,
    ].join(','),
  );
  return ['participant,seconds,top_village,correct,reason,recorded_at', ...rows].join('\n');
}
