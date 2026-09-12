import { Platform } from 'react-native';

import { CORRIDOR_STATIONS } from './data';
import type { OnwardConnection, Train, TrainCategory } from './types';

/**
 * Live corridor feed for Hamburg Hbf → Hannover Hbf.
 *
 * Two public Deutsche Bahn front ends are read until one answers:
 *
 *  - `dbf.finalrewind.org` — station board built on DB's IRIS data. One
 *    request returns arrivals *and* departures at Hannover Hbf with the full
 *    route of every service, live arrival/departure delay, platform, and the
 *    German cause texts DB publishes ("Verspätung eines vorausfahrenden
 *    Zuges"). The richest source, but it sends no CORS header.
 *  - `v6.db.transport.rest` — REST wrapper on DB's own journey API. Thinner
 *    data, but it does send CORS headers.
 *
 * Order therefore depends on the platform: a browser tries the CORS-capable
 * host first, native (Expo Go, device builds) tries the richer one first,
 * since fetch there is not subject to CORS at all.
 *
 * Both are normalised into the same {@link BoardEntry} shape and then folded
 * into the cockpit's `Train` model.
 *
 * What is real: services, scheduled and live times, delay minutes, platforms,
 * cancellations, route, and delay causes.
 * What is modelled: passenger counts and how many of them transfer. DB does
 * not publish live loadings, so those are derived from service class and time
 * of day and are labelled as estimates in the UI.
 */

const IRIS_URL = 'https://dbf.finalrewind.org/Hannover%20Hbf.json?version=3';
const DB_REST_BASE = 'https://v6.db.transport.rest/stops/8000152';
const REQUEST_TIMEOUT_MS = 12_000;

/** Board window: services arriving from this far back to this far ahead. */
const WINDOW_BEHIND_MIN = 12;
const WINDOW_AHEAD_MIN = 95;
/** Services shown on the corridor at once. */
const MAX_TRAINS = 8;
/** Transfer at Hannover is only interesting inside this window. */
const MIN_TRANSFER_BUFFER_MIN = 4;
const MAX_TRANSFER_BUFFER_MIN = 28;
const MAX_CONNECTIONS_PER_TRAIN = 2;

export interface FeedSource {
  id: 'iris' | 'db-rest';
  label: string;
}

const SOURCE_IRIS: FeedSource = { id: 'iris', label: 'DB IRIS station board' };
const SOURCE_DB_REST: FeedSource = { id: 'db-rest', label: 'DB REST (v6)' };

/** One source's answer: normalised board rows plus which host produced them. */
interface BoardResult {
  entries: BoardEntry[];
  source: FeedSource;
}

export interface CorridorSnapshot {
  trains: Train[];
  source: FeedSource;
  /** Epoch milliseconds when the board was read. */
  fetchedAt: number;
  /** Board time in Berlin minutes since midnight. */
  boardMinutes: number;
  /** Services on the Hannover board before the corridor filter. */
  boardSize: number;
}

/* -------------------------------------------------------------------------- */
/* Berlin wall clock                                                           */
/* -------------------------------------------------------------------------- */

function berlinParts(date: Date) {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
    return { hour: value('hour') % 24, minute: value('minute'), second: value('second') };
  } catch {
    return { hour: date.getHours(), minute: date.getMinutes(), second: date.getSeconds() };
  }
}

/** Seconds since midnight in Berlin — the corridor's own clock. */
export function berlinSecondsSinceMidnight(date = new Date()) {
  const { hour, minute, second } = berlinParts(date);
  return hour * 3600 + minute * 60 + second;
}

/** Minutes since midnight in Berlin. */
export function berlinMinutesSinceMidnight(date = new Date()) {
  return Math.floor(berlinSecondsSinceMidnight(date) / 60);
}

/** "Tue 12 Sep" in Berlin, for the cockpit header. */
export function berlinDateLabel(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Berlin',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch {
    return date.toDateString().slice(0, 10);
  }
}

