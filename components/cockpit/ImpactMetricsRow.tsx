import { Typography } from 'heroui-native';
import { View } from 'react-native';

import type { ImpactMetrics } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ImpactMetricsRowProps {
  metrics: ImpactMetrics;
  /** When given, each cell shows the delta against doing nothing. */
  baseline?: ImpactMetrics;
  className?: string;
}

interface Cell {
  label: string;
  value: string;
  /** Positive = better than baseline. */
  saved?: number;
  savedUnit?: string;
}

function Delta({ saved, unit }: { saved: number; unit: string }) {
  if (saved === 0) {
    return (
      <Typography type="body-xs" color="muted">
        same as no action
      </Typography>
    );
  }
  const better = saved > 0;
  return (
    <Typography type="body-xs" className={better ? 'text-success' : 'text-warning'}>
      {better ? '−' : '+'}
      {Math.abs(saved)}
      {unit} vs no action
    </Typography>
  );
}

/** The three numbers every plan is judged on. */
export function ImpactMetricsRow({ metrics, baseline, className }: ImpactMetricsRowProps) {
  const cells: Cell[] = [
    {
      label: 'Delay minutes',
      value: `${metrics.networkDelayMin}`,
      saved: baseline ? baseline.networkDelayMin - metrics.networkDelayMin : undefined,
      savedUnit: ' min',
    },
    {
      label: 'Broken connections',
      value: `${metrics.missedConnections}`,
      saved: baseline ? baseline.missedConnections - metrics.missedConnections : undefined,
      savedUnit: '',
    },
    {
      label: 'Passengers hit',
      value: `${metrics.passengersDisrupted}`,
      saved: baseline ? baseline.passengersDisrupted - metrics.passengersDisrupted : undefined,
      savedUnit: '',
    },
  ];

  return (
    <View className={cn('flex-row flex-wrap gap-2', className)}>
      {cells.map((cell) => (
        <View key={cell.label} className="bg-panel-raised min-w-32 flex-1 rounded-xl px-2.5 py-2">
          <Typography type="body-xs" color="muted">
            {cell.label}
          </Typography>
          <Typography type="body" weight="semibold" className="mt-0.5">
            {cell.value}
          </Typography>
          {cell.saved !== undefined && <Delta saved={cell.saved} unit={cell.savedUnit ?? ''} />}
        </View>
      ))}
      <View className="bg-panel-raised min-w-32 flex-1 rounded-xl px-2.5 py-2">
        <Typography type="body-xs" color="muted">
          Trains touched
        </Typography>
        <Typography type="body" weight="semibold" className="mt-0.5">
          {metrics.trainsAffected}
        </Typography>
      </View>
    </View>
  );
}
