import { create } from 'zustand';

import { createIncident, describeLiveDisruption, savingsVersusBaseline } from './agents';
import { berlinSecondsSinceMidnight, type CorridorSnapshot } from './db-api';
import type { DecisionMode, Incident, Proposal, Scoreboard, Train } from './types';

const MAX_LOG_ENTRIES = 40;
/** Live delay, in minutes, that is worth waking the agents for. */
const MIN_INCIDENT_DELAY = 3;
/** A train already handled has to slip this much further to be re-raised. */
const ESCALATION_STEP = 4;

const EMPTY_SCORE: Scoreboard = {
  incidents: 0,
  autoHandled: 0,
  humanHandled: 0,
  overrides: 0,
  delayMinutesAvoided: 0,
  passengersProtected: 0,
  connectionsProtected: 0,
};

export type FeedStatus = 'idle' | 'loading' | 'live' | 'error';

export interface FeedState {
  status: FeedStatus;
  /** Which DB front end answered. */
  sourceLabel?: string;
  /** Epoch ms of the last successful read. */
  fetchedAt?: number;
  /** Services on the Hannover board before the corridor filter. */
  boardSize?: number;
  error?: string;
}

/**
 * What this session's decisions did to a train. Kept apart from the live feed
 * so a poll never wipes a controller's call, and a decision never pretends the
 * real delay changed.
 */
interface TrainOverlay {
  imposedDelayMin: number;
  reroutedTo?: number;
  note?: string;
}

/** Delay level a train was last raised at, so it is not re-raised every poll. */
interface WatchEntry {
  raisedAtDelay: number;
  cancelledRaised: boolean;
}

/** Fold session decisions back onto the live train. */
function mergeTrain(live: Train, overlay: TrainOverlay | undefined): Train {
  const imposedDelayMin = overlay?.imposedDelayMin ?? 0;
  const delayMin = live.liveDelayMin + imposedDelayMin;

  return {
    ...live,
    imposedDelayMin,
    delayMin,
    reroutedTo: overlay?.reroutedTo,
    note: overlay?.note,
    status: live.cancelled
      ? 'cancelled'
      : overlay?.reroutedTo !== undefined
        ? 'rerouted'
        : delayMin > 0
          ? 'delayed'
          : 'on-time',
  };
}

/** Write a plan's consequences into the overlays. */
function applyPlanOverlays(
  overlays: Record<string, TrainOverlay>,
  incident: Incident,
  proposal: Proposal,
): Record<string, TrainOverlay> {
  const { effects } = proposal;
  const next = { ...overlays };

  const heldNote =
    effects.heldConnections.length > 0
      ? effects.heldConnections
          .map((item) => `${item.service} held ${item.holdMin} min`)
          .join(' · ')
      : undefined;
  const brokenNote =
    effects.brokenConnections.length > 0
      ? `${effects.brokenConnections.map((item) => item.service).join(', ')} released on time`
      : undefined;
  const note = [heldNote, brokenNote].filter(Boolean).join(' · ');

  const own = next[incident.trainId] ?? { imposedDelayMin: 0 };
  next[incident.trainId] = {
    ...own,
    reroutedTo: effects.reroutePlatform ?? own.reroutedTo,
    note: note.length > 0 ? note : own.note,
  };

  for (const knock of effects.knockOn) {
    const existing = next[knock.trainId] ?? { imposedDelayMin: 0 };
    next[knock.trainId] = {
      ...existing,
      imposedDelayMin: existing.imposedDelayMin + knock.delayMin,
      note: `+${knock.delayMin} min knock-on from ${incident.trainService}`,
    };
  }

  return next;
}

interface CockpitState {
  /** Berlin wall clock, seconds since midnight. */
  nowSeconds: number;
  trains: Train[];
  overlays: Record<string, TrainOverlay>;
  watch: Record<string, WatchEntry>;
  feed: FeedState;
  /** Incident waiting for a controller decision, if any. */
  pending: Incident | null;
  /** Most recent auto-applied incident, surfaced as a passive notice. */
  lastAuto: Incident | null;
  log: Incident[];
  score: Scoreboard;
  tick: () => void;
  applyFeed: (snapshot: CorridorSnapshot) => void;
  setFeedState: (feed: FeedState) => void;
  decide: (proposalId: string) => void;
  dismissAutoNotice: () => void;
  reset: () => void;
}

