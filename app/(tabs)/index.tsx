import { Typography, useThemeColor } from 'heroui-native';
import { TrainFront } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { CockpitHeader } from '@/components/cockpit/CockpitHeader';
import { TrainMovementMap } from '@/components/cockpit/TrainMovementMap';
import { useCockpitStore } from '@/lib/store';

export default function StationScreen() {
  const nowSeconds = useCockpitStore((state) => state.nowSeconds);
  const [muted] = useThemeColor(['muted']);

  return (
    <View className="bg-background flex-1">
      <CockpitHeader title="Hamburg Hauptbahnhof" subtitle="Concise station movement overview" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
        <TrainMovementMap trains={[]} nowSeconds={nowSeconds} />

        <View className="flex-row items-start gap-2 px-1">
          <TrainFront size={12} color={muted} />
          <Typography type="body-xs" color="muted" className="flex-1">
            This view is limited to Hamburg Hauptbahnhof. Movement states are inferred from the
            station timetable; they are not GPS positions.
          </Typography>
        </View>
      </ScrollView>
    </View>
  );
}
