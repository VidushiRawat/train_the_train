import { Button, Typography, useThemeColor } from 'heroui-native';
import { Clock, RotateCcw, TicketX, Users } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { CockpitHeader } from '@/components/cockpit/CockpitHeader';
import { Panel } from '@/components/cockpit/Panel';
import { StatTile } from '@/components/cockpit/StatTile';
import { useCockpitStore } from '@/lib/store';
import { formatCount } from '@/lib/utils';

export default function ScoreScreen() {
  const score = useCockpitStore((state) => state.score);
  const reset = useCockpitStore((state) => state.reset);
  const [success, accent, warning, danger] = useThemeColor([
    'success',
    'accent',
    'warning',
    'danger',
  ]);

  const handled = score.autoHandled + score.humanHandled;
  const autoShare = handled > 0 ? score.autoHandled / handled : 0;

  return (
    <View className="bg-background flex-1">
      <CockpitHeader title="Session score" subtitle="Impact avoided since the shift started" />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
        <Panel title="Avoided this session" hint="Measured against taking no action each time">
          <View className="gap-3">
            <View className="flex-row items-end gap-2">
              <Typography type="h1" weight="bold" className="text-success">
                {score.delayMinutesAvoided}
              </Typography>
              <Typography type="body" color="muted" className="pb-1">
                delay minutes avoided
              </Typography>
            </View>
            <View className="flex-row gap-2">
              <StatTile
                label="Passengers protected"
                value={`${score.passengersProtected}`}
                hint="kept on their planned journey"
                tone="success"
                icon={<Users size={14} color={success} />}
              />
              <StatTile
                label="Connections kept"
                value={`${score.connectionsProtected}`}
                hint="transfers that would have broken"
                tone="success"
                icon={<TicketX size={14} color={success} />}
              />
            </View>
          </View>
        </Panel>

        <Panel
          title="How incidents were handled"
          hint={`${formatCount(score.incidents, 'incident')} this session`}
        >
          <View className="gap-3">
            <View className="bg-panel-raised h-2 flex-row overflow-hidden rounded-full">
              <View className="bg-success" style={{ width: `${autoShare * 100}%` }} />
              <View className="bg-accent flex-1" />
            </View>
            <View className="flex-row gap-2">
              <StatTile
                label="Auto-applied"
                value={`${score.autoHandled}`}
                hint="minor, under the gate"
                tone="success"
                icon={<Clock size={14} color={success} />}
              />
              <StatTile
                label="Human decision"
                value={`${score.humanHandled}`}
                hint="controller signed off"
                tone="accent"
                icon={<Users size={14} color={accent} />}
              />
              <StatTile
                label="Overrides"
                value={`${score.overrides}`}
                hint="agent pick rejected"
                tone={score.overrides > 0 ? 'warning' : 'default'}
                icon={<RotateCcw size={14} color={score.overrides > 0 ? warning : accent} />}
              />
            </View>
          </View>
        </Panel>

        <Panel title="How the score is counted">
          <View className="gap-2">
            <Typography type="body-sm" color="muted">
              For every incident the engine also models doing nothing. The difference between that
              baseline and the plan that was applied is what lands here: delay minutes at Hamburg
              Hbf, passengers whose journey stayed intact, and transfers there that survived.
            </Typography>
            <Typography type="body-sm" color="muted">
              The arbiter treats one broken connection as roughly eight minutes of network delay,
              which is why it sometimes accepts a longer hold to keep people moving.
            </Typography>
            <Typography type="body-xs" color="muted">
              Delay minutes come from the live DB feed. Passenger figures are estimates from service
              class and time of day, so treat them as scale, not exact counts.
            </Typography>
          </View>
        </Panel>

        <Button variant="danger-soft" onPress={reset}>
          <RotateCcw size={16} color={danger} />
          <Button.Label>Reset session</Button.Label>
        </Button>
      </ScrollView>
    </View>
  );
}
