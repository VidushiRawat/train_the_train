import { useQuery } from '@tanstack/react-query';
import { Typography, useThemeColor } from 'heroui-native';
import { ArrowDownRight, ArrowUpRight, CircleStop, TrainFront } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import { CategoryBadge } from '@/components/cockpit/badges';
import { fetchHamburgPlatformAssignments, type HamburgPlatformAssignment } from '@/lib/db-api';
import { cn } from '@/lib/utils';

import { Panel } from './Panel';

type PlatformMovement = 'approaching' | 'at-platform' | 'departed' | 'cancelled';

interface StationTrain extends HamburgPlatformAssignment {
  movement: PlatformMovement;
}

const MOVEMENT_COPY: Record<
  PlatformMovement,
  { label: string; description: string; tone: string; border: string }
> = {
  approaching: {
    label: 'Approaching',
    description: 'Due into the station',
    tone: 'text-warning',
    border: 'border-warning/40',
  },
  'at-platform': {
    label: 'At station',
    description: 'Within the departure window',
    tone: 'text-success',
    border: 'border-success/40',
  },
  departed: {
    label: 'Departed',
    description: 'Recently left Hamburg Hbf',
    tone: 'text-muted',
    border: 'border-border',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Not operating',
    tone: 'text-danger',
    border: 'border-danger/40',
  },
};

const MOVEMENT_ORDER: PlatformMovement[] = ['approaching', 'at-platform', 'departed', 'cancelled'];

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

  if (movement === 'approaching') return <ArrowDownRight color={color} size={18} />;
  if (movement === 'departed') return <ArrowUpRight color={color} size={18} />;
  if (movement === 'cancelled') return <CircleStop color={color} size={18} />;
  return <TrainFront color={color} size={18} />;
}

function MovementGroup({
  movement,
  trains,
}: {
  movement: PlatformMovement;
  trains: StationTrain[];
}) {
  const copy = MOVEMENT_COPY[movement];

  return (
    <View
      className={cn('bg-surface-secondary min-w-36 flex-1 rounded-lg border p-2.5', copy.border)}
      style={{ flexBasis: 148 }}
    >
      <View className="flex-row items-center gap-1.5">
        <MovementIcon movement={movement} />
        <View className="min-w-0 flex-1">
          <Typography
            type="body-sm"
            weight="semibold"
            className={copy.tone}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {copy.label}
          </Typography>
          <Typography type="body-xs" color="muted" numberOfLines={1} ellipsizeMode="tail">
            {copy.description}
          </Typography>
        </View>
        <Typography type="h4" weight="bold" className={copy.tone}>
          {trains.length}
        </Typography>
      </View>

      {trains.length > 0 ? (
        <View className="mt-2 flex-row flex-wrap gap-1.5">
          {trains.map((train) => (
            <View
              key={train.id}
              className="border-border bg-surface min-w-0 flex-row items-center gap-1 rounded-md border px-1.5 py-1"
            >
              <CategoryBadge category={train.category} />
              <Typography
                type="body-xs"
                weight="semibold"
                className="min-w-0 shrink"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {train.service}
              </Typography>
            </View>
          ))}
        </View>
      ) : (
        <Typography type="body-xs" color="muted" className="mt-1.5">
          No services
        </Typography>
      )}
    </View>
  );
}

export function TrainMovementMap({ nowSeconds }: { nowSeconds: number }) {
  const nowMinutes = Math.floor(nowSeconds / 60);
  const query = useQuery({
    queryKey: ['station-board', 'hamburg-hbf'],
    queryFn: fetchHamburgPlatformAssignments,
    refetchInterval: 45_000,
    staleTime: 20_000,
    retry: 1,
  });

  const stationTrains = useMemo(
    () =>
      (query.data ?? []).map<StationTrain>((train) => ({
        ...train,
        movement: movementFor(train, nowMinutes),
      })),
    [query.data, nowMinutes],
  );

  return (
    <Panel title="Station movements" compact>
      <View className="border-border bg-surface-secondary mb-2 flex-row items-center gap-2 rounded-lg border px-2.5 py-1.5">
        <View className="bg-success/15 rounded px-1.5 py-0.5">
          <Typography type="body-xs" weight="bold" className="text-success">
            LIVE DB
          </Typography>
        </View>
        <Typography
          type="body-xs"
          color="muted"
          className="min-w-0 flex-1"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Services are live; movement is inferred from the timetable, not GPS. Track details are
          hidden.
        </Typography>
      </View>

      {query.isError ? (
        <View className="border-danger/50 bg-danger/10 rounded-lg border px-3 py-3">
          <Typography
            type="body-sm"
            weight="semibold"
            className="text-danger"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Hamburg station board unavailable
          </Typography>
          <Typography
            type="body-xs"
            color="muted"
            className="mt-1"
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            The direct public feed may be blocked in this browser.
          </Typography>
        </View>
      ) : query.isPending ? (
        <Typography
          type="body-sm"
          color="muted"
          className="py-6 text-center"
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Loading Hamburg Hauptbahnhof movements…
        </Typography>
      ) : (
        <View className="flex-row flex-wrap gap-2">
          {MOVEMENT_ORDER.map((movement) => (
            <MovementGroup
              key={movement}
              movement={movement}
              trains={stationTrains.filter((train) => train.movement === movement)}
            />
          ))}
        </View>
      )}
    </Panel>
  );
}
