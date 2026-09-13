import { Typography } from 'heroui-native';
import { Image, View } from 'react-native';

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

const TRAIN_LOGO = require('../../assets/train-the-train-logo.png');
const LOGO_SIZE = 72;

/** Control-room title bar: wordmark, feed state, screen name and Berlin clock. */
export function CockpitHeader({ title, subtitle }: CockpitHeaderProps) {
  const nowSeconds = useCockpitStore((state) => state.nowSeconds);
  const feedStatus = useCockpitStore((state) => state.feed.status);
  const indicator = FEED_INDICATOR[feedStatus];

  return (
    <View className="border-border bg-panel pt-safe-offset-2 flex-row items-center gap-3 border-b px-3 pb-2">
      <View
        className="shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white"
        style={{ height: LOGO_SIZE, width: LOGO_SIZE }}
      >
        <Image
          source={TRAIN_LOGO}
          accessibilityLabel="Train the Train — Ladies on Track"
          accessibilityIgnoresInvertColors
          fadeDuration={0}
          resizeMode="contain"
          style={{ height: LOGO_SIZE, width: LOGO_SIZE }}
        />
      </View>

      <View className="min-w-0 flex-1">
        <Typography type="h4" weight="semibold" className="web:break-normal web:hyphens-none">
          {title}
        </Typography>
        <Typography type="body-xs" color="muted" className="web:break-normal web:hyphens-none">
          {subtitle}
        </Typography>
      </View>

      <View className="shrink-0 items-end gap-0.5">
        <View className="flex-row items-center gap-1.5">
          <View className={`size-2 rounded-full ${indicator.dot}`} />
          <Typography type="body-xs" className={`${indicator.text} tracking-wide`}>
            {indicator.label}
          </Typography>
        </View>
        <Typography type="body" weight="semibold">
          {formatClock(nowSeconds)}
        </Typography>
        <Typography type="body-xs" color="muted" className="web:break-normal web:hyphens-none">
          {berlinDateLabel()} · Berlin
        </Typography>
      </View>
    </View>
  );
}
