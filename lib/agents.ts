import { HAMBURG_HBF, SPARE_PLATFORMS } from './data';
import { translateCause } from './db-api';
import type {
  BrokenConnection,
  Disruption,
  HeldConnection,
  ImpactMetrics,
  Incident,
  KnockOnEffect,
  OnwardConnection,
  PlanEffects,
  Proposal,
  Severity,
  Train,
} from './types';
import { formatCount, formatTimeOfDay } from './utils';

/**
 * Decision engine behind the cockpit.
 *
 * Live DB corridor state -> two competing agents -> orchestrator:
 *  - Agent A (network) minimises total delay minutes across the corridor.
 *  - Agent B (passenger) minimises broken journeys and missed connections.
 *  - The orchestrator scores both options and gates the result: minor
 *    incidents are applied automatically, bigger ones wait
 *    for the dispatcher.
 *
 * Delays, platforms and causes come from the live feed; the plans and their
 * impact are a deterministic model, not ML.
 */

/** Minutes a train can realistically claw back before Hamburg Hbf. */
const RECOVERY_MIN = 2;
/** Minutes a passenger needs on the platform for a transfer to hold up. */
const MIN_TRANSFER_MIN = 2;
/** Extra walking time when the feeder is re-platformed. */
const REPLATFORM_WALK_MIN = 1;
/** Arrival window, in minutes, where two trains fight for the same paths. */
const CONFLICT_WINDOW_MIN = 6;
/** A train delayed this much counts as disrupting the people on board. */
const STRANDED_DELAY_MIN = 8;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Delay that actually lands at Hamburg Hbf after recovery running. */
function effectiveDelay(rawDelayMin: number) {
  return Math.max(0, rawDelayMin - RECOVERY_MIN);
}

/** Other corridor services fighting for the same arrival window. */
function findKnockOn(trains: Train[], train: Train, delayMin: number): KnockOnEffect[] {
  if (delayMin <= 5) return [];
  const newArrival = train.scheduledArrival + delayMin;
  const knockDelay = clamp(Math.round((delayMin - 4) / 2), 1, 7);

  return trains
    .filter((other) => other.id !== train.id)
    .filter(
      (other) =>
        Math.abs(other.scheduledArrival + other.delayMin - newArrival) <= CONFLICT_WINDOW_MIN,
    )
    .map((other) => ({ trainId: other.id, service: other.service, delayMin: knockDelay }));
}

/** Minutes an onward service must wait so the transfer still works. */
function requiredHold(connection: OnwardConnection, delayAtHamburg: number, walk: number) {
  return Math.max(0, delayAtHamburg + walk + MIN_TRANSFER_MIN - connection.transferBufferMin);
}

/** Extra delay a hold costs: the held train plus its own downstream path. */
function holdCost(holdMin: number) {
  return holdMin + Math.round(holdMin / 2);
}

function connectionAtRisk(connection: OnwardConnection, delayAtHamburg: number, walk: number) {
  return requiredHold(connection, delayAtHamburg, walk) > 0;
}

interface PlanInput {
  train: Train;
  delayMin: number;
  replatform: boolean;
  /** Connections the plan protects by holding the onward service. */
  holdIds: string[];
  knockOn: KnockOnEffect[];
  sparePlatform?: number;
}

interface Plan {
  effects: PlanEffects;
  metrics: ImpactMetrics;
}

/** Turn a plan intent into concrete effects plus its 60-minute impact. */
function buildPlan({
  train,
  delayMin,
  replatform,
  holdIds,
  knockOn,
  sparePlatform,
}: PlanInput): Plan {
  const arrivalDelay = effectiveDelay(delayMin);
  const walk = replatform ? REPLATFORM_WALK_MIN : 0;
  const appliedKnockOn = replatform ? [] : knockOn;

  const held: HeldConnection[] = [];
  const broken: BrokenConnection[] = [];

  for (const connection of train.connections) {
    const needed = requiredHold(connection, arrivalDelay, walk);
    if (needed === 0) continue;

    const wanted = holdIds.includes(connection.id);
    if (wanted && needed <= connection.maxHoldMin) {
      held.push({
        connectionId: connection.id,
        service: connection.service,
        platform: connection.platform,
        holdMin: needed,
        transferPassengers: connection.transferPassengers,
      });
    } else {
      broken.push({
        connectionId: connection.id,
        service: connection.service,
        platform: connection.platform,
        transferPassengers: connection.transferPassengers,
      });
    }
  }

  const knockOnDelay = sum(appliedKnockOn.map((item) => item.delayMin));
  const holdDelay = sum(held.map((item) => holdCost(item.holdMin)));

  const strandedOnboard = arrivalDelay >= STRANDED_DELAY_MIN ? train.passengersOnboard : 0;
  const missedTransferPax = sum(broken.map((item) => item.transferPassengers));

  return {
    effects: {
      primaryDelayMin: arrivalDelay,
      reroutePlatform: replatform ? sparePlatform : undefined,
      knockOn: appliedKnockOn,
      heldConnections: held,
      brokenConnections: broken,
    },
    metrics: {
      networkDelayMin: arrivalDelay + knockOnDelay + holdDelay,
      trainsAffected: 1 + appliedKnockOn.length + held.length,
      missedConnections: broken.length,
      passengersDisrupted: missedTransferPax + strandedOnboard,
    },
  };
}

