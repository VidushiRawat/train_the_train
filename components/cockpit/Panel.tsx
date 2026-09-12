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
  className?: string;
  contentClassName?: string;
}

/** Framed section used across the cockpit. */
export function Panel({ title, hint, right, children, className, contentClassName }: PanelProps) {
  return (
    <View className={cn('border-border bg-panel overflow-hidden rounded-2xl border', className)}>
      {(title || right) && (
        <View className="border-border flex-row items-center justify-between gap-3 border-b px-4 py-3">
          <View className="flex-1">
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
      <View className={cn('px-4 py-3', contentClassName)}>{children}</View>
    </View>
  );
}