/* -------------------------------------------------------------------------- */
/* Corridor geography                                                          */
/* -------------------------------------------------------------------------- */

interface CorridorPoint {
  pattern: RegExp;
  name: string;
  offset: number;
}

/** Stations on the line, with their position between Hamburg (0) and Hannover (1). */
const CORRIDOR_POINTS: CorridorPoint[] = [
  { pattern: /^hamburg(\s+hbf|-altona|\s+dammtor|\s+harburg)?$/i, name: 'Hamburg Hbf', offset: 0 },
  { pattern: /^hamburg-harburg/i, name: 'Hamburg-Harburg', offset: 0.09 },
  { pattern: /^winsen/i, name: 'Winsen (Luhe)', offset: 0.16 },
  { pattern: /^l(ü|ue)neburg/i, name: 'Lüneburg', offset: 0.26 },
  { pattern: /^uelzen/i, name: 'Uelzen', offset: 0.47 },
  { pattern: /^bad bevensen/i, name: 'Bad Bevensen', offset: 0.55 },
  { pattern: /^celle/i, name: 'Celle', offset: 0.76 },
];

/** The other lines into Hannover — a route through these is not our corridor. */
const OFF_CORRIDOR = /bremen|rotenburg|nienburg|verden|buchholz|tostedt|hittfeld|sagehorn/i;

const isHannover = (name: string) => /^hannover\s+hbf/i.test(name.trim());

function corridorPoint(name: string) {
  const clean = name.trim();
  return CORRIDOR_POINTS.find((point) => point.pattern.test(clean));
}

/** Nearest corridor station to a 0..1 offset — where an event is reported. */
export function corridorStationAt(offset: number) {
  return CORRIDOR_STATIONS.reduce((closest, station) =>
    Math.abs(station.offset - offset) < Math.abs(closest.offset - offset) ? station : closest,
  ).name;
}

/* -------------------------------------------------------------------------- */
/* Delay causes                                                                */
/* -------------------------------------------------------------------------- */

/**
 * DB publishes delay causes in German. Each entry maps the real text to a
 * short control-room label plus a plain-English sentence.
 */
