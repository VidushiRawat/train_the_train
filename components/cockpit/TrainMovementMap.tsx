import { useQuery } from '@tanstack/react-query';
import { Typography, useThemeColor } from 'heroui-native';
import { ArrowDownRight, ArrowUpRight, CircleStop, Clock3, TrainFront } from 'lucide-react-native';
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';

import { CategoryBadge, StatusPill } from '@/components/cockpit/badges';
import { fetchHamburgPlatformAssignments, type HamburgPlatformAssignment } from '@/lib/db-api';
import type { Train, TrainStatus } from '@/lib/types';
import { cn, formatTimeOfDay } from '@/lib/utils';

import { Panel } from './Panel';

type PlatformMovement = 'approaching' | 'at-platform' | 'departed' | 'cancelled';

interface PlatformTrain extends HamburgPlatformAssignment {
  movement: PlatformMovement;
  effectiveDeparture: number;
  status: TrainStatus;
}

const HAMBURG_PLATFORMS = Array.from({ length: 10 }, (_, index) => index + 5);

const MOVEMENT_COPY: Record<PlatformMovement, { label: string; tone: string }> = {
  approaching: { label: 'Approaching', tone: 'text-warning' },
  'at-platform': { label: 'At platform', tone: 'text-success' },
  departed: { label: 'Departed', tone: 'text-muted' },
  cancelled: { label: 'Cancelled', tone: 'text-danger' },
};

function signedMinuteDifference(target: number, now: number) {
  let difference = target - now;
  if (difference > 720) difference -= 1440;
  if (difference < -720) difference += 1440;
  return difference;
}

function movementFor(train: HamburgPlatformAssignment, nowMinutes: number): PlatformMovement {
  if (train.cancelled) return 'cancelled';
  const untilDeparture = signedMinuteDifference(
    train.scheduledDeparture + train.delayMin,
    nowMinutes,
  );
  if (untilDeparture > 4) return 'approaching';
  if (untilDeparture >= -2) return 'at-platform';
  return 'departed';
}

function MovementIcon({ movement }: { movement: PlatformMovement }) {
  const [warning, success, muted, danger] = useThemeColor([
    'warning',
    'success',
    'muted',
    'danger',
  ]);
  const color =
    movement === 'approaching'
      ? warning
      : movement === 'at-platform'
        ? success
        : movement === 'cancelled'
          ? danger
          : muted;

  if (movement === 'approaching') return <ArrowDownRight color={color} size={17} />;
  if (movement === 'departed') return <ArrowUpRight color={color} size={17} />;
  if (movement === 'cancelled') return <CircleStop color={color} size={17} />;
  return <TrainFront color={color} size={17} />;
}

function TrainAssignment({ train }: { train: PlatformTrain }) {
  const movement = MOVEMENT_COPY[train.movement];
  const [muted] = useThemeColor(['muted']);

  return (
    <View
      className={cn(
        'bg-surface-secondary min-w-0 flex-1 rounded-lg border px-3 py-2.5',
        train.movement === 'at-platform' ? 'border-success/60' : 'border-border',
        train.movement === 'cancelled' && 'border-danger/60 opacity-70',
      )}
    >
      <View className="min-w-0 flex-row flex-wrap items-center gap-2">
        <MovementIcon movement={train.movement} />
        <CategoryBadge category={train.category} />
        <Typography type="body-sm" weight="bold" className="text-foreground shrink">
          {train.service}
        </Typography>
        <Typography type="body-xs" weight="semibold" className={movement.tone}>
          {movement.label}
        </Typography>
      </View>

      <View className="mt-2 min-w-0 flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <View className="flex-row items-center gap-1.5">
          <Clock3 color={muted} size={13} />
          <Typography type="body-xs" className="text-muted">
            {formatTimeOfDay(train.effectiveDeparture)} estimated departure
          </Typography>
        </View>
        <StatusPill status={train.status} />
      </View>

      <Typography type="body-xs" className="text-muted mt-1.5">
        Hamburg Hbf → {train.destination}
        {train.delayMin > 0 ? ` · +${train.delayMin} min` : ' · on time'}
      </Typography>
    </View>
  );
}

