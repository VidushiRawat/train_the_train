import { Typography, useThemeColor } from 'heroui-native';
import { ArrowDownRight, ArrowUpRight, TrainFront } from 'lucide-react-native';
import { useMemo } from 'react';
import { View } from 'react-native';

import MapView, { type LatLng, type MapMarker, type MapPolyline } from '@/components/MapView';
import { trainPosition } from '@/lib/agents';
import { CORRIDOR_STATIONS } from '@/lib/data';
import type { Train } from '@/lib/types';
import { formatDelay, formatTimeOfDay } from '@/lib/utils';

import { Panel } from './Panel';

interface TrainMovementMapProps {
  trains: Train[];
  nowMinutes: number;
}

interface GeoStation {
  offset: number;
  coordinate: LatLng;
}

const GEO_STATIONS: GeoStation[] = [
  { offset: 0, coordinate: { latitude: 53.5526, longitude: 10.0067 } },
  { offset: 0.09, coordinate: { latitude: 53.456, longitude: 9.991 } },
  { offset: 0.26, coordinate: { latitude: 53.249, longitude: 10.419 } },
  { offset: 0.47, coordinate: { latitude: 52.969, longitude: 10.553 } },
  { offset: 0.76, coordinate: { latitude: 52.624, longitude: 10.063 } },
  { offset: 1, coordinate: { latitude: 52.376, longitude: 9.741 } },
];

const HANNOVER = GEO_STATIONS[GEO_STATIONS.length - 1].coordinate;