const CAUSE_TRANSLATIONS: { pattern: RegExp; label: string; detail: string }[] = [
  {
    pattern: /vorausfahrenden|vorheriger fahrt|versp(ä|ae)tung eines? zuges/i,
    label: 'Delay to a train ahead',
    detail: 'Held behind a late-running service, no overtaking path on the corridor.',
  },
  {
    pattern: /weiche/i,
    label: 'Points failure',
    detail: 'A set of points will not lock, trains routed over the remaining line.',
  },
  {
    pattern: /signal|stellwerk/i,
    label: 'Signalling fault',
    detail: 'Signalling problem on the route, reduced capacity through the section.',
  },
  {
    pattern: /oberleitung/i,
    label: 'Overhead line fault',
    detail: 'Damage to the overhead line, reduced line speed through the section.',
  },
  {
    pattern: /technische|defekt am zug|störung an dem zug/i,
    label: 'Technical fault on the train',
    detail: 'Technical fault on the unit, running under restriction.',
  },
  {
    pattern: /notarzt|arztlich|(ä|ae)rztlich|krank|notfall/i,
    label: 'Medical emergency',
    detail: 'Unscheduled stop while a passenger is attended to.',
  },
  {
    pattern: /polizei/i,
    label: 'Police operation',
    detail: 'Police dealing with an incident, trains held while the line is checked.',
  },
  {
    pattern: /bahn(ü|ue)bergang/i,
    label: 'Level crossing incident',
    detail: 'Level crossing out of use, line blocked while it is checked.',
  },
  {
    pattern: /personen im gleis|personen am gleis/i,
    label: 'Trespass on the line',
    detail: 'People reported on the track, trains stopped until the line is clear.',
  },
  {
    pattern: /bauarbeiten|baustelle/i,
    label: 'Engineering works',
    detail: 'Engineering work on the route, single-line or reduced-speed working.',
  },
  {
    pattern: /reparatur|instandsetzung/i,
    label: 'Infrastructure repair',
    detail: 'Repair work on the infrastructure is restricting the route.',
  },
  {
    pattern: /anschlussreisende|anschlusszug/i,
    label: 'Waiting for a connection',
    detail: 'Held to keep a connection for transferring passengers.',
  },
  {
    pattern: /personal|lokf(ü|ue)hrer|zugbegleit/i,
    label: 'Staffing shortage',
    detail: 'Traincrew not available on time for this working.',
  },
  {
    pattern: /fahrgastaufkommen|hohes reisendenaufkommen|ein- und aussteigen/i,
    label: 'Heavy boarding',
    detail: 'Extended station dwell while a large number of passengers board.',
  },
  {
    pattern: /bereitstellung|versp(ä|ae)tete bereitstellung/i,
    label: 'Train provided late',
    detail: 'The unit was placed on the platform late, so it left behind time.',
  },
  {
    pattern: /gleis(e)? .*eingeschr(ä|ae)nkt|gleis(ä|ae)nderung|gleiswechsel/i,
    label: 'Restricted track availability',
    detail: 'Track availability at the station is currently restricted.',
  },
  {
    pattern: /unwetter|sturm|witterung|schnee|gewitter/i,
    label: 'Weather restriction',
    detail: 'Weather restriction on the route, reduced line speed.',
  },
  {
    pattern: /tiere|tier im gleis/i,
    label: 'Animals on the line',
    detail: 'Animals reported on the track, trains running under caution.',
  },
  {
    pattern: /streik/i,
    label: 'Industrial action',
    detail: 'Industrial action is affecting this service.',
  },
  {
    pattern: /reihenfolge|vorfahrt/i,
    label: 'Re-timed behind another train',
    detail: 'Another service was given priority through the section.',
  },
];

interface TranslatedCause {
  label: string;
  detail: string;
}

/** Turn DB's German cause text into a control-room label and sentence. */
export function translateCause(text: string): TranslatedCause {
  const match = CAUSE_TRANSLATIONS.find((entry) => entry.pattern.test(text));
  if (match) return { label: match.label, detail: `${match.detail} DB reports: “${text}”.` };
  return { label: 'Delay reported', detail: `DB reports: “${text}”.` };
}

/* -------------------------------------------------------------------------- */
/* Passenger model (estimated — DB publishes no live loadings)                  */
/* -------------------------------------------------------------------------- */

const CAPACITY: Record<TrainCategory, number> = { ICE: 460, IC: 400, RE: 320, RB: 190 };
/** Minutes a service of this class can be held before it breaks its own path. */
const HOLD_LIMIT: Record<TrainCategory, number> = { ICE: 7, IC: 8, RE: 6, RB: 5 };

