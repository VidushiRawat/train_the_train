import { router } from 'expo-router';
import { Button, Typography } from 'heroui-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { CockpitHeader } from '@/components/cockpit/CockpitHeader';
import { ImpactMetricsRow } from '@/components/cockpit/ImpactMetricsRow';
import { Panel } from '@/components/cockpit/Panel';
import { ProposalCard } from '@/components/cockpit/ProposalCard';
import { CategoryBadge, ModeBadge, OptionBadge, SeverityBadge } from '@/components/cockpit/badges';
import { useCockpitStore } from '@/lib/store';
import { formatTimeOfDay } from '@/lib/utils';

export default function DecisionScreen() {
  const pending = useCockpitStore((state) => state.pending);
  const decide = useCockpitStore((state) => state.decide);
  const lastDecision = useCockpitStore((state) => state.log[0]);
  const [selectedByIncident, setSelectedByIncident] = useState<Record<string, string>>({});

  const selectedId = pending
    ? (selectedByIncident[pending.id] ?? pending.recommendedId)
    : undefined;
  const agentProposals =
    pending?.proposals.filter((proposal) => proposal.author !== 'arbiter') ?? [];
  const selectedAlternativeId =
    selectedId && selectedId !== pending?.recommendedId ? selectedId : undefined;
  const fallbackAlternativeId = agentProposals.find(
    (proposal) => proposal.id !== pending?.recommendedId,
  )?.id;
  const rejectProposalId = selectedAlternativeId ?? fallbackAlternativeId;
  const lastChosen = lastDecision?.proposals.find(
    (proposal) => proposal.id === lastDecision.resolution?.chosenId,
  );

  const select = (incidentId: string, proposalId: string) => {
    setSelectedByIncident((current) => ({ ...current, [incidentId]: proposalId }));
  };

  return (
    <View className="bg-background flex-1">
      <CockpitHeader
        title="Decision console"
        subtitle={pending ? 'One incident is waiting for your call' : 'No active impact or delay'}
      />

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
        {pending ? (
          <>
            <Panel title="Incident" className="border-danger" hint={pending.gateReason}>
              <View className="gap-3">
                <View className="flex-row items-center gap-2">
                  <CategoryBadge category={pending.trainCategory} />
                  <Typography type="body" weight="semibold">
                    {pending.trainService}
                  </Typography>
                  <View className="flex-1" />
                  <SeverityBadge severity={pending.severity} />
                </View>
                <Typography type="body-sm">
                  {pending.disruption.label} at {pending.disruption.station}.{' '}
                  {pending.disruption.detail}
                </Typography>
                <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                  <Typography type="body-xs" color="muted">
                    Detected {formatTimeOfDay(pending.detectedAt)}
                  </Typography>
                  <Typography type="body-xs" className="text-danger">
                    +{pending.delayMin} min
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    Platform {pending.platform} at Hamburg Hbf
                  </Typography>
                </View>
              </View>
            </Panel>

            <Panel title="If you take no action" hint="Baseline the agents are measured against">
              <ImpactMetricsRow metrics={pending.baseline} />
            </Panel>

            <View className="gap-1 px-1">
              <Typography type="body-sm" weight="semibold">
                Agent proposals
              </Typography>
              <Typography type="body-xs" color="muted">
                Compare options A and B, then review the orchestrator below.
              </Typography>
            </View>

            <View className="flex-row items-stretch gap-2">
              {agentProposals.map((proposal) => (
                <View key={proposal.id} style={{ flexBasis: 0, flexGrow: 1, minWidth: 0 }}>
                  <ProposalCard
                    proposal={proposal}
                    baseline={pending.baseline}
                    isRecommended={proposal.id === pending.recommendedId}
                    isSelected={proposal.id === selectedId}
                    compact
                    onSelect={(id) => select(pending.id, id)}
                  />
                </View>
              ))}
            </View>

            <Panel
              title="Orchestrator"
              hint={`Confidence ${Math.round(pending.confidence * 100)}%`}
            >
              <View className="gap-2">
                <View className="flex-row items-center gap-2">
                  <OptionBadge id={pending.recommendedId} author="arbiter" />
                  <Typography type="body-sm" weight="semibold" className="flex-1">
                    Recommends option {pending.recommendedId}
                  </Typography>
                </View>
                <Typography type="body-sm" color="muted">
                  {pending.rationale}
                </Typography>
              </View>
            </Panel>
          </>
        ) : (
          <>
            <Panel title="No active delay" hint="No impact currently needs a decision">
              <View className="gap-3">
                <Typography type="body-sm">
                  The live Hamburg Hbf board has no active impact waiting for a decision. This
                  console will show the affected service and response options when an actionable
                  delay or cancellation is detected.
                </Typography>
                <Button variant="secondary" onPress={() => router.replace('/')}>
                  <Button.Label>Go to Station</Button.Label>
                </Button>
              </View>
            </Panel>

            {lastDecision && lastChosen && lastDecision.resolution && (
              <Panel
                title="Last decision"
                hint={`${formatTimeOfDay(lastDecision.detectedAt)} · ${lastDecision.trainService}`}
                right={<ModeBadge mode={lastDecision.resolution.mode} />}
              >
                <View className="gap-3">
                  <View className="flex-row items-start gap-2">
                    <OptionBadge id={lastChosen.id} author={lastChosen.author} />
                    <Typography type="body-sm" weight="semibold" className="flex-1">
                      {lastChosen.title}
                    </Typography>
                  </View>
                  <ImpactMetricsRow
                    metrics={lastDecision.resolution.metrics}
                    baseline={lastDecision.baseline}
                  />
                </View>
              </Panel>
            )}
          </>
        )}
      </ScrollView>

      {pending && (
        <View
          className="border-border bg-panel pb-safe-offset-2 gap-2 border-t px-4 pt-3"
          style={{ flexDirection: 'row' }}
        >
          <Button
            variant="primary"
            className="min-w-0 flex-1"
            onPress={() => decide(pending.recommendedId)}
          >
            <Button.Label className="text-center">Accept AI recommendation</Button.Label>
          </Button>

          <Button
            variant="danger"
            className="min-w-0 flex-1"
            isDisabled={!rejectProposalId}
            onPress={() => {
              if (rejectProposalId) decide(rejectProposalId);
            }}
          >
            <Button.Label className="text-center">Reject AI suggestion</Button.Label>
          </Button>
        </View>
      )}
    </View>
  );
}