/**
 * Orchestrator cost function. One missed connection is treated as roughly eight
 * minutes of network delay, and every disrupted passenger adds a little more,
 * so a plan that protects people can outweigh a slightly faster one.
 */
export function planScore(metrics: ImpactMetrics) {
  return (
    metrics.networkDelayMin + metrics.missedConnections * 8 + metrics.passengersDisrupted * 0.12
  );
}

function describeHolds(held: HeldConnection[]) {
  return held
    .map((item) => `hold ${item.service} at platform ${item.platform} for ${item.holdMin} min`)
    .join(', ');
}

function pickSparePlatform(trains: Train[]) {
  const taken = new Set(trains.map((other) => other.reroutedTo ?? other.platform));
  return SPARE_PLATFORMS.find((platform) => !taken.has(platform));
}

interface Evaluation {
  proposals: Proposal[];
  baseline: ImpactMetrics;
  recommendedId: string;
  rationale: string;
  confidence: number;
  severity: Severity;
  gateReason: string;
}

/** Run both agents and the orchestrator over one disruption. */
export function evaluate(trains: Train[], train: Train, delayMin: number): Evaluation {
  const arrivalDelay = effectiveDelay(delayMin);
  const knockOn = findKnockOn(trains, train, delayMin);
  const sparePlatform = pickSparePlatform(trains);
  const canReplatform = knockOn.length > 0 && sparePlatform !== undefined;

  const atRisk = train.connections.filter((connection) =>
    connectionAtRisk(connection, arrivalDelay, 0),
  );
  const savable = atRisk.filter(
    (connection) => requiredHold(connection, arrivalDelay, 0) <= connection.maxHoldMin,
  );

  const doNothing = buildPlan({ train, delayMin, replatform: false, holdIds: [], knockOn });

  // Agent A — network flow. Never holds an onward service; re-platforms when
  // that removes a path conflict.
  const planA = buildPlan({
    train,
    delayMin,
    replatform: canReplatform,
    holdIds: [],
    knockOn,
    sparePlatform,
  });

  const proposalA: Proposal = {
    id: 'A',
    author: 'network',
    title: canReplatform
      ? `Re-platform ${train.service} to platform ${sparePlatform} and let it run late`
      : `Let ${train.service} run late, hold nothing at Hamburg`,
    actions: canReplatform
      ? [
          `Route ${train.service} into platform ${sparePlatform} instead of ${train.platform}`,
          `Release the platform ${train.platform} path for ${knockOn.map((item) => item.service).join(' and ')}`,
          'Let every onward service depart on its booked time',
        ]
      : [
          `Keep ${train.service} on platform ${train.platform}, accept +${arrivalDelay} min`,
          'Let every onward service depart on its booked time',
          'Re-time the following paths behind it',
        ],
    reason: canReplatform
      ? `Freeing platform ${train.platform} stops the delay spreading to ${formatCount(knockOn.length, 'other service')}. Nothing else on the corridor loses a minute.`
      : `The corridor absorbs ${arrivalDelay} min best if nothing waits. Every held train would add its own delay on top.`,
    tradeoff:
      planA.effects.brokenConnections.length > 0
        ? `${formatCount(planA.effects.brokenConnections.length, 'connection')} at Hamburg breaks — ${sum(planA.effects.brokenConnections.map((item) => item.transferPassengers))} passengers rebook.`
        : 'No connection is at risk with this delay, so nothing is lost.',
    metrics: planA.metrics,
    effects: planA.effects,
  };

  // Agent B — passenger impact. Holds every transfer it can, keeps the booked
  // platform so boarding passengers are not sent across the station.
  const planB = buildPlan({
    train,
    delayMin,
    replatform: false,
    holdIds: savable.map((connection) => connection.id),
    knockOn,
  });

  const heldB = planB.effects.heldConnections;
  const proposalB: Proposal = {
    id: 'B',
    author: 'passenger',
    title:
      heldB.length > 0
        ? `Hold ${heldB.map((item) => `${item.service} at platform ${item.platform}`).join(' and ')} for ${Math.max(...heldB.map((item) => item.holdMin))} min`
        : `Keep ${train.service} on platform ${train.platform} and absorb the delay`,
    actions:
      heldB.length > 0
        ? [
            `Keep ${train.service} on its booked platform ${train.platform}`,
            ...heldB.map(
              (item) =>
                `Hold ${item.service} at platform ${item.platform} for ${item.holdMin} min — ${item.transferPassengers} passengers transferring`,
            ),
            'Announce the guaranteed connection before Celle',
          ]
        : [
            `Keep ${train.service} on platform ${train.platform}`,
            `Protect the ${train.passengersBoarding} passengers boarding there`,
            'Recover time in the dwell at the next stop',
          ],
    reason:
      heldB.length > 0
        ? `${sum(heldB.map((item) => item.transferPassengers))} passengers keep their onward journey. A short hold costs minutes; a broken connection costs people an hour or more.`
        : `No transfer is at risk, so the booked platform is the calm option — ${train.passengersBoarding} boarding passengers are not sent across the station.`,
    tradeoff:
      heldB.length > 0
        ? `${describeHolds(heldB)} — that delay lands on ${formatCount(heldB.length, 'onward service')} and the people already on board.`
        : `The corridor still carries ${planB.metrics.networkDelayMin} delay minutes, including the knock-on behind it.`,
    metrics: planB.metrics,
    effects: planB.effects,
  };

  const proposals: Proposal[] = [proposalA, proposalB];

  const ranked = [...proposals].sort((a, b) => {
    const delta = planScore(a.metrics) - planScore(b.metrics);
    if (delta !== 0) return delta;
    return a.metrics.missedConnections - b.metrics.missedConnections;
  });

  const best = ranked[0];
  const runnerUp = ranked[1];
  const margin = runnerUp ? planScore(runnerUp.metrics) - planScore(best.metrics) : 0;
  const confidence = clamp(0.58 + margin / 40, 0.58, 0.94);

  const authorLabel: Record<Proposal['author'], string> = {
    network: 'the network agent',
    passenger: 'the passenger agent',
    arbiter: 'the orchestrator',
  };

  const rationale =
    `Option ${best.id} from ${authorLabel[best.author]} carries ${best.metrics.networkDelayMin} delay minutes, ` +
    `${formatCount(best.metrics.missedConnections, 'broken connection')} and ${best.metrics.passengersDisrupted} disrupted passengers. ` +
    (runnerUp
      ? `Option ${runnerUp.id} scores ${margin.toFixed(0)} points worse, mainly on ` +
        (runnerUp.metrics.missedConnections > best.metrics.missedConnections
          ? 'passenger impact.'
          : 'delay minutes.')
      : 'No competing plan came close.');

  const severity = resolveSeverity(train, arrivalDelay, doNothing.metrics, knockOn.length);

  return {
    proposals,
    baseline: doNothing.metrics,
    recommendedId: best.id,
    rationale,
    confidence,
    severity: severity.severity,
    gateReason: severity.reason,
  };
}