/** Deterministic 0..1 from a string, so estimates stay stable between polls. */
function hash01(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

/** Rough occupancy by time of day on a commuter-heavy main line. */
function loadFactor(minutes: number) {
  const hour = Math.floor((((minutes % 1440) + 1440) % 1440) / 60);
  if (hour >= 6 && hour < 9) return 0.86;
  if (hour >= 9 && hour < 15) return 0.54;
  if (hour >= 15 && hour < 19) return 0.9;
  if (hour >= 19 && hour < 22) return 0.6;
  return 0.28;
}

function modelLoad(seed: string, category: TrainCategory, minutes: number) {
  const jitter = 0.82 + hash01(seed) * 0.36;
  const onboard = Math.round((CAPACITY[category] * loadFactor(minutes) * jitter) / 5) * 5;
  const boarding = Math.round((onboard * (0.14 + hash01(`${seed}:board`) * 0.16)) / 5) * 5;
  return { onboard, boarding };
}

/* -------------------------------------------------------------------------- */
/* Normalised board entry                                                      */
/* -------------------------------------------------------------------------- */

interface BoardEntry {
  key: string;
  /** Service label as published, e.g. "ICE 683". */
  label: string;
  category: TrainCategory;
  origin: string;
  destination: string;
  /** Full route as station names, in running order. */
  route: string[];
  /** Stops still to come after Hannover Hbf. */
  onward: string[];
  /** Scheduled arrival at Hannover Hbf, Berlin minutes since midnight. */
  arrivalMin?: number;
  /** Scheduled departure from Hannover Hbf. */
  departureMin?: number;
  arrivalDelayMin: number;
  departureDelayMin: number;
  platform?: number;
  cancelled: boolean;
  causes: string[];
  hasRealtime: boolean;
}

/* -------------------------------------------------------------------------- */
/* Parsing helpers                                                             */
/* -------------------------------------------------------------------------- */

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const asRecord = (value: unknown): Record<string, unknown> => (isRecord(value) ? value : {});

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const asNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return undefined;
};

const asText = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  const name = asRecord(value).name;
  return typeof name === 'string' && name.trim() !== '' ? name.trim() : undefined;
};

const stationNames = (value: unknown): string[] =>
  asArray(value)
    .map((item) => asText(item))
    .filter((name): name is string => name !== undefined);

/** "18:23" → minutes since midnight, rolled forward if the board passed midnight. */
function parseBoardTime(value: unknown, boardMinutes: number): number | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return minutes < boardMinutes - 240 ? minutes + 1440 : minutes;
}

/** ISO timestamp → Berlin minutes since midnight, rolled forward past midnight. */
function parseIsoTime(value: unknown, boardMinutes: number): number | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  const minutes = berlinMinutesSinceMidnight(date);
  return minutes < boardMinutes - 240 ? minutes + 1440 : minutes;
}

/** "14 A-C" → 14. */
function parsePlatform(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
    if (typeof value !== 'string') continue;
    const match = /(\d+)/.exec(value);
    if (match) return Number(match[1]);
  }
  return undefined;
}

/** "ICE 683" / "WFB RE70" / "SBH S4" → cockpit category. */
function resolveCategory(label: string, classes: string[]): TrainCategory {
  const text = label.toUpperCase();
  if (/ICE|ECE/.test(text)) return 'ICE';
  if (/\b(IC|EC|FLX|NJ|EN|D)\b|\bIC\d|\bEC\d/.test(text)) return 'IC';
  if (/\bRE\b|RE\d/.test(text)) return 'RE';
  if (/\bRB\b|RB\d|\bS\s?\d/.test(text)) return 'RB';
  if (classes.includes('F')) return 'IC';
  return 'RE';
}

const slug = (value: string) => value.replace(/[^a-z0-9]+/gi, '').toLowerCase();

/* -------------------------------------------------------------------------- */
/* Source 1 — IRIS station board (dbf.finalrewind.org)                         */
/* -------------------------------------------------------------------------- */

function mapIrisEntry(raw: unknown, boardMinutes: number): BoardEntry | undefined {
  const item = asRecord(raw);
  const label = asText(item.train) ?? asText(item.trainNumber);
  if (!label) return undefined;

  const route = stationNames(item.route);
  const via = stationNames(item.via);
  const hannoverIndex = route.findIndex(isHannover);
  const onward = hannoverIndex >= 0 ? route.slice(hannoverIndex + 1) : via;

  const messages = asRecord(item.messages);
  const causes = asArray(messages.delay)
    .map((message) => asText(asRecord(message).text) ?? asText(message))
    .filter((text): text is string => text !== undefined);

  const arrivalMin = parseBoardTime(item.scheduledArrival, boardMinutes);
  const departureMin = parseBoardTime(item.scheduledDeparture, boardMinutes);

  return {
    key: `${slug(label)}-${arrivalMin ?? departureMin ?? 0}`,
    label,
    category: resolveCategory(
      label,
      stationNames(item.trainClasses).length > 0 ? stationNames(item.trainClasses) : [],
    ),
    origin: route[0] ?? 'Unknown',
    destination: asText(item.destination) ?? 'Hannover Hbf',
    route: hannoverIndex >= 0 ? route.slice(0, hannoverIndex) : route,
    onward,
    arrivalMin,
    departureMin,
    arrivalDelayMin: Math.max(0, asNumber(item.delayArrival) ?? 0),
    departureDelayMin: Math.max(0, asNumber(item.delayDeparture) ?? 0),
    platform: parsePlatform(item.platform, item.scheduledPlatform),
    cancelled: Boolean(asNumber(item.isCancelled)),
    causes,
    hasRealtime: !asNumber(item.missingRealtime),
  };
}

