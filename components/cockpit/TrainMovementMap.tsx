import { AnimatedView } from '@/components/ui/primitives/AnimatedView';
import { fetchHamburgPlatformAssignments, type HamburgPlatformAssignment } from '@/lib/db-api';
import { useThemeColor } from 'heroui-native';
import { useQuery } from '@tanstack/react-query';
import { TrainFront } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Typography } from 'heroui-native';

import { Panel } from './Panel';

const MINUTES_PER_DAY = 24 * 60;
const TRAIN_MARKER_WIDTH = 94;
const ACTIVE_WINDOW_BEHIND_MIN = 8;
const ACTIVE_WINDOW_AHEAD_MIN = 25;

const MOVEMENT_COPY = {
  approaching: { label: 'Entering', tone: 'text-info', dot: 'bg-info' },
  platform: { label: 'At platform', tone: 'text-success', dot: 'bg-success' },
  departed: { label: 'Exiting', tone: 'text-muted', dot: 'bg-muted' },
  cancelled: { label: 'Cancelled', tone: 'text-danger', dot: 'bg-danger' },
} as const;

const MOVEMENTS = ['approaching', 'platform', 'departed', 'cancelled'] as const;

type Movement = (typeof MOVEMENTS)[number];

interface StationTrain extends HamburgPlatformAssignment {
  movement: Movement;
  untilDeparture: number;
}

interface TrainMovementMapProps {
  nowSeconds: number;
}

function signedMinuteDifference(target: number, now: number) {
  let difference = target - now;
  if (difference < -MINUTES_PER_DAY / 2) difference += MINUTES_PER_DAY;
  if (difference > MINUTES_PER_DAY / 2) difference -= MINUTES_PER_DAY;
  return difference;
}

function movementFor(train: HamburgPlatformAssignment, nowMinutes: number): Movement {
  if (train.cancelled) return 'cancelled';
  const untilDeparture = signedMinuteDifference(
    train.scheduledDeparture + train.delayMin,
    nowMinutes,
  );
  if (untilDeparture > 4) return 'approaching';
  if (untilDeparture >= -2) return 'platform';
  return 'departed';
}