function resolveSeverity(
  train: Train,
  arrivalDelay: number,
  baseline: ImpactMetrics,
  knockOnCount: number,
): { severity: Severity; reason: string } {
  if (train.cancelled) {
    return {
      severity: 'major',
      reason: `${train.service} is cancelled in the live feed — a dispatcher decides how its passengers travel on.`,
    };
  }
  if (baseline.missedConnections > 0) {
    return {
      severity: 'major',
      reason: `${formatCount(baseline.missedConnections, 'connection')} at Hamburg Hbf is at risk — a dispatcher signs this off.`,
    };
  }
  if (arrivalDelay >= 8) {
    return {
      severity: 'major',
      reason: `${arrivalDelay} min at Hamburg is above the 8 min auto-apply limit.`,
    };
  }
  if (knockOnCount >= 2) {
    return {
      severity: 'major',
      reason: `${formatCount(knockOnCount, 'other service')} shares the arrival window — the plan moves more than one train.`,
    };
  }
  if (train.passengersOnboard + train.passengersBoarding >= 350 && arrivalDelay >= 5) {
    return {
      severity: 'major',
      reason: `${train.passengersOnboard + train.passengersBoarding} passengers are affected on a single service.`,
    };
  }
  return {
    severity: 'minor',
    reason: `${arrivalDelay} min, no connection at risk — applied automatically.`,
  };
}