async function fetchIris(boardMinutes: number): Promise<BoardResult> {
  const payload = asRecord(await getJson(IRIS_URL));
  const list = asArray(payload.departures);
  if (list.length === 0) throw new Error('board empty');

  const entries = list
    .map((raw) => mapIrisEntry(raw, boardMinutes))
    .filter((entry): entry is BoardEntry => entry !== undefined);

  return { entries, source: SOURCE_IRIS };
}

/* -------------------------------------------------------------------------- */
/* Source 2 — db-rest v6                                                       */
/* -------------------------------------------------------------------------- */

function mapDbRestEntry(raw: unknown, boardMinutes: number, kind: 'arrival' | 'departure') {
  const item = asRecord(raw);
  const line = asRecord(item.line);
  const label = asText(line.name) ?? asText(line.id);
  if (!label) return undefined;

  const scheduled = parseIsoTime(item.plannedWhen ?? item.when, boardMinutes);
  if (scheduled === undefined) return undefined;

  const delayMin = Math.max(0, Math.round((asNumber(item.delay) ?? 0) / 60));
  const previous = stationNames(asArray(item.previousStopovers).map((stop) => asRecord(stop).stop));
  const next = stationNames(asArray(item.nextStopovers).map((stop) => asRecord(stop).stop));

  const causes = asArray(item.remarks)
    .map((remark) => asRecord(remark))
    .filter((remark) => asText(remark.type) !== 'hint')
    .map((remark) => asText(remark.text))
    .filter((text): text is string => text !== undefined);

  const entry: BoardEntry = {
    key: `${slug(label)}-${scheduled}`,
    label,
    category: resolveCategory(label, []),
    origin: asText(item.provenance) ?? previous[0] ?? 'Unknown',
    destination: asText(item.direction) ?? 'Hannover Hbf',
    route: previous,
    onward: next,
    arrivalDelayMin: kind === 'arrival' ? delayMin : 0,
    departureDelayMin: kind === 'departure' ? delayMin : 0,
    platform: parsePlatform(item.platform, item.plannedPlatform),
    cancelled: Boolean(item.cancelled),
    causes,
    hasRealtime: item.delay !== null && item.delay !== undefined,
  };

  if (kind === 'arrival') entry.arrivalMin = scheduled;
  else entry.departureMin = scheduled;
  return entry;
}

async function fetchDbRest(boardMinutes: number): Promise<BoardResult> {
  const query = `duration=${WINDOW_AHEAD_MIN}&results=60&language=en`;
  const [arrivalsPayload, departuresPayload] = await Promise.all([
    getJson(`${DB_REST_BASE}/arrivals?${query}&stopovers=true&remarks=true`),
    getJson(`${DB_REST_BASE}/departures?${query}`),
  ]);

  const arrivals = asArray(asRecord(arrivalsPayload).arrivals)
    .map((raw) => mapDbRestEntry(raw, boardMinutes, 'arrival'))
    .filter((entry): entry is BoardEntry => entry !== undefined);
  const departures = asArray(asRecord(departuresPayload).departures)
    .map((raw) => mapDbRestEntry(raw, boardMinutes, 'departure'))
    .filter((entry): entry is BoardEntry => entry !== undefined);

  if (arrivals.length === 0) throw new Error('board empty');
  return { entries: [...arrivals, ...departures], source: SOURCE_DB_REST };
}