function clockTime(minutes: number) {
  const normalized = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(normalized / 60);
  return `${String(hours).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function positionFactor(train: StationTrain) {
  if (train.movement === 'cancelled') return 0.5;
  if (train.movement === 'approaching') {
    const approachProgress = clamp((18 - train.untilDeparture) / 14, 0, 1);
    return 0.04 + approachProgress * 0.4;
  }
  if (train.movement === 'platform') return 0.5;
  const exitProgress = clamp((-train.untilDeparture - 2) / 6, 0, 1);
  return 0.62 + exitProgress * 0.34;
}

function movementTiming(train: StationTrain) {
  if (train.movement === 'cancelled') return 'Service cancelled';
  if (train.movement === 'platform') return 'Ready at platform';
  if (train.movement === 'departed') return 'Leaving station';
  const minutes = Math.max(1, Math.ceil(train.untilDeparture));
  return `${minutes} min to departure`;
}

function TrackTrain({ train }: { train: StationTrain }) {
  const [laneWidth, setLaneWidth] = useState(0);
  const foreground = useThemeColor('foreground');
  const position = useSharedValue(0);
  const availableTravel = Math.max(0, laneWidth - TRAIN_MARKER_WIDTH);
  const targetPosition = availableTravel * positionFactor(train);

  useEffect(() => {
    position.set(withTiming(targetPosition, { duration: 900 }));
  }, [position, targetPosition]);

  const animatedMarkerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: position.value }],
  }));

  const handleLaneLayout = (event: LayoutChangeEvent) => {
    setLaneWidth(event.nativeEvent.layout.width);
  };

  const movementCopy = MOVEMENT_COPY[train.movement];
  const delayedDeparture = train.scheduledDeparture + train.delayMin;

  return (
    <View className="border-separator bg-surface-secondary gap-2 rounded-xl border p-2.5">
      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <View className="bg-accent-soft min-w-11 rounded-md px-2 py-1">
          <Typography type="body-xs" className="text-accent text-center font-bold">
            {train.platform > 0 ? `P${train.platform}` : 'P—'}
          </Typography>
        </View>
        <Typography type="body-sm" className="text-foreground font-semibold">
          {train.service}
        </Typography>
        <Typography type="body-xs" className="text-muted min-w-0 flex-1">
          to {train.destination}
        </Typography>
        <View className="flex-row items-center gap-1.5">
          <View className={`size-2 rounded-full ${movementCopy.dot}`} />
          <Typography type="body-xs" className={`font-semibold ${movementCopy.tone}`}>
            {movementCopy.label}
          </Typography>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <Typography type="body-xs" className="text-muted w-5 text-center">
          IN
        </Typography>
        <View className="relative h-9 min-w-0 flex-1 justify-center" onLayout={handleLaneLayout}>
          <View className="bg-rail-muted absolute inset-x-0 top-3.5 h-px" />
          <View className="bg-rail-muted absolute inset-x-0 top-5 h-px" />
          <View className="bg-accent/35 absolute top-1 left-1/2 h-7 w-1 rounded-full" />
          <AnimatedView
            style={[animatedMarkerStyle, { width: TRAIN_MARKER_WIDTH }]}
            className={`absolute top-0 left-0 h-8 flex-row items-center justify-center gap-1 rounded-lg border px-2 ${
              train.movement === 'cancelled'
                ? 'border-danger/40 bg-danger-soft opacity-70'
                : train.movement === 'platform'
                  ? 'border-success/50 bg-success-soft'
                  : 'border-accent/45 bg-accent-soft'
            }`}
          >
            <TrainFront size={14} color={foreground} strokeWidth={2.2} />
            <Typography type="body-xs" className="text-foreground font-bold">
              {train.service}
            </Typography>
          </AnimatedView>
        </View>
        <Typography type="body-xs" className="text-muted w-7 text-center">
          OUT
        </Typography>
      </View>

      <View className="flex-row flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Typography type="body-xs" className="text-muted">
          {movementTiming(train)}
        </Typography>
        <Typography type="body-xs" className="text-foreground font-semibold">
          {clockTime(delayedDeparture)}
          {train.delayMin > 0 ? `  +${train.delayMin} min` : ''}
        </Typography>
      </View>
    </View>
  );
}

function CurrentImpactSummary({ trains }: { trains: StationTrain[] }) {
  const cancelledCount = trains.filter((train) => train.cancelled).length;
  const delayedCount = trains.length - cancelledCount;
  const leadTrain = trains.reduce<StationTrain | undefined>((highestImpact, train) => {
    if (!highestImpact) return train;
    if (train.cancelled !== highestImpact.cancelled) return train.cancelled ? train : highestImpact;
    return train.delayMin > highestImpact.delayMin ? train : highestImpact;
  }, undefined);

  if (!leadTrain) return null;

  const hasCancellation = cancelledCount > 0;
  const expectedDeparture = leadTrain.scheduledDeparture + leadTrain.delayMin;
  const statusLabel = leadTrain.cancelled ? 'Cancelled' : `+${leadTrain.delayMin} min`;

  return (
    <View
      className={`overflow-hidden rounded-xl border ${
        hasCancellation ? 'border-danger/45 bg-danger-soft' : 'border-warning/45 bg-warning-soft'
      }`}
    >
      <View className="flex-row">
        <View className={`w-1 ${hasCancellation ? 'bg-danger' : 'bg-warning'}`} />
        <View className="min-w-0 flex-1 gap-3 p-3">
          <View className="flex-row flex-wrap items-center justify-between gap-2">
            <View className="flex-row items-center gap-2">
              <View
                className={`size-2 rounded-full ${hasCancellation ? 'bg-danger' : 'bg-warning'}`}
              />
              <Typography
                type="body-xs"
                className={`font-bold tracking-wide uppercase ${
                  hasCancellation ? 'text-danger' : 'text-warning'
                }`}
              >
                Current impact
              </Typography>
            </View>
            <View className="border-border bg-panel-raised rounded-full border px-2.5 py-1">
              <Typography type="body-xs" className="text-foreground font-semibold">
                {trains.length} affected {trains.length === 1 ? 'service' : 'services'}
              </Typography>
            </View>
          </View>

          <View className="flex-row flex-wrap items-end justify-between gap-x-4 gap-y-2">
            <View className="min-w-44 flex-1 gap-0.5">
              <Typography type="body-xs" className="text-muted font-semibold uppercase">
                Highest priority
              </Typography>
              <Typography type="h4" className="text-foreground font-bold">
                {leadTrain.service}
              </Typography>
              <Typography type="body-sm" className="text-foreground">
                To {leadTrain.destination}
              </Typography>
            </View>
            <View
              className={`min-w-28 items-end rounded-lg border px-3 py-2 ${
                hasCancellation
                  ? 'border-danger/35 bg-danger/10'
                  : 'border-warning/35 bg-warning/10'
              }`}
            >
              <Typography type="body-xs" className="text-muted font-semibold uppercase">
                Status
              </Typography>
              <Typography
                type="h3"
                className={`font-bold ${hasCancellation ? 'text-danger' : 'text-warning'}`}
              >
                {statusLabel}
              </Typography>
            </View>
          </View>

          <View className="border-border flex-row flex-wrap border-t pt-2.5">
            <View className="min-w-28 flex-1 gap-0.5 pr-3">
              <Typography type="body-xs" className="text-muted uppercase">
                Platform
              </Typography>
              <Typography type="body-sm" className="text-foreground font-bold">
                {leadTrain.platform > 0 ? leadTrain.platform : 'Pending'}
              </Typography>
            </View>
            <View className="border-border min-w-28 flex-1 gap-0.5 border-l px-3">
              <Typography type="body-xs" className="text-muted uppercase">
                {leadTrain.cancelled ? 'Scheduled' : 'Expected'}
              </Typography>
              <Typography type="body-sm" className="text-foreground font-bold">
                {clockTime(leadTrain.cancelled ? leadTrain.scheduledDeparture : expectedDeparture)}
              </Typography>
            </View>
            <View className="border-border min-w-28 flex-1 gap-0.5 border-l pl-3">
              <Typography type="body-xs" className="text-muted uppercase">
                Issue split
              </Typography>
              <Typography type="body-sm" className="text-foreground font-bold">
                {delayedCount} delayed · {cancelledCount} cancelled
              </Typography>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function MovementLegend({ trains }: { trains: StationTrain[] }) {
  const counts = trains.reduce<Record<Movement, number>>(
    (total, train) => {
      total[train.movement] += 1;
      return total;
    },
    { approaching: 0, platform: 0, departed: 0, cancelled: 0 },
  );

  return (
    <View className="border-separator bg-surface-secondary flex-row flex-wrap gap-x-4 gap-y-2 rounded-lg border px-3 py-2">
      {MOVEMENTS.map((movement) => (
        <View key={movement} className="flex-row items-center gap-1.5">
          <View className={`size-2 rounded-full ${MOVEMENT_COPY[movement].dot}`} />
          <Typography type="body-xs" className="text-muted">
            {MOVEMENT_COPY[movement].label}
          </Typography>
          <Typography type="body-xs" className="text-foreground font-bold">
            {counts[movement]}
          </Typography>
        </View>
      ))}
    </View>
  );
}

export function TrainMovementMap({ nowSeconds }: TrainMovementMapProps) {
  const {
    data = [],
    isError,
    isLoading,
  } = useQuery({
    queryKey: ['hamburg-platform-assignments'],
    queryFn: fetchHamburgPlatformAssignments,
    refetchInterval: 45_000,
    staleTime: 30_000,
  });
  const nowMinutes = nowSeconds / 60;

  const stationTrains = useMemo(
    () =>
      data
        .map(
          (train): StationTrain => ({
            ...train,
            movement: movementFor(train, nowMinutes),
            untilDeparture: signedMinuteDifference(
              train.scheduledDeparture + train.delayMin,
              nowMinutes,
            ),
          }),
        )
        .filter(
          (train) =>
            (train.delayMin > 0 || train.cancelled) &&
            train.untilDeparture >= -ACTIVE_WINDOW_BEHIND_MIN &&
            train.untilDeparture <= ACTIVE_WINDOW_AHEAD_MIN,
        )
        .sort((a, b) => {
          if (a.platform !== b.platform) return a.platform - b.platform;
          return a.untilDeparture - b.untilDeparture;
        }),
    [data, nowMinutes],
  );

  return (
    <Panel
      title="Hamburg Hbf service issues"
      hint="Delayed and cancelled services · movement inferred from timetable"
    >
      <View className="gap-2.5">
        <View className="flex-row flex-wrap items-center justify-between gap-2">
          <View className="flex-row items-center gap-2">
            <View className="bg-success size-2.5 rounded-full" />
            <Typography type="body-xs" className="text-success font-bold">
              LIVE DB
            </Typography>
          </View>
          <Typography type="body-xs" className="text-muted">
            Active window: −8 to +25 min
          </Typography>
        </View>

        {stationTrains.length > 0 ? (
          <>
            <CurrentImpactSummary trains={stationTrains} />
            <MovementLegend trains={stationTrains} />
          </>
        ) : null}

        {isLoading && data.length === 0 ? (
          <Typography type="body-xs" className="text-muted py-3">
            Loading live Hamburg platform movements…
          </Typography>
        ) : null}

        {isError && data.length === 0 ? (
          <Typography type="body-xs" className="text-danger py-3">
            Live platform movements are temporarily unavailable.
          </Typography>
        ) : null}

        {!isLoading && !isError && stationTrains.length === 0 ? (
          <Typography type="body-xs" className="text-muted py-3">
            No delayed or cancelled services are inside the active station window.
          </Typography>
        ) : null}

        {stationTrains.map((train) => (
          <TrackTrain key={train.id} train={train} />
        ))}

        <Typography type="body-xs" className="text-muted">
          Markers animate toward the platform and then toward the exit as scheduled time passes.
          This is operational timetable inference, not GPS positioning.
        </Typography>
      </View>
    </Panel>
  );
}
