/** Maps real time → simulated August 2018 time (§12.3). */
export class ReplayClock {
  constructor(
    readonly realStartMs: number,
    readonly simStartMs: number,
    readonly speed = 60, // 60× = 1 real minute is 1 sim hour
    readonly simEndMs = Number.POSITIVE_INFINITY,
  ) {}

  nowSim(realNowMs = Date.now()): Date {
    const sim = this.simStartMs + (realNowMs - this.realStartMs) * this.speed;
    return new Date(Math.min(sim, this.simEndMs));
  }

  simSecondsSinceStart(realNowMs = Date.now()): number {
    return (this.nowSim(realNowMs).getTime() - this.simStartMs) / 1000;
  }
}

/** Events with observed_at ∈ (from, to] — one replayer tick (§12.4). */
export function dueBetween<T extends { observed_at_utc: string }>(
  events: readonly T[],
  fromMs: number,
  toMs: number,
): T[] {
  return events.filter((e) => {
    const t = Date.parse(e.observed_at_utc);
    return t > fromMs && t <= toMs;
  });
}
