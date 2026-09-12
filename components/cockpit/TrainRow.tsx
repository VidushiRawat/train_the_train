import { Typography } from 'heroui-native';
import { View } from 'react-native';

import { arrivalLabel, connectionsAtRisk, trainPosition } from '@/lib/agents';
import type { Train } from '@/lib/types';
import { formatDelay } from '@/lib/utils';

import { CategoryBadge, StatusPill } from './badges';

const CATEGORY_DOT: Record<Train['category'], string> = {
  ICE: 'bg-ice',
  IC: 'bg-ic',
  RE: 'bg-re',
  RB: 'bg-rb',
};

const STAGE_LABEL = {
  'not-started': 'At origin',
  'en-route': 'En route',
  arrived: 'Arrived',
} as const;

interface TrainRowProps {
  train: Train;
  nowMinutes: number;
  /** Highlights the train the pending incident belongs to. */
  isFocused?: boolean;
}

/** One corridor service: category, platform, position, delay and transfers. */
export function TrainRow({ train, nowMinutes, isFocused }: TrainRowProps) {
  const { offset, stage } = trainPosition(train, nowMinutes);
  const platform = train.reroutedTo ?? train.platform;
  const atRisk = connectionsAtRisk(train);
  const transferring = train.connections.reduce(
    (total, connection) => total + connection.transferPassengers,
    0,
  );

  return (
    <View
      className={
        isFocused
          ? 'border-danger bg-panel-raised gap-2 rounded-xl border px-3 py-3'
          : 'gap-2 px-3 py-3'
      }
    >
      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <CategoryBadge category={train.category} />
        <Typography type="body" weight="semibold" className="min-w-20 flex-1">
          {train.service}
        </Typography>
        <Typography
          type="body-sm"
          weight="semibold"
          className={train.delayMin > 0 ? 'text-danger' : 'text-success'}
        >
          {formatDelay(train.delayMin)}
        </Typography>
        <StatusPill status={train.status} />
      </View>

      <Typography type="body-xs" color="muted">
        {train.origin} → {train.destination} · {train.passengersOnboard} on board ·{' '}
        {train.passengersBoarding} boarding
      </Typography>

      {/* Corridor position: Hamburg Hbf on the left, Hannover Hbf on the right. */}
      <View className="h-3 justify-center">
        <View className="bg-rail h-[3px] rounded-full" />
        <View
          className="bg-rail-live absolute h-[3px] rounded-full"
          style={{
            left: `${train.fromOffset * 100}%`,
            width: `${(offset - train.fromOffset) * 100}%`,
          }}
        />
        <View
          className={`border-background absolute size-3 rounded-full border ${CATEGORY_DOT[train.category]}`}
          style={{ left: `${offset * 100}%`, marginLeft: -6 }}
        />
      </View>

      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <View className="border-border rounded-md border px-1.5 py-0.5">
          <Typography type="body-xs" weight="semibold">
            Pl. {platform}
          </Typography>
        </View>
        {train.reroutedTo !== undefined && (
          <Typography type="body-xs" className="text-accent">
            was {train.platform}
          </Typography>
        )}
        <Typography type="body-xs" color="muted">
          {STAGE_LABEL[stage]}
        </Typography>
        <View className="flex-1" />
        <Typography type="body-xs" color="muted">
          arr {arrivalLabel(train)}
        </Typography>
      </View>

      {train.connections.length > 0 && (
        <Typography type="body-xs" className={atRisk.length > 0 ? 'text-danger' : 'text-muted'}>
          {train.connections.length} onward connection{train.connections.length === 1 ? '' : 's'} at
          Hamburg Hbf · {transferring} transferring
          {atRisk.length > 0
            ? ` · ${atRisk.map((connection) => connection.service).join(', ')} at risk`
            : ''}
        </Typography>
      )}

      {train.note && (
        <Typography type="body-xs" className="text-accent">
          {train.note}
        </Typography>
      )}
    </View>
  );
}
