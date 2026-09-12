import { Typography } from 'heroui-native';
import { View } from 'react-native';

import type {
  DecisionMode,
  ProposalAuthor,
  Severity,
  TrainCategory,
  TrainStatus,
} from '@/lib/types';
import { cn } from '@/lib/utils';

const CATEGORY_CLASS: Record<TrainCategory, string> = {
  ICE: 'bg-ice',
  IC: 'bg-ic',
  RE: 'bg-re',
  RB: 'bg-rb',
};

/** Train category flag, e.g. ICE / RE. */
export function CategoryBadge({ category }: { category: TrainCategory }) {
  return (
    <View className={cn('rounded-md px-2 py-0.5', CATEGORY_CLASS[category])}>
      <Typography type="body-xs" weight="bold" className="text-background tracking-wider">
        {category}
      </Typography>
    </View>
  );
}

const STATUS_LABEL: Record<TrainStatus, string> = {
  'on-time': 'On time',
  delayed: 'Delayed',
  held: 'Held',
  rerouted: 'Re-platformed',
  cancelled: 'Cancelled',
};

const STATUS_CLASS: Record<TrainStatus, { dot: string; text: string }> = {
  'on-time': { dot: 'bg-success', text: 'text-success' },
  delayed: { dot: 'bg-danger', text: 'text-danger' },
  held: { dot: 'bg-warning', text: 'text-warning' },
  rerouted: { dot: 'bg-accent', text: 'text-accent' },
  cancelled: { dot: 'bg-danger', text: 'text-danger' },
};

export function StatusPill({ status }: { status: TrainStatus }) {
  const tone = STATUS_CLASS[status];
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={cn('size-2 rounded-full', tone.dot)} />
      <Typography type="body-xs" weight="medium" className={tone.text}>
        {STATUS_LABEL[status]}
      </Typography>
    </View>
  );
}

const AUTHOR_CLASS: Record<ProposalAuthor, string> = {
  network: 'bg-agent-network',
  passenger: 'bg-agent-passenger',
  arbiter: 'bg-agent-arbiter',
};

/** Option letter chip coloured by the agent that authored the plan. */
export function OptionBadge({ id, author }: { id: string; author: ProposalAuthor }) {
  return (
    <View className={cn('size-7 items-center justify-center rounded-lg', AUTHOR_CLASS[author])}>
      <Typography type="body-sm" weight="bold" className="text-background">
        {id}
      </Typography>
    </View>
  );
}

const MODE_LABEL: Record<DecisionMode, string> = {
  auto: 'Auto-applied',
  accepted: 'Accepted',
  override: 'Override',
};

const MODE_CLASS: Record<DecisionMode, { border: string; text: string }> = {
  auto: { border: 'border-success', text: 'text-success' },
  accepted: { border: 'border-accent', text: 'text-accent' },
  override: { border: 'border-warning', text: 'text-warning' },
};

export function ModeBadge({ mode }: { mode: DecisionMode }) {
  return (
    <View className={cn('rounded-md border px-2 py-0.5', MODE_CLASS[mode].border)}>
      <Typography
        type="body-xs"
        weight="semibold"
        className={cn('tracking-wide', MODE_CLASS[mode].text)}
      >
        {MODE_LABEL[mode].toUpperCase()}
      </Typography>
    </View>
  );
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const isMajor = severity === 'major';
  return (
    <View
      className={cn('rounded-md border px-2 py-0.5', isMajor ? 'border-danger' : 'border-success')}
    >
      <Typography
        type="body-xs"
        weight="semibold"
        className={cn('tracking-wide', isMajor ? 'text-danger' : 'text-success')}
      >
        {isMajor ? 'CONTROLLER DECISION' : 'MINOR'}
      </Typography>
    </View>
  );
}
