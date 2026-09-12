import { ScrollView, View } from 'react-native';

import { CockpitHeader } from '@/components/cockpit/CockpitHeader';
import { TrainMovementMap } from '@/components/cockpit/TrainMovementMap';
import { useCockpitStore } from '@/lib/store';

export default function StationScreen() {
  const nowSeconds = useCockpitStore((state) => state.nowSeconds);

  return (
    <View className="bg-background flex-1">
      <CockpitHeader title="Hamburg Hauptbahnhof" subtitle="Concise station movement overview" />

      <ScrollView contentContainerStyle={{ padding: 10, paddingBottom: 20 }}>
        <TrainMovementMap nowSeconds={nowSeconds} />
      </ScrollView>
    </View>
  );
}