function PlatformLane({ platform, trains }: { platform: number; trains: PlatformTrain[] }) {
  return (
    <View className="border-border/70 min-w-0 flex-row gap-3 border-b py-3 last:border-b-0">
      <View className="bg-surface-secondary w-14 shrink-0 items-center justify-center rounded-lg py-2">
        <Typography type="body-xs" weight="semibold" className="text-muted">
          TRACK
        </Typography>
        <Typography type="h4" weight="bold" className="text-foreground">
          {platform}
        </Typography>
      </View>

      <View className="relative min-w-0 flex-1 justify-center">
        <View className="bg-border absolute top-1/2 right-0 left-0 h-0.5" />
        {trains.length > 0 ? (
          <View className="gap-2">
            {trains.map((train) => (
              <TrainAssignment key={train.id} train={train} />
            ))}
          </View>
        ) : (
          <View className="bg-surface self-start rounded-md px-2.5 py-1.5">
            <Typography type="body-xs" className="text-muted">
              No corridor service assigned
            </Typography>
          </View>
        )}
      </View>
    </View>
  );
}

export function TrainMovementMap({ nowSeconds }: { trains: Train[]; nowSeconds: number }) {
  const nowMinutes = Math.floor(nowSeconds / 60);
  const query = useQuery({
    queryKey: ['corridor-board', 'hamburg-platforms'],
    queryFn: fetchHamburgPlatformAssignments,
    refetchInterval: 45_000,
    staleTime: 20_000,
    retry: 1,
  });

  const platformTrains = useMemo(
    () =>
      (query.data ?? []).map<PlatformTrain>((train) => {
        const movement = movementFor(train, nowMinutes);
        return {
          ...train,
          effectiveDeparture: train.scheduledDeparture + train.delayMin,
          movement,
          status: train.cancelled ? 'cancelled' : train.delayMin > 0 ? 'delayed' : 'on-time',
        };
      }),
    [query.data, nowMinutes],
  );

  const platforms = useMemo(() => {
    const visible = new Set(HAMBURG_PLATFORMS);
    for (const train of platformTrains) visible.add(train.platform);
    return [...visible].sort((a, b) => a - b);
  }, [platformTrains]);

  return (
    <Panel title="Hamburg Hbf platform view" hint="Live track-specific operating schematic">
      <View className="border-border bg-surface-secondary mb-3 flex-row flex-wrap gap-x-4 gap-y-2 rounded-lg border px-3 py-2.5">
        {(['approaching', 'at-platform', 'departed', 'cancelled'] as const).map((movement) => (
          <View key={movement} className="flex-row items-center gap-1.5">
            <MovementIcon movement={movement} />
            <Typography type="body-xs" className={MOVEMENT_COPY[movement].tone}>
              {MOVEMENT_COPY[movement].label}
            </Typography>
          </View>
        ))}
      </View>

      {query.isError ? (
        <View className="border-danger/50 bg-danger/10 mb-3 rounded-lg border px-3 py-2.5">
          <Typography type="body-sm" weight="semibold" className="text-danger">
            Hamburg platform board unavailable
          </Typography>
          <Typography type="body-xs" className="text-muted mt-1">
            The direct public feed may be blocked in this browser. Use Refresh to try again.
          </Typography>
        </View>
      ) : null}

      {query.isPending ? (
        <Typography type="body-sm" className="text-muted py-5 text-center">
          Loading Hamburg Hbf platform assignments…
        </Typography>
      ) : (
        <ScrollView
          className="max-h-[620px]"
          contentContainerClassName="pb-1"
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {platforms.map((platform) => (
            <PlatformLane
              key={platform}
              platform={platform}
              trains={platformTrains.filter((train) => train.platform === platform)}
            />
          ))}
        </ScrollView>
      )}

      <Typography type="body-xs" className="text-muted mt-3">
        Services and track assignments come from the live Hamburg Hbf departure board. Movement
        states are inferred from scheduled and reported departure times; no train GPS is available.
      </Typography>
    </Panel>
  );
}
