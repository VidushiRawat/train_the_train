/**
 * Domain model for the Train2Train dispatcher cockpit.
 *
 * All clock values are stored as minutes since midnight (local corridor time)
 * so arithmetic on schedules, delays and transfer buffers stays trivial.
 */

export type TrainCategory = 'ICE' | 'IC' | 'RE' | 'RB';

export type TrainStatus = 'on-time' | 'delayed' | 'held' | 'rerouted' | 'cancelled';

/** Station on the Hamburg – Hannover corridor. */
export interface CorridorStation {
  id: string;
  name: string;
  short: string;
  /** 0 = Hamburg Hbf, 1 = Hannover Hbf. */
  offset: number;
}

/** Onward service a train feeds at the monitored station. */
export interface OnwardConnection {
  id: string;
  service: string;
  category: TrainCategory;
  destination: string;
  /** Departure platform at the monitored station. */
  platform: number;
  /** Minutes since midnight. */
  scheduledDeparture: number;
  /** Planned minutes between feeder arrival and this departure. */
  transferBufferMin: number;
  /** Passengers booked onto this transfer. */
  transferPassengers: number;
  /** Minutes this service can be held before it breaks its own path. */
  maxHoldMin: number;
  /** Passengers already on board the onward service (they pay for a hold). */
  onwardPassengers: number;
}

export interface Train {
  id: string;
  service: string;
  category: TrainCategory;
  origin: string;
  destination: string;
  /** Booked platform at the monitored station. */
  platform: number;
  /** Minutes since midnight, departure from its origin on the corridor. */
  scheduledDeparture: number;
  /** Minutes since midnight, booked time at the monitored station. */
  scheduledArrival: number;
  /** Corridor offset of the origin, 0..1. */
  fromOffset: number;
  /** Corridor offset of the destination or corridor exit, 0..1. */
  toOffset: number;
  passengersOnboard: number;
  /** Passengers boarding at the next corridor stop. */
  passengersBoarding: number;
  connections: OnwardConnection[];
  /** Delay reported by the live DB feed, minutes. */
  liveDelayMin: number;
  /** Extra delay this session's own decisions put on the train. */
  imposedDelayMin: number;
  /** liveDelayMin + imposedDelayMin — what the cockpit plans against. */
  delayMin: number;
  /** Cancelled in the live feed. */
  cancelled: boolean;
  /** Delay causes as published by DB, in the original German. */
  causes: string[];
  /** False when the feed only has the timetable, no realtime data yet. */
  hasRealtime: boolean;
  status: TrainStatus;
  /** Set when a dispatcher decision moved the train off its booked platform. */
  reroutedTo?: number;
  /** Short note rendered on the corridor view after a decision. */
  note?: string;
}

export interface Disruption {
  id: string;
  label: string;
  station: string;
  detail: string;
}

/** Impact of a candidate plan, always measured over the next 60 minutes. */
export interface ImpactMetrics {
  /** Total delay minutes across every affected service. */
  networkDelayMin: number;
  trainsAffected: number;
  missedConnections: number;
  passengersDisrupted: number;
}

export type ProposalAuthor = 'network' | 'passenger' | 'arbiter';

export interface HeldConnection {
  connectionId: string;
  service: string;
  platform: number;
  holdMin: number;
  transferPassengers: number;
}

export interface BrokenConnection {
  connectionId: string;
  service: string;
  platform: number;
  transferPassengers: number;
}

export interface KnockOnEffect {
  trainId: string;
  service: string;
  delayMin: number;
}

/** Machine-readable consequences of a plan, applied to the twin on decision. */
export interface PlanEffects {
  primaryDelayMin: number;
  /** Set when the plan re-platforms the delayed train at the monitored station. */
  reroutePlatform?: number;
  knockOn: KnockOnEffect[];
  heldConnections: HeldConnection[];
  brokenConnections: BrokenConnection[];
}

export interface Proposal {
  /** Stable option letter: A = network, B = passenger. */
  id: string;
  author: ProposalAuthor;
  /** One-line action, e.g. "Hold ICE 692 at platform 12 for 6 min". */
  title: string;
  /** Concrete dispatcher steps. */
  actions: string[];
  /** Plain-English reason the agent argues for this plan. */
  reason: string;
  /** What this plan costs, in plain English. */
  tradeoff: string;
  metrics: ImpactMetrics;
  effects: PlanEffects;
}

export type Severity = 'minor' | 'major';

export type DecisionMode = 'auto' | 'accepted' | 'override';

export interface Resolution {
  chosenId: string;
  mode: DecisionMode;
  /** Minutes since midnight when the call was made. */
  decidedAt: number;
  metrics: ImpactMetrics;
  /** Delay minutes saved versus taking no action. */
  delayMinutesAvoided: number;
  /** Passengers kept on plan versus taking no action. */
  passengersProtected: number;
  /** Connections kept versus taking no action. */
  connectionsProtected: number;
}

export interface Incident {
  id: string;
  /** Minutes since midnight when the disruption was detected. */
  detectedAt: number;
  trainId: string;
  trainService: string;
  trainCategory: TrainCategory;
  platform: number;
  disruption: Disruption;
  delayMin: number;
  severity: Severity;
  /** Metrics if the dispatcher does nothing. */
  baseline: ImpactMetrics;
  proposals: Proposal[];
  recommendedId: string;
  /** Why the orchestrator landed on the recommendation. */
  rationale: string;
  /** Orchestrator confidence, 0..1. */
  confidence: number;
  /** Why the incident was gated to a human, when it was. */
  gateReason: string;
  resolution?: Resolution;
}

export interface Scoreboard {
  incidents: number;
  autoHandled: number;
  humanHandled: number;
  overrides: number;
  delayMinutesAvoided: number;
  passengersProtected: number;
  connectionsProtected: number;
}
