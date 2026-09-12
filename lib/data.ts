import type { CorridorStation } from './types';

/**
 * Fixed geography of the corridor. Everything else — services, times, delays,
 * platforms — comes from the live DB feed in `lib/db-api.ts`.
 */

export const CORRIDOR_STATIONS: CorridorStation[] = [
  { id: 'ahar', name: 'Hamburg Hbf', short: 'HH', offset: 0 },
  { id: 'ahgb', name: 'Hamburg-Harburg', short: 'HBG', offset: 0.09 },
  { id: 'alun', name: 'Lüneburg', short: 'LBG', offset: 0.26 },
  { id: 'auel', name: 'Uelzen', short: 'UE', offset: 0.47 },
  { id: 'acel', name: 'Celle', short: 'CE', offset: 0.76 },
  { id: 'ahan', name: 'Hannover Hbf', short: 'H', offset: 1 },
];

/**
 * Platforms at Hannover Hbf kept clear for re-routing. Hannover has 12
 * through platforms; these three carry the fewest booked paths, so the
 * network agent uses them when it needs to free a conflicting path.
 */
export const SPARE_PLATFORMS = [9, 11, 13];
