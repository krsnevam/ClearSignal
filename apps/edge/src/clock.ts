import type { Config } from './config';

export interface Clock {
  /** "Now" for scoring — simulated time during a replay, wall clock when live. */
  now(): Date;
  scenario: string | null;
  /** Restart the replay loop from its first frame (local demo / video shoot). */
  restart(): void;
}

export class LiveClock implements Clock {
  scenario = null;
  now() {
    return new Date();
  }
  restart() {}
}

/**
 * Loops the replay slice: sim = start + ((wall − anchor) mod loop) × speed.
 * Stateless apart from the anchor, so every Worker isolate agrees on sim time.
 */
export class LoopingReplayClock implements Clock {
  private anchorMs: number;
  private readonly simStartMs: number;
  private readonly loopRealMs: number;

  constructor(
    readonly scenario: string,
    simStartIso: string,
    private readonly speed: number,
    loopSimHours: number,
    anchorIso: string,
    private readonly wall: () => number = Date.now,
  ) {
    this.simStartMs = Date.parse(simStartIso);
    this.anchorMs = Date.parse(anchorIso);
    this.loopRealMs = (loopSimHours * 3_600_000) / speed;
  }

  now(): Date {
    const elapsed =
      (((this.wall() - this.anchorMs) % this.loopRealMs) + this.loopRealMs) % this.loopRealMs;
    return new Date(this.simStartMs + elapsed * this.speed);
  }

  restart() {
    this.anchorMs = this.wall();
  }
}

export function clockFromConfig(cfg: Config): Clock {
  if (cfg.REPLAY_MODE === 'off') return new LiveClock();
  return new LoopingReplayClock(
    cfg.REPLAY_MODE,
    cfg.REPLAY_SIM_START,
    cfg.REPLAY_SPEED,
    cfg.REPLAY_LOOP_SIM_HOURS,
    cfg.REPLAY_ANCHOR_UTC,
  );
}