function record(
  state: CockpitState,
  trains: Train[],
  incident: Incident,
  proposal: Proposal,
  mode: DecisionMode,
): Partial<CockpitState> {
  const savings = savingsVersusBaseline(incident.baseline, proposal.metrics);
  const decidedAt = Math.floor(state.nowSeconds / 60);
  const overlays = applyPlanOverlays(state.overlays, incident, proposal);

  const resolved: Incident = {
    ...incident,
    resolution: {
      chosenId: proposal.id,
      mode,
      decidedAt,
      metrics: proposal.metrics,
      ...savings,
    },
  };

  return {
    overlays,
    trains: trains.map((train) => mergeTrain(train, overlays[train.id])),
    pending: null,
    lastAuto: mode === 'auto' ? resolved : state.lastAuto,
    log: [resolved, ...state.log].slice(0, MAX_LOG_ENTRIES),
    score: {
      incidents: state.score.incidents + 1,
      autoHandled: state.score.autoHandled + (mode === 'auto' ? 1 : 0),
      humanHandled: state.score.humanHandled + (mode === 'auto' ? 0 : 1),
      overrides: state.score.overrides + (mode === 'override' ? 1 : 0),
      delayMinutesAvoided: state.score.delayMinutesAvoided + savings.delayMinutesAvoided,
      passengersProtected: state.score.passengersProtected + savings.passengersProtected,
      connectionsProtected: state.score.connectionsProtected + savings.connectionsProtected,
    },
  };
}

function trainImpactWeight(train: Train) {
  return (
    train.delayMin * (train.passengersOnboard + train.passengersBoarding) +
    (train.cancelled ? 100_000 : 0)
  );
}

/** Worst first: the delay that hurts the most people. */
function byImpact(a: Train, b: Train) {
  return trainImpactWeight(b) - trainImpactWeight(a);
}

export const useCockpitStore = create<CockpitState>((set, get) => ({
  nowSeconds: berlinSecondsSinceMidnight(),
  trains: [],
  overlays: {},
  watch: {},
  feed: { status: 'idle' },
  pending: null,
  lastAuto: null,
  log: [],
  score: EMPTY_SCORE,

  tick: () => set({ nowSeconds: berlinSecondsSinceMidnight() }),

  setFeedState: (feed) => set({ feed }),

  /**
   * Fold a live board reading into the cockpit: refresh every train, then
   * raise an incident for the worst newly reported delay. Minor ones are
   * applied straight away, bigger ones wait for the controller.
   */
  applyFeed: (snapshot) => {
    const state = get();
    const nowMinutes = Math.floor(state.nowSeconds / 60);
    const trains = snapshot.trains.map((train) => mergeTrain(train, state.overlays[train.id]));
    const liveIds = new Set(trains.map((train) => train.id));

    const watch: Record<string, WatchEntry> = {};
    for (const [id, entry] of Object.entries(state.watch)) {
      if (liveIds.has(id)) watch[id] = entry;
    }
    const overlays: Record<string, TrainOverlay> = {};
    for (const [id, overlay] of Object.entries(state.overlays)) {
      if (liveIds.has(id)) overlays[id] = overlay;
    }

    // A train that recovered can raise a fresh incident if it slips again.
    for (const train of trains) {
      if (!train.cancelled && train.liveDelayMin < MIN_INCIDENT_DELAY) delete watch[train.id];
    }

    const feed: FeedState = {
      status: 'live',
      sourceLabel: snapshot.source.label,
      fetchedAt: snapshot.fetchedAt,
      boardSize: snapshot.boardSize,
    };

    const candidates = trains
      .filter((train) => {
        const seen = watch[train.id];
        if (train.cancelled) return !seen?.cancelledRaised;
        if (train.liveDelayMin < MIN_INCIDENT_DELAY) return false;
        if (!seen) return true;
        return train.liveDelayMin >= seen.raisedAtDelay + ESCALATION_STEP;
      })
      .sort(byImpact);

    const worst = candidates[0];
    if (state.pending !== null || worst === undefined) {
      set({ trains, overlays, watch, feed });
      return;
    }

    watch[worst.id] = { raisedAtDelay: worst.liveDelayMin, cancelledRaised: worst.cancelled };
    const incident = createIncident(trains, describeLiveDisruption(worst, nowMinutes), nowMinutes);

    if (incident.severity === 'minor') {
      const recommended =
        incident.proposals.find((proposal) => proposal.id === incident.recommendedId) ??
        incident.proposals[0];
      set({
        ...record({ ...state, overlays }, trains, incident, recommended, 'auto'),
        watch,
        feed,
      });
      return;
    }

    set({ trains, overlays, watch, feed, pending: incident });
  },

  decide: (proposalId) => {
    const state = get();
    const incident = state.pending;
    if (!incident) return;

    const proposal =
      incident.proposals.find((item) => item.id === proposalId) ?? incident.proposals[0];
    const mode: DecisionMode = proposal.id === incident.recommendedId ? 'accepted' : 'override';
    set(record(state, state.trains, incident, proposal, mode));
  },

  dismissAutoNotice: () => set({ lastAuto: null }),

  /** Clear the session record. The live corridor state stays as it is. */
  reset: () =>
    set((state) => ({
      overlays: {},
      watch: {},
      trains: state.trains.map((train) => mergeTrain(train, undefined)),
      pending: null,
      lastAuto: null,
      log: [],
      score: EMPTY_SCORE,
    })),
}));

/** Drive the corridor clock from a single mounted component. */
export function startCorridorClock() {
  useCockpitStore.getState().tick();
  const interval = setInterval(() => {
    useCockpitStore.getState().tick();
  }, 1000);
  return () => clearInterval(interval);
}