const CATEGORY_COLOR: Record<Train['category'], MapMarker['color']> = {
  ICE: 'cyan',
  IC: 'purple',
  RE: 'green',
  RB: 'blue',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function interpolate(from: LatLng, to: LatLng, progress: number): LatLng {
  return {
    latitude: from.latitude + (to.latitude - from.latitude) * progress,
    longitude: from.longitude + (to.longitude - from.longitude) * progress,
  };
}

function corridorCoordinate(offset: number) {
  const boundedOffset = clamp(offset, 0, 1);
  const nextIndex = GEO_STATIONS.findIndex((station) => station.offset >= boundedOffset);
  if (nextIndex <= 0) return GEO_STATIONS[0].coordinate;

  const from = GEO_STATIONS[nextIndex - 1];
  const to = GEO_STATIONS[nextIndex];
  const progress = (boundedOffset - from.offset) / (to.offset - from.offset);
  return interpolate(from.coordinate, to.coordinate, progress);
}

function platformCoordinate(platform: number): LatLng {
  const lane = clamp(platform, 1, 14) - 7;
  return {
    latitude: HANNOVER.latitude + lane * 0.0015,
    longitude: HANNOVER.longitude + lane * 0.001,
  };
}

function minutesFrom(nowMinutes: number, targetMinutes: number) {
  const difference = nowMinutes - targetMinutes;
  if (difference > 720) return difference - 1440;
  if (difference < -720) return difference + 1440;
  return difference;
}

function trainMapState(train: Train, nowMinutes: number) {
  const position = trainPosition(train, nowMinutes);
  const platform = train.reroutedTo ?? train.platform;
  const platformPoint = platformCoordinate(platform);
  const effectiveArrival = train.scheduledArrival + train.delayMin;
  const afterArrival = minutesFrom(nowMinutes, effectiveArrival);
  const continuesBeyondHannover = !train.destination.toLowerCase().includes('hannover');

  if (train.cancelled) {
    return {
      coordinate: corridorCoordinate(position.offset),
      movement: 'Cancelled before platform',
      color: 'red' as const,
    };
  }

  if (afterArrival < -3) {
    const routePoint = corridorCoordinate(position.offset);
    const approachProgress = clamp((position.offset - 0.88) / 0.12, 0, 1);
    return {
      coordinate: interpolate(routePoint, platformPoint, approachProgress),
      movement: `Entering platform ${platform}`,
      color: train.delayMin > 0 ? ('orange' as const) : CATEGORY_COLOR[train.category],
    };
  }

  if (afterArrival <= 2 || !continuesBeyondHannover) {
    return {
      coordinate: platformPoint,
      movement: `At platform ${platform}`,
      color: train.delayMin > 0 ? ('orange' as const) : CATEGORY_COLOR[train.category],
    };
  }

  const departureProgress = clamp((afterArrival - 2) / 8, 0, 1);
  const departureTarget = {
    latitude: HANNOVER.latitude - 0.105,
    longitude: HANNOVER.longitude + (platform % 2 === 0 ? 0.115 : -0.105),
  };
  return {
    coordinate: interpolate(platformPoint, departureTarget, departureProgress),
    movement: `Leaving platform ${platform}`,
    color: CATEGORY_COLOR[train.category],
  };
}

export function TrainMovementMap({ trains, nowMinutes }: TrainMovementMapProps) {
  const [accent, border, muted, panel] = useThemeColor(['accent', 'border', 'muted', 'surface']);

  const { markers, polylines } = useMemo(() => {
    const stationMarkers: MapMarker[] = GEO_STATIONS.map((station, index) => ({
      id: `station-${CORRIDOR_STATIONS[index].id}`,
      coordinate: station.coordinate,
      color: index === GEO_STATIONS.length - 1 ? 'yellow' : 'blue',
      opacity: 0.7,
    }));

    const trainMarkers: MapMarker[] = trains.map((train) => {
      const state = trainMapState(train, nowMinutes);
      const platform = train.reroutedTo ?? train.platform;
      return {
        id: `train-${train.id}`,
        coordinate: state.coordinate,
        color: state.color,
        title: `${train.service} · ${state.movement}`,
        description: `${train.origin} → ${train.destination} · ${formatDelay(train.delayMin)} · arr ${formatTimeOfDay(train.scheduledArrival + train.delayMin)} · Pl. ${platform}`,
      };
    });

    const route: MapPolyline = {
      id: 'hamburg-hannover-route',
      coordinates: GEO_STATIONS.map((station) => station.coordinate),
      strokeColor: accent,
      strokeWidth: 4,
    };

    const platformApproaches: MapPolyline[] = trains.map((train) => ({
      id: `platform-approach-${train.id}`,
      coordinates: [
        corridorCoordinate(0.965),
        platformCoordinate(train.reroutedTo ?? train.platform),
      ],
      strokeColor: train.reroutedTo === undefined ? border : accent,
      strokeWidth: train.reroutedTo === undefined ? 1 : 3,
      lineDashPattern: train.reroutedTo === undefined ? [3, 4] : undefined,
    }));

    return {
      markers: [...stationMarkers, ...trainMarkers],
      polylines: [route, ...platformApproaches],
    };
  }, [accent, border, nowMinutes, trains]);

  return (
    <Panel
      title="Platform movement map"
      hint="Operational schematic · positions inferred from timetable and live delay"
      contentClassName="p-0"
    >
      <MapView
        initialRegion={{
          latitude: 52.98,
          longitude: 10.08,
          latitudeDelta: 1.55,
          longitudeDelta: 1.45,
        }}
        markers={markers}
        polylines={polylines}
        showsBuildings={false}
        showsCompass={false}
        showsIndoors={false}
        showsMyLocationButton={false}
        showsPointsOfInterest={false}
        showsScale={false}
        rotateEnabled={false}
        pitchEnabled={false}
        style={{ height: 320, width: '100%', backgroundColor: panel }}
      />
      <View className="border-border bg-panel flex-row flex-wrap gap-x-4 gap-y-2 border-t px-4 py-3">
        <View className="min-w-32 flex-1 flex-row items-center gap-2">
          <ArrowDownRight size={14} color={accent} />
          <Typography type="body-xs" color="muted" className="flex-1">
            Entering Hannover platform
          </Typography>
        </View>
        <View className="min-w-32 flex-1 flex-row items-center gap-2">
          <ArrowUpRight size={14} color={muted} />
          <Typography type="body-xs" color="muted" className="flex-1">
            Leaving after the planned dwell
          </Typography>
        </View>
        <View className="w-full flex-row items-start gap-2">
          <TrainFront size={14} color={muted} />
          <Typography type="body-xs" color="muted" className="flex-1">
            Tap a train for service, platform, arrival, and delay details. Movement is estimated; DB
            does not publish train GPS in this feed.
          </Typography>
        </View>
      </View>
    </Panel>
  );
}
