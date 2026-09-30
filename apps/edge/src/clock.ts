import type { Config } from './config';

export interface ClockInfo {
  scenario: string | null;
  speed: number;
  paused: boolean;
  sim_start_utc: string | null;
  loop_sim_hours: number | null;
}

export interface Clock {
  /** "Now" for scoring — simulated time during a replay, wall clock when live. */
  now(): Date;
  scenario: string | null;
  /** Restart the replay loop from its first frame (local demo / video shoot). */
  restart(): void;
  /** Change replay speed (0 = pause) without jumping the current sim time. */
  setSpeed(speed: number): void;
  info(): ClockInfo;
}

export class LiveClock implements Clock {
  scenario = null;
  now() {
    return new Date();
  }
  restart() {}
  setSpeed() {}
  info(): ClockInfo {
    return { scenario: null, speed: 1, paused: false, sim_start_utc: null, loop_sim_hours: null };
  }
}

/**
 * Loops the replay slice:
 *   sim = start + ((anchorSim − start) + (wall − anchorWall) × speed) mod loop
 * By default the anchor is a fixed instant from config, so every Worker isolate
 * agrees on sim time. restart() / setSpeed() re-anchor the isolate they run in.
 */
export class LoopingReplayClock implements Clock {
  private anchorWallMs: number;
  private anchorSimMs: number;
  private readonly simStartMs: number;
  private readonly loopSimMs: number;

  constructor(
    readonly scenario: string,
    simStartIso: string,
    private speed: number,
    private readonly loopSimHours: number,
    anchorIso: string,
    private readonly wall: () => number = Date.now,
  ) {
    this.simStartMs = Date.parse(simStartIso);
    this.anchorWallMs = Date.parse(anchorIso);
    this.anchorSimMs = this.simStartMs;
    this.loopSimMs = loopSimHours * 3_600_000;
  }

  now(): Date {
    const elapsed =
      this.anchorSimMs - this.simStartMs + (this.wall() - this.anchorWallMs) * this.speed;
    const wrapped = ((elapsed % this.loopSimMs) + this.loopSimMs) % this.loopSimMs;
    return new Date(this.simStartMs + wrapped);
  }

  restart() {
    this.anchorWallMs = this.wall();
    this.anchorSimMs = this.simStartMs;
  }

  setSpeed(speed: number) {
    const current = this.now().getTime();
    this.anchorWallMs = this.wall();
    this.anchorSimMs = current;
    this.speed = Math.max(0, speed);
  }

  info(): ClockInfo {
    return {
      scenario: this.scenario,
      speed: this.speed,
      paused: this.speed === 0,
      sim_start_utc: new Date(this.simStartMs).toISOString(),
      loop_sim_hours: this.loopSimHours,
    };
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