/** Impact avoided by a plan compared with taking no action. */
export function savingsVersusBaseline(baseline: ImpactMetrics, chosen: ImpactMetrics) {
  return {
    delayMinutesAvoided: Math.max(0, baseline.networkDelayMin - chosen.networkDelayMin),
    passengersProtected: Math.max(0, baseline.passengersDisrupted - chosen.passengersDisrupted),
    connectionsProtected: Math.max(0, baseline.missedConnections - chosen.missedConnections),
  };
}

export interface DetectedDisruption {
  train: Train;
  disruption: Disruption;
  delayMin: number;
}

/**
 * Turn what the Hamburg Hbf board says about one train into a disruption record.
 */
export function describeLiveDisruption(train: Train, _nowMinutes: number): DetectedDisruption {
  const station = HAMBURG_HBF.name;
  const cause = train.causes[0];

  if (train.cancelled) {
    return {
      train,
      disruption: {
        id: `${train.id}-cancelled`,
        label: 'Service cancelled',
        station,
        detail: cause
          ? translateCause(cause).detail
          : `DB has cancelled ${train.service} into Hamburg Hbf. Everyone booked on it needs the next path.`,
      },
      delayMin: Math.max(train.delayMin, 20),
    };
  }

  if (cause) {
    const translated = translateCause(cause);
    return {
      train,
      disruption: {
        id: `${train.id}-${train.liveDelayMin}`,
        label: translated.label,
        station,
        detail: translated.detail,
      },
      delayMin: train.delayMin,
    };
  }

  return {
    train,
    disruption: {
      id: `${train.id}-${train.liveDelayMin}`,
      label: 'Running late',
      station,
      detail: `The feed has ${train.service} ${train.liveDelayMin} min down near ${station} with no cause published yet.`,
    },
    delayMin: train.delayMin,
  };
}

/** Build the incident record the cockpit shows and logs. */
export function createIncident(
  trains: Train[],
  detected: DetectedDisruption,
  detectedAt: number,
): Incident {
  const { train, disruption, delayMin } = detected;
  const evaluation = evaluate(trains, train, delayMin);

  return {
    id: `inc-${detectedAt}-${train.id}`,
    detectedAt,
    trainId: train.id,
    trainService: train.service,
    trainCategory: train.category,
    platform: train.reroutedTo ?? train.platform,
    disruption,
    delayMin,
    severity: evaluation.severity,
    baseline: evaluation.baseline,
    proposals: evaluation.proposals,
    recommendedId: evaluation.recommendedId,
    rationale: evaluation.rationale,
    confidence: evaluation.confidence,
    gateReason: evaluation.gateReason,
  };
}

export type TrainStage = 'not-started' | 'en-route' | 'arrived';

/** Where a train sits on the corridor right now, as a 0..1 offset. */
export function trainPosition(train: Train, nowMinutes: number) {
  const runtime = train.scheduledArrival + train.delayMin - train.scheduledDeparture;
  const elapsed = nowMinutes - train.scheduledDeparture;
  const progress = runtime > 0 ? clamp(elapsed / runtime, 0, 1) : 0;
  const offset = train.fromOffset + (train.toOffset - train.fromOffset) * progress;
  const stage: TrainStage = elapsed <= 0 ? 'not-started' : progress >= 1 ? 'arrived' : 'en-route';

  return { offset, progress, stage };
}

/** Transfers this train would break if its current delay stands. */
export function connectionsAtRisk(train: Train) {
  const arrivalDelay = effectiveDelay(train.delayMin);
  return train.connections.filter((connection) =>
    connectionAtRisk(connection, arrivalDelay, train.reroutedTo ? REPLATFORM_WALK_MIN : 0),
  );
}

/** "17:24 → 17:38" style arrival label for the corridor view. */
export function arrivalLabel(train: Train) {
  const scheduled = formatTimeOfDay(train.scheduledArrival);
  if (train.delayMin <= 0) return scheduled;
  return `${scheduled} → ${formatTimeOfDay(train.scheduledArrival + train.delayMin)}`;
}
