import type { CorridorStation } from './types';

/**
 * Fixed geography of the corridor. Everything else — services, times, delays,
 * platforms — comes from the live DB feed in `lib/db-api.ts`.
 */

export const HAMBURG_HBF = {
  name: 'Hamburg Hbf',
  dbStopId: '8002549',
  irisSlug: 'Hamburg%20Hbf',
} as const;

export const CORRIDOR_STATIONS: CorridorStation[] = [
  { id: 'ahar', name: 'Hamburg Hbf', short: 'HH', offset: 0 },
  { id: 'ahgb', name: 'Hamburg-Harburg', short: 'HBG', offset: 0.09 },
  { id: 'alun', name: 'Lüneburg', short: 'LBG', offset: 0.26 },
  { id: 'auel', name: 'Uelzen', short: 'UE', offset: 0.47 },
  { id: 'acel', name: 'Celle', short: 'CE', offset: 0.76 },
  { id: 'ahan', name: 'Hannover Hbf', short: 'H', offset: 1 },
];

/**
 * Candidate through platforms at Hamburg Hbf used by the planning model when
 * it needs to test whether re-platforming would remove an arrival conflict.
 */
export const SPARE_PLATFORMS = [5, 6, 7, 8, 11, 12, 13, 14];
