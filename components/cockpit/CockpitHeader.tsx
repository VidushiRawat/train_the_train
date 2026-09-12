import { Typography } from 'heroui-native';
import { View } from 'react-native';

import { berlinDateLabel } from '@/lib/db-api';
import { useCockpitStore } from '@/lib/store';
import { formatClock } from '@/lib/utils';

interface CockpitHeaderProps {
  title: string;
  subtitle: string;
}

const FEED_INDICATOR = {
  live: { dot: 'bg-success', text: 'text-success', label: 'LIVE' },
  loading: { dot: 'bg-warning', text: 'text-warning', label: 'SYNCING' },
  idle: { dot: 'bg-warning', text: 'text-warning', label: 'SYNCING' },
  error: { dot: 'bg-danger', text: 'text-danger', label: 'NO FEED' },
} as const;

/** Control-room title bar: wordmark, feed state, screen name and Berlin clock. */
export function CockpitHeader({ title, subtitle }: CockpitHeaderProps) {
  const nowSeconds = useCockpitStore((state) => state.nowSeconds);
  const feedStatus = useCockpitStore((state) => state.feed.status);
  const indicator = FEED_INDICATOR[feedStatus];

  return (
    <View className="border-border bg-panel pt-safe-offset-3 gap-3 border-b px-4 pb-3">
      <View className="flex-row items-center gap-2">
        <View className="bg-accent size-6 items-center justify-center rounded-md">
          <Typography type="body-xs" weight="bold" className="text-background">
            T2
          </Typography>
        </View>
        <Typography type="body-sm" weight="bold" className="tracking-[3px]">
          TRAIN2TRAIN
        </Typography>
        <View className="flex-1" />
        <View className={`size-2 rounded-full ${indicator.dot}`} />
        <Typography type="body-xs" className={`${indicator.text} tracking-wide`}>
          {indicator.label}
        </Typography>
      </View>

      <View className="flex-row flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <View className="min-w-48 flex-1">
          <Typography type="h4" weight="semibold">
            {title}
          </Typography>
          <Typography type="body-xs" color="muted">
            {subtitle}
          </Typography>
        </View>
        <View className="shrink-0 items-end">
          <Typography type="body" weight="semibold">
            {formatClock(nowSeconds)}
          </Typography>
          <Typography type="body-xs" color="muted">
            {berlinDateLabel()} · Berlin
          </Typography>
        </View>
      </View>
    </View>
  );
}