/* -------------------------------------------------------------------------- */
/* Board → corridor model                                                      */
/* -------------------------------------------------------------------------- */

/** Where a service joins our corridor, or undefined if it comes another way. */
function corridorEntry(entry: BoardEntry) {
  if (entry.onward.some((name) => corridorPoint(name) !== undefined)) return undefined;
  if (entry.route.some((name) => OFF_CORRIDOR.test(name))) return undefined;

  for (const name of entry.route) {
    const point = corridorPoint(name);
    if (point) return point;
  }
  return undefined;
}

function buildConnections(
  feeder: BoardEntry,
  arrivalMin: number,
  onboard: number,
  pool: BoardEntry[],
): OnwardConnection[] {
  const candidates = pool
    .filter((entry) => entry.key !== feeder.key && entry.label !== feeder.label)
    .filter((entry) => entry.departureMin !== undefined && entry.platform !== undefined)
    .filter((entry) => !entry.cancelled && !isHannover(entry.destination))
    .map((entry) => ({ entry, buffer: (entry.departureMin ?? 0) - arrivalMin }))
    .filter(
      (item) => item.buffer >= MIN_TRANSFER_BUFFER_MIN && item.buffer <= MAX_TRANSFER_BUFFER_MIN,
    )
    .sort((a, b) => a.buffer - b.buffer);

  // One long-distance and one regional transfer where possible, so the
  // trade-off the agents argue over is not two versions of the same choice.
  const longDistance = candidates.find(
    (item) => item.entry.category === 'ICE' || item.entry.category === 'IC',
  );
  const regional = candidates.find(
    (item) => item.entry.category === 'RE' || item.entry.category === 'RB',
  );
  const picked = [longDistance, regional].filter(
    (item): item is { entry: BoardEntry; buffer: number } => item !== undefined,
  );
  for (const item of candidates) {
    if (picked.length >= MAX_CONNECTIONS_PER_TRAIN) break;
    if (!picked.includes(item)) picked.push(item);
  }

  return picked.slice(0, MAX_CONNECTIONS_PER_TRAIN).map(({ entry, buffer }) => {
    const seed = `${feeder.label}>${entry.label}`;
    const share = entry.category === 'ICE' || entry.category === 'IC' ? 0.16 : 0.11;
    const transferPassengers = Math.max(
      8,
      Math.round((onboard * share * (0.7 + hash01(seed) * 0.8)) / 2) * 2,
    );
    const departure = entry.departureMin ?? arrivalMin + buffer;

    return {
      id: `${feeder.key}-${entry.key}`,
      service: entry.label,
      category: entry.category,
      destination: entry.destination,
      platform: entry.platform ?? 0,
      scheduledDeparture: departure,
      transferBufferMin: buffer,
      transferPassengers,
      maxHoldMin: HOLD_LIMIT[entry.category] + Math.round(hash01(`${seed}:hold`) * 3),
      onwardPassengers: modelLoad(entry.label, entry.category, departure).onboard,
    };
  });
}

