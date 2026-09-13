import { Typography } from 'heroui-native';
import { Platform, View } from 'react-native';

import { BrandLogo } from '@/components/cockpit/BrandLogo';

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

const IS_IOS = Platform.OS === 'ios';
const LOGO_SIZE = IS_IOS ? 132 : 88;

/** Control-room title bar: wordmark, feed state, screen name and Berlin clock. */
export function CockpitHeader({ title, subtitle }: CockpitHeaderProps) {
  const nowSeconds = useCockpitStore((state) => state.nowSeconds);
  const feedStatus = useCockpitStore((state) => state.feed.status);
  const indicator = FEED_INDICATOR[feedStatus];

  return (
    <View
      className="border-border bg-panel pt-safe-offset-2 gap-3 border-b px-3 pb-2"
      style={{ flexDirection: IS_IOS ? 'column' : 'row', alignItems: 'center' }}
    >
      <View className="shrink-0" style={{ height: LOGO_SIZE, width: LOGO_SIZE }}>
        <BrandLogo size={LOGO_SIZE} />
      </View>

      <View
        className="min-w-0 flex-1 flex-row items-center gap-3"
        style={IS_IOS ? { alignSelf: 'stretch' } : undefined}
      >
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
    </View>
  );
}
