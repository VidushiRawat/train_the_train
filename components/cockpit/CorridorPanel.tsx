import { Typography } from 'heroui-native';
import { View } from 'react-native';

import { CORRIDOR_STATIONS } from '@/lib/data';
import type { Train } from '@/lib/types';

import { Panel } from './Panel';
import { TrainRow } from './TrainRow';

interface CorridorPanelProps {
  trains: Train[];
  nowMinutes: number;
  focusedTrainId?: string;
}

/** Corridor overview: station scale on top, one row per service below. */
export function CorridorPanel({ trains, nowMinutes, focusedTrainId }: CorridorPanelProps) {
  return (
    <Panel
      title="Corridor Hamburg Hbf → Hannover Hbf"
      hint={`${trains.length} services in the next 60 minutes`}
      contentClassName="px-1 py-1"
    >
      <View className="mb-1 px-3 pt-2">
        <View className="h-4 flex-row">
          {CORRIDOR_STATIONS.map((station) => (
            <View
              key={station.id}
              className="absolute items-center"
              style={{ left: `${station.offset * 100}%`, marginLeft: -14, width: 28 }}
            >
              <Typography type="body-xs" className="text-muted">
                {station.short}
              </Typography>
            </View>
          ))}
        </View>
        <View className="h-2 justify-center">
          <View className="bg-rail h-px" />
          {CORRIDOR_STATIONS.map((station) => (
            <View
              key={station.id}
              className="bg-rail-live absolute size-1.5 rounded-full"
              style={{ left: `${station.offset * 100}%`, marginLeft: -3 }}
            />
          ))}
        </View>
      </View>

      {trains.map((train, index) => (
        <View key={train.id} className={index > 0 ? 'border-separator border-t' : undefined}>
          <TrainRow train={train} nowMinutes={nowMinutes} isFocused={train.id === focusedTrainId} />
        </View>
      ))}
    </Panel>
  );
}
