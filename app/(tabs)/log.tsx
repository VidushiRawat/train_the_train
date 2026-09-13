import { Typography } from 'heroui-native';
import { FlatList, View } from 'react-native';

import { CockpitHeader } from '@/components/cockpit/CockpitHeader';
import { IncidentLogRow } from '@/components/cockpit/IncidentLogRow';
import { Panel } from '@/components/cockpit/Panel';
import { useCockpitStore } from '@/lib/store';
import { formatCount } from '@/lib/utils';

export default function LogScreen() {
  const log = useCockpitStore((state) => state.log);

  return (
    <View className="bg-background flex-1">
      <CockpitHeader
        title="Incident log"
        subtitle={`${formatCount(log.length, 'decision')} recorded this session`}
      />

      <FlatList
        data={log}
        keyExtractor={(incident) => incident.id}
        contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}
        renderItem={({ item }) => <IncidentLogRow incident={item} />}
        ListEmptyComponent={
          <Panel title="Nothing logged yet">
            <Typography type="body-sm" color="muted">
              Every resolved incident is written here with the option that was applied, whether the
              system or a dispatcher made the call, and what it saved.
            </Typography>
          </Panel>
        }
      />
    </View>
  );
}
