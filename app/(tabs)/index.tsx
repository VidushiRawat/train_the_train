import { router } from 'expo-router';
import { Button, Typography, useThemeColor } from 'heroui-native';
import { Clock, TrainFront, TriangleAlert, Users } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { CockpitHeader } from '@/components/cockpit/CockpitHeader';
import { CorridorPanel } from '@/components/cockpit/CorridorPanel';
import { FeedStatusPanel } from '@/components/cockpit/FeedStatusPanel';
import { Panel } from '@/components/cockpit/Panel';
import { StatTile } from '@/components/cockpit/StatTile';
import { connectionsAtRisk } from '@/lib/agents';
import { useCockpitStore } from '@/lib/store';
import { formatCount, formatTimeOfDay } from '@/lib/utils';

export default function CorridorScreen() {
  const trains = useCockpitStore((state) => state.trains);
  const nowSeconds = useCockpitStore((state) => state.nowSeconds);
  const pending = useCockpitStore((state) => state.pending);
  const lastAuto = useCockpitStore((state) => state.lastAuto);
  const feedStatus = useCockpitStore((state) => state.feed.status);
  const dismissAutoNotice = useCockpitStore((state) => state.dismissAutoNotice);

  const [muted, danger, success, warning] = useThemeColor([
    'muted',
    'danger',
    'success',
    'warning',
  ]);

  const nowMinutes = Math.floor(nowSeconds / 60);
  const delayed = trains.filter((train) => train.delayMin > 0);
  const totalDelay = delayed.reduce((total, train) => total + train.delayMin, 0);
  const passengersAtRisk = trains.reduce(
    (total, train) =>
      total +
      connectionsAtRisk(train).reduce(
        (inner, connection) => inner + connection.transferPassengers,
        0,
      ),
    0,
  );
  const autoChosen = lastAuto?.proposals.find(
    (proposal) => proposal.id === lastAuto.resolution?.chosenId,
  );

  return (
    <View className="bg-background flex-1">
      <CockpitHeader
        title="Corridor"
        subtitle="Hamburg Hbf → Hannover Hbf · live Deutsche Bahn feed"
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
        <View className="flex-row gap-2">
          <StatTile
            label="Delay in system"
            value={`${totalDelay} min`}
            hint="across delayed services"
            tone={totalDelay > 0 ? 'danger' : 'success'}
            icon={<Clock size={14} color={totalDelay > 0 ? danger : success} />}
          />
          <StatTile
            label="Services delayed"
            value={`${delayed.length}/${trains.length}`}
            hint="inbound to Hannover"
            tone={delayed.length > 0 ? 'warning' : 'success'}
            icon={<TrainFront size={14} color={delayed.length > 0 ? warning : success} />}
          />
        </View>
        <View className="flex-row gap-2">
          <StatTile
            label="Passengers at risk"
            value={`${passengersAtRisk}`}
            hint="transfers that would break"
            tone={passengersAtRisk > 0 ? 'danger' : 'success'}
            icon={<Users size={14} color={passengersAtRisk > 0 ? danger : success} />}
          />
          <StatTile
            label="Awaiting decision"
            value={pending ? '1' : '0'}
            hint={pending ? `${pending.trainService} · ${pending.disruption.label}` : 'all clear'}
            tone={pending ? 'danger' : 'success'}
            icon={<TriangleAlert size={14} color={pending ? danger : success} />}
          />
        </View>

        <FeedStatusPanel />

        {pending && (
          <Panel
            title="Controller decision required"
            className="border-danger"
            hint={pending.gateReason}
          >
            <View className="gap-3">
              <Typography type="body-sm">
                {pending.disruption.label} at {pending.disruption.station} — {pending.trainService}{' '}
                on platform {pending.platform}, +{pending.delayMin} min. Both agents have filed a
                plan.
              </Typography>
              <Button variant="secondary" onPress={() => router.push('/decision')}>
                <Button.Label>Open decision console</Button.Label>
              </Button>
            </View>
          </Panel>
        )}

        {lastAuto && autoChosen && (
          <Panel
            title="Handled automatically"
            hint={`${formatTimeOfDay(lastAuto.detectedAt)} · ${lastAuto.gateReason}`}
            right={
              <Button size="sm" variant="ghost" onPress={dismissAutoNotice}>
                <Button.Label>Dismiss</Button.Label>
              </Button>
            }
          >
            <View className="gap-1">
              <Typography type="body-sm" weight="semibold">
                {lastAuto.trainService} · {autoChosen.title}
              </Typography>
              <Typography type="body-xs" color="muted">
                {autoChosen.reason}
              </Typography>
              <Typography type="body-xs" className="text-success">
                −{lastAuto.resolution?.delayMinutesAvoided ?? 0} delay minutes vs no action ·{' '}
                {formatCount(lastAuto.resolution?.passengersProtected ?? 0, 'passenger')} protected
              </Typography>
            </View>
          </Panel>
        )}

        {trains.length > 0 ? (
          <CorridorPanel
            trains={trains}
            nowMinutes={nowMinutes}
            focusedTrainId={pending?.trainId}
          />
        ) : (
          <Panel title="Corridor Hamburg Hbf → Hannover Hbf" hint="Nothing inbound right now">
            <Typography type="body-sm" color="muted">
              {feedStatus === 'error'
                ? 'The live board could not be read, so there is nothing to show. Use Refresh above once the connection is back.'
                : feedStatus === 'live'
                  ? 'No service from the Hamburg direction is booked into Hannover Hbf in the next 90 minutes. The board is re-read automatically.'
                  : 'Reading the Hannover Hbf board…'}
            </Typography>
          </Panel>
        )}

        <View className="flex-row items-center gap-2 px-1">
          <TrainFront size={12} color={muted} />
          <Typography type="body-xs" color="muted" className="flex-1">
            Positions are drawn from booked run times and the live delay on each service. Incidents
            are raised from real reported delays, not simulated.
          </Typography>
        </View>
      </ScrollView>
    </View>
  );
}
