import { Typography } from 'heroui-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { cn } from '@/lib/utils';

interface PanelProps {
  /** Small uppercase panel label, control-room style. */
  title?: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
  compact?: boolean;
  className?: string;
  contentClassName?: string;
}

/** Framed section used across the cockpit. */
export function Panel({
  title,
  hint,
  right,
  children,
  compact = false,
  className,
  contentClassName,
}: PanelProps) {
  return (
    <View className={cn('border-border bg-panel overflow-hidden rounded-2xl border', className)}>
      {(title || right) && (
        <View
          className={cn(
            'border-border flex-row flex-wrap items-center justify-between gap-x-3 border-b px-4',
            compact ? 'gap-y-1 px-3 py-2' : 'gap-y-2 py-3',
          )}
        >
          <View className="min-w-48 flex-1">
            {title && (
              <Typography type="body-xs" weight="semibold" className="text-muted tracking-[2px]">
                {title.toUpperCase()}
              </Typography>
            )}
            {hint && (
              <Typography type="body-xs" color="muted" className="mt-0.5">
                {hint}
              </Typography>
            )}
          </View>
          {right}
        </View>
      )}
      <View className={cn(compact ? 'px-3 py-2.5' : 'px-4 py-3', contentClassName)}>
        {children}
      </View>
    </View>
  );
}
