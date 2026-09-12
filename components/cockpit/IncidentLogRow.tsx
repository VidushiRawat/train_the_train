import { Typography } from 'heroui-native';
import { View } from 'react-native';

import type { Incident } from '@/lib/types';
import { formatTimeOfDay } from '@/lib/utils';

import { CategoryBadge, ModeBadge, OptionBadge } from './badges';

/** One resolved incident, as it appears in the session log. */
export function IncidentLogRow({ incident }: { incident: Incident }) {
  const resolution = incident.resolution;
  const chosen = incident.proposals.find((proposal) => proposal.id === resolution?.chosenId);

  return (
    <View className="border-border bg-panel gap-2 rounded-2xl border p-3">
      <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
        <Typography type="body-sm" weight="semibold" className="text-muted">
          {formatTimeOfDay(incident.detectedAt)}
        </Typography>
        <CategoryBadge category={incident.trainCategory} />
        <Typography type="body-sm" weight="semibold" className="min-w-20 flex-1">
          {incident.trainService}
        </Typography>
        {resolution && <ModeBadge mode={resolution.mode} />}
      </View>

      <Typography type="body-xs" color="muted">
        {incident.disruption.label} at {incident.disruption.station} · +{incident.delayMin} min ·
        platform {incident.platform}
      </Typography>

      {chosen && (
        <View className="flex-row items-start gap-2">
          <OptionBadge id={chosen.id} author={chosen.author} />
          <Typography type="body-sm" className="flex-1">
            {chosen.title}
          </Typography>
        </View>
      )}

      {resolution && (
        <View className="flex-row flex-wrap gap-x-4 gap-y-1">
          <Typography type="body-xs" className="text-success">
            −{resolution.delayMinutesAvoided} delay min
          </Typography>
          <Typography type="body-xs" className="text-success">
            {resolution.passengersProtected} passengers protected
          </Typography>
          <Typography type="body-xs" className="text-success">
            {resolution.connectionsProtected} connections kept
          </Typography>
          <Typography type="body-xs" color="muted">
            decided {formatTimeOfDay(resolution.decidedAt)}
          </Typography>
        </View>
      )}
    </View>
  );
}
