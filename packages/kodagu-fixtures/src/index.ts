import type { RawEvent } from '@clearsignal/schema';
import events from '../data/events.json';

export { dueBetween, ReplayClock } from './clock';
export { KODAGU_BBOX, VILLAGES } from './villages';

export const SCENARIO_ID = 'kodagu-2018';
/** 09:00 IST, 16 Aug 2018 — first satellite-confirmed flood spread (§12.4). */
export const SCENARIO_VIDEO_START_UTC = '2018-08-16T03:30:00Z';
export const SCENARIO_END_UTC = '2018-08-17T12:30:00Z';

export const KODAGU_2018_EVENTS = events as unknown as RawEvent[];
