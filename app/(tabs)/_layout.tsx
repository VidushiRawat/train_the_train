import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useThemeColor } from 'heroui-native';
import { Gauge, ScrollText, Scale, TrainFront } from 'lucide-react-native';
import { useEffect } from 'react';

import { startCorridorClock, useCockpitStore } from '@/lib/store';
import { useCorridorFeed } from '@/hooks/useCorridorFeed';

/** The logo-led light canvas needs dark system status-bar content. */
const STATUS_BAR_STYLE = 'dark' as const;

export default function TabLayout() {
  const [background, border, accent, muted, danger, panel] = useThemeColor([
    'background',
    'border',
    'accent',
    'muted',
    'danger',
    'surface',
  ]);
  const pending = useCockpitStore((state) => state.pending);

  // Live DB board + Berlin clock run for as long as the cockpit is open.
  useCorridorFeed();
  useEffect(() => startCorridorClock(), []);

  return (
    <>
      <StatusBar style={STATUS_BAR_STYLE} />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: background },
          tabBarStyle: {
            backgroundColor: panel,
            borderTopColor: border,
            elevation: 0,
            shadowColor: 'transparent',
            shadowOpacity: 0,
            shadowRadius: 0,
          },
          tabBarActiveTintColor: accent,
          tabBarInactiveTintColor: muted,
          tabBarLabelStyle: { fontSize: 11 },
          tabBarBadgeStyle: { backgroundColor: danger, color: background, fontSize: 10 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Station',
            tabBarIcon: ({ color, size }) => <TrainFront color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="decision"
          options={{
            title: 'Decision',
            tabBarBadge: pending ? '!' : undefined,
            tabBarIcon: ({ color, size }) => <Scale color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="score"
          options={{
            title: 'Score',
            tabBarIcon: ({ color, size }) => <Gauge color={color} size={size ?? 24} />,
          }}
        />
        <Tabs.Screen
          name="log"
          options={{
            title: 'Log',
            tabBarIcon: ({ color, size }) => <ScrollText color={color} size={size ?? 24} />,
          }}
        />
      </Tabs>
    </>
  );
}
