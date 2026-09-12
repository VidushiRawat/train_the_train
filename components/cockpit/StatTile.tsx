import { Typography } from 'heroui-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/utils';

export type StatTone = 'default' | 'accent' | 'success' | 'warning' | 'danger';

const TONE_CLASS: Record<StatTone, string> = {
  default: 'text-foreground',
  accent: 'text-accent',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

interface StatTileProps {
  label: string;
  value: string;
  hint?: string;
  tone?: StatTone;
  icon?: ReactNode;
  className?: string;
}

/** Dense KPI tile for the corridor and scoreboard views. */
export function StatTile({ label, value, hint, tone = 'default', icon, className }: StatTileProps) {
  return (
    <View
      className={cn(
        'border-border bg-panel flex-1 justify-between gap-2 rounded-2xl border px-3 py-3',
        className,
      )}
    >
      <View className="flex-row items-center gap-2">
        {icon}
        <Typography type="body-xs" className="text-muted flex-1 tracking-wide" numberOfLines={2}>
          {label.toUpperCase()}
        </Typography>
      </View>
      <View>
        <Typography type="h4" weight="semibold" className={TONE_CLASS[tone]}>
          {value}
        </Typography>
        {hint && (
          <Typography type="body-xs" color="muted" numberOfLines={2}>
            {hint}
          </Typography>
        )}
      </View>
    </View>
  );
}
