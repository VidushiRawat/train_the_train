import { create } from 'zustand';

import { createIncident, drawDisruption, savingsVersusBaseline } from './agents';
import { INITIAL_TRAINS, SESSION_START_MINUTES } from './data';
import type { DecisionMode, Incident, Proposal, Scoreboard, Train } from './types';

const MAX_LOG_ENTRIES = 40;

const EMPTY_SCORE: Scoreboard = {
  incidents: 0,
  autoHandled: 0,
  humanHandled: 0,
  overrides: 0,
  delayMinutesAvoided: 0,
  passengersProtected: 0,
  connectionsProtected: 0,
};

/** Deep-ish clone so the seeded corridor is never mutated between sessions. */
function seedTrains(): Train[] {
  return INITIAL_TRAINS.map((train) => ({ ...train, delayMin: 0, status: 'on-time' as const }));
}

/** Write a plan's consequences back into the digital twin. */
function applyPlan(trains: Train[], incident: Incident, proposal: Proposal): Train[] {
  const { effects } = proposal;
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

  return trains.map((train) => {
    if (train.id === incident.trainId) {
      const note = [heldNote, brokenNote].filter(Boolean).join(' · ');
      return {
        ...train,
        delayMin: Math.max(train.delayMin, effects.primaryDelayMin),
        reroutedTo: effects.reroutePlatform ?? train.reroutedTo,
        status: effects.reroutePlatform
          ? ('rerouted' as const)
          : effects.primaryDelayMin > 0
            ? ('delayed' as const)
            : train.status,
        note: note.length > 0 ? note : undefined,
      };
    }

    const knock = effects.knockOn.find((item) => item.trainId === train.id);
    if (knock) {
      const delayMin = train.delayMin + knock.delayMin;
      return {
        ...train,
        delayMin,
        status: delayMin > 0 ? ('delayed' as const) : train.status,
        note: `+${knock.delayMin} min knock-on from ${incident.trainService}`,
      };
    }

    return train;
  });
}

interface CockpitState {
  /** Live corridor clock, seconds since midnight. */
  nowSeconds: number;
  trains: Train[];
  /** Incident waiting for a controller decision, if any. */
  pending: Incident | null;
  /** Most recent auto-applied incident, surfaced as a passive notice. */
  lastAuto: Incident | null;
  log: Incident[];
  score: Scoreboard;
  tick: () => void;
  triggerDisruption: () => void;
  decide: (proposalId: string) => void;
  dismissAutoNotice: () => void;
  reset: () => void;
}

function record(
  state: CockpitState,
  incident: Incident,
  proposal: Proposal,
  mode: DecisionMode,
): Partial<CockpitState> {
  const savings = savingsVersusBaseline(incident.baseline, proposal.metrics);
  const decidedAt = Math.floor(state.nowSeconds / 60);

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
    trains: applyPlan(state.trains, incident, proposal),
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

export const useCockpitStore = create<CockpitState>((set, get) => ({
  nowSeconds: SESSION_START_MINUTES * 60,
  trains: seedTrains(),
  pending: null,
  lastAuto: null,
  log: [],
  score: EMPTY_SCORE,

  tick: () => set((state) => ({ nowSeconds: state.nowSeconds + 1 })),

  triggerDisruption: () => {
    const state = get();
    if (state.pending) return;

    const nowMinutes = Math.floor(state.nowSeconds / 60);
    const drawn = drawDisruption(state.trains, nowMinutes);
    const incident = createIncident(state.trains, drawn, nowMinutes);

    if (incident.severity === 'minor') {
      const recommended =
        incident.proposals.find((proposal) => proposal.id === incident.recommendedId) ??
        incident.proposals[0];
      set(record(state, incident, recommended, 'auto'));
      return;
    }

    set({ pending: incident });
  },

  decide: (proposalId) => {
    const state = get();
    const incident = state.pending;
    if (!incident) return;

    const proposal =
      incident.proposals.find((item) => item.id === proposalId) ?? incident.proposals[0];
    const mode: DecisionMode = proposal.id === incident.recommendedId ? 'accepted' : 'override';
    set(record(state, incident, proposal, mode));
  },

  dismissAutoNotice: () => set({ lastAuto: null }),

  reset: () =>
    set({
      nowSeconds: SESSION_START_MINUTES * 60,
      trains: seedTrains(),
      pending: null,
      lastAuto: null,
      log: [],
      score: EMPTY_SCORE,
    }),
}));

/** Drive the corridor clock from a single mounted component. */
export function startCorridorClock() {
  const interval = setInterval(() => {
    useCockpitStore.getState().tick();
  }, 1000);
  return () => clearInterval(interval);
}