function buildSnapshot(
  entries: BoardEntry[],
  source: FeedSource,
  boardMinutes: number,
): CorridorSnapshot {
  const feeders = entries
    .filter((entry) => entry.arrivalMin !== undefined && entry.platform !== undefined)
    .filter(
      (entry) =>
        (entry.arrivalMin ?? 0) >= boardMinutes - WINDOW_BEHIND_MIN &&
        (entry.arrivalMin ?? 0) <= boardMinutes + WINDOW_AHEAD_MIN,
    )
    .map((entry) => ({ entry, point: corridorEntry(entry) }))
    .filter((item) => item.point !== undefined)
    .sort((a, b) => (a.entry.arrivalMin ?? 0) - (b.entry.arrivalMin ?? 0))
    .slice(0, MAX_TRAINS);

  const trains: Train[] = feeders.map(({ entry, point }) => {
    const arrivalMin = entry.arrivalMin ?? boardMinutes;
    const fromOffset = point?.offset ?? 0;
    const { onboard, boarding } = modelLoad(entry.label, entry.category, arrivalMin);
    // Booked run time from the corridor entry point, scaled by how much of the
    // line the service still has to cover.
    const runtime = Math.max(
      12,
      Math.round(
        (1 - fromOffset) * (entry.category === 'ICE' ? 78 : entry.category === 'IC' ? 88 : 108),
      ),
    );
    const delayMin = Math.max(entry.arrivalDelayMin, entry.departureDelayMin);

    return {
      id: entry.key,
      service: entry.label,
      category: entry.category,
      origin: point?.name ?? entry.origin,
      destination: entry.destination,
      platform: entry.platform ?? 0,
      scheduledDeparture: arrivalMin - runtime,
      scheduledArrival: arrivalMin,
      fromOffset,
      toOffset: 1,
      passengersOnboard: onboard,
      passengersBoarding: boarding,
      connections: buildConnections(entry, arrivalMin, onboard, entries),
      liveDelayMin: delayMin,
      imposedDelayMin: 0,
      delayMin,
      cancelled: entry.cancelled,
      causes: entry.causes,
      hasRealtime: entry.hasRealtime,
      status: entry.cancelled ? 'cancelled' : delayMin > 0 ? 'delayed' : 'on-time',
    };
  });

  return {
    trains,
    source,
    fetchedAt: Date.now(),
    boardMinutes,
    boardSize: entries.filter((entry) => entry.arrivalMin !== undefined).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Public entry point                                                          */
/* -------------------------------------------------------------------------- */

function describeError(source: FeedSource, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/failed to fetch|network request failed|load failed/i.test(message)) {
    return Platform.OS === 'web'
      ? `${source.label} refused the browser (blocked or offline)`
      : `${source.label} unreachable from this device`;
  }
  if (/abort/i.test(message)) return `${source.label} timed out`;
  return `${source.label}: ${message}`;
}

/** Hint appended when every source failed, tailored to where the app runs. */
const WEB_BLOCK_HINT =
  'Browsers only accept a DB host that sends CORS headers; open the app on a phone in Expo Go for the full feed.';

/**
 * Read the live Hannover Hbf board and return the corridor state.
 * The first source that yields corridor services wins.
 */
export async function fetchCorridorSnapshot(): Promise<CorridorSnapshot> {
  const boardMinutes = berlinMinutesSinceMidnight();
  const problems: string[] = [];
  let emptySnapshot: CorridorSnapshot | undefined;

  const loaders: [FeedSource, (minutes: number) => Promise<BoardResult>][] =
    Platform.OS === 'web'
      ? [
          [SOURCE_DB_REST, fetchDbRest],
          [SOURCE_IRIS, fetchIris],
        ]
      : [
          [SOURCE_IRIS, fetchIris],
          [SOURCE_DB_REST, fetchDbRest],
        ];

  for (const [candidate, load] of loaders) {
    try {
      const { entries, source } = await load(boardMinutes);
      const snapshot = buildSnapshot(entries, source, boardMinutes);
      if (snapshot.trains.length > 0) return snapshot;
      emptySnapshot ??= snapshot;
      problems.push(`${source.label}: no Hamburg corridor service on the board`);
    } catch (error) {
      problems.push(describeError(candidate, error));
    }
  }

  if (emptySnapshot) return emptySnapshot;
  const detail = problems.join(' · ');
  throw new Error(Platform.OS === 'web' ? `${detail}. ${WEB_BLOCK_HINT}` : detail);
}
