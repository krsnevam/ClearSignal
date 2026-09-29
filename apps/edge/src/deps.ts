import { defaultWeights } from '@clearsignal/fusion';
import { KODAGU_2018_EVENTS, VILLAGES } from '@clearsignal/kodagu-fixtures';
import type { AppDeps } from './app';
import { Bus } from './bus';
import { clockFromConfig } from './clock';
import type { Config } from './config';
import { MemoryStore } from './store/memory';
import { NeonStore } from './store/neon';

export function buildDeps(cfg: Config): AppDeps {
  const clock = clockFromConfig(cfg);
  const store = cfg.DATABASE_URL
    ? new NeonStore(cfg.DATABASE_URL)
    : new MemoryStore(clock.scenario ? KODAGU_2018_EVENTS : []);
  return { cfg, clock, store, bus: new Bus(), weights: defaultWeights, villages: VILLAGES };
}
