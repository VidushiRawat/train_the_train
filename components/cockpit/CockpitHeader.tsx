import { Typography } from 'heroui-native';
import { View } from 'react-native';

import { useCockpitStore } from '@/lib/store';
import { formatClock } from '@/lib/utils';

interface CockpitHeaderProps {
  title: string;
  subtitle: string;
}

/** Control-room title bar: wordmark, screen name and the live corridor clock. */
export function CockpitHeader({ title, subtitle }: CockpitHeaderProps) {
  const nowSeconds = useCockpitStore((state) => state.nowSeconds);

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
        <View className="bg-success size-2 rounded-full" />
        <Typography type="body-xs" className="text-success tracking-wide">
          LIVE
        </Typography>
      </View>

      <View className="flex-row items-end justify-between gap-3">
        <View className="flex-1">
          <Typography type="h4" weight="semibold">
            {title}
          </Typography>
          <Typography type="body-xs" color="muted" numberOfLines={1}>
            {subtitle}
          </Typography>
        </View>
        <View className="items-end">
          <Typography type="body" weight="semibold">
            {formatClock(nowSeconds)}
          </Typography>
          <Typography type="body-xs" color="muted">
            Tue 8 Sep · corridor time
          </Typography>
        </View>
      </View>
    </View>
  );
}
